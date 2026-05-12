import { useState, useEffect, useRef } from "react";

const THINGSBOARD_URL = "https://mqtt.thingsboard.cloud";
const BRIDGE_URL      = "ws://localhost:8080";
const RECHECK_MS      = 15000;

let   cachedMode      = "detecting";
const listeners       = new Set();

function setMode(mode) {
  if (cachedMode === mode) return;
  cachedMode = mode;
  listeners.forEach((fn) => fn(mode));
}

async function checkThingsBoard() {
  try {
    const res = await fetch(THINGSBOARD_URL, {
      method: "HEAD",
      mode:   "no-cors",
      signal: AbortSignal.timeout(4000),
    });
    return true;
  } catch {
    return false;
  }
}

function checkBridge() {
  return new Promise((resolve) => {
    const ws = new WebSocket(BRIDGE_URL);
    const timer = setTimeout(() => {
      ws.onopen = ws.onerror = ws.onclose = null;
      ws.close();
      resolve(false);
    }, 3000);

    ws.onopen = () => {
      clearTimeout(timer);
      ws.onopen = ws.onerror = ws.onclose = null;
      ws.close();
      resolve(true);
    };

    ws.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
  });
}

async function detectMode() {
  const [tbOk, bridgeOk] = await Promise.all([
    checkThingsBoard(),
    checkBridge(),
  ]);

  console.log(`[ConnectionMode] ThingsBoard: ${tbOk ? "✅" : "❌"}  Bridge: ${bridgeOk ? "✅" : "❌"}`);

  if (tbOk)        setMode("thingsboard");
  else if (bridgeOk) setMode("commport");
  else               setMode("none");
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
    isDetecting:    mode === "detecting",
    isThingsBoard:  mode === "thingsboard",
    isCommPort:     mode === "commport",
    isNone:         mode === "none",
    wsUrl:          BRIDGE_URL,
  };
}