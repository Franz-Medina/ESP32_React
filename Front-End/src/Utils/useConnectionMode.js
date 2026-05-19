import { useState, useEffect } from "react";

const BRIDGE_URL      = "ws://localhost:8080";
const THINGSBOARD_URL = "https://thingsboard.cloud";
const RECHECK_MS      = 15000;

let cachedMode = "detecting";
const listeners = new Set();

function setMode(mode) {
  if (cachedMode === mode) return;
  cachedMode = mode;
  console.log(`[ConnectionMode] → ${mode}`);
  listeners.forEach((fn) => fn(mode));
}

function checkBridge() {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(BRIDGE_URL);

      const timer = setTimeout(() => {
        ws.onopen = ws.onerror = ws.onclose = null;
        try { ws.close(); } catch {}
        resolve(false);
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timer);
        ws.onopen = ws.onerror = ws.onclose = null;
        try { ws.close(); } catch {}
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

async function checkThingsBoard() {
  try {
    await fetch(THINGSBOARD_URL, {
      method: "HEAD",
      mode:   "no-cors",
      signal: AbortSignal.timeout(4000),
    });
    return true;
  } catch {
    return false;
  }
}

async function detectMode() {
  const bridgeOk = await checkBridge();

  if (bridgeOk) {
    setMode("commport");
    return;
  }

  const tbOk = await checkThingsBoard();

  if (tbOk) {
    setMode("thingsboard");
  } else {
    setMode("none");
  }
}

let pollingStarted = false;
function startPolling() {
  if (pollingStarted) return;
  pollingStarted = true;
  detectMode();
  setInterval(detectMode, RECHECK_MS);
}

export function useConnectionMode() {
  const [mode, setLocalMode] = useState(cachedMode);

  useEffect(() => {
    listeners.add(setLocalMode);
    startPolling();
    setLocalMode(cachedMode);
    return () => listeners.delete(setLocalMode);
  }, []);

  return {
    mode,
    isDetecting:   mode === "detecting",
    isThingsBoard: mode === "thingsboard",
    isCommPort:    mode === "commport",
    isNone:        mode === "none",
    wsUrl:         BRIDGE_URL,
  };
}