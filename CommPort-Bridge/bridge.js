const { SerialPort }    = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const WebSocket          = require("ws");

const COM_PORT  = "COM8";
const BAUD_RATE = 115200;
const WS_PORT   = 8080;
const port = new SerialPort({
  path:     COM_PORT,
  baudRate: BAUD_RATE,
});

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

port.on("open", () => {
  console.log(`\n Serial port opened: ${COM_PORT} @ ${BAUD_RATE} baud`);
  console.log(`   Waiting for ESP32 data...\n`);
});

port.on("error", (err) => {
  console.error(`\n Serial port error: ${err.message}`);
  console.error(`   Check that:`);
  console.error(`   • ESP32 is plugged in via USB`);
  console.error(`   • COM_PORT is set correctly (currently "${COM_PORT}")`);
  console.error(`   • Arduino IDE Serial Monitor is CLOSED (only one app can use the port)\n`);
});

const wss = new WebSocket.Server({ port: WS_PORT });
let clients = [];

wss.on("listening", () => {
  console.log(` WebSocket server running: ws://localhost:${WS_PORT}`);
  console.log(` Your website can now connect.\n`);
});

wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🔌 Website connected (${clientIp}) — total clients: ${clients.length + 1}`);
  clients.push(ws);

  ws.on("message", (msg) => {
    const str = msg.toString().trim();
    console.log(`Command from website: ${str}`);

    if (!port.isOpen) {
      console.warn(" Serial port is not open — command not sent");
      return;
    }

    port.write(str + "\n", (err) => {
      if (err) console.error(`   Failed to write to Serial: ${err.message}`);
      else     console.log(`   Sent to ESP32`);
    });
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
    console.log(`Website disconnected — total clients: ${clients.length}`);
  });

  ws.on("error", (err) => {
    console.error(`WebSocket client error: ${err.message}`);
    clients = clients.filter((c) => c !== ws);
  });
});

parser.on("data", (line) => {
  line = line.trim();
  if (!line) return;

  if (!line.startsWith("{")) {
    console.log(`ESP32 (debug): ${line}`);
    return;
  }

  console.log(`ESP32 (telemetry): ${line}`);

  const dead = [];
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(line);
    } else {
      dead.push(ws);
    }
  });

  if (dead.length > 0) {
    clients = clients.filter((c) => !dead.includes(c));
  }
});

process.on("SIGINT", () => {
  console.log("\n\n🛑 Shutting down bridge...");

  clients.forEach((ws) => ws.close());

  if (port.isOpen) {
    port.close(() => {
      console.log("   Serial port closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});