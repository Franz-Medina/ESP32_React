import { useState, useEffect, useRef } from "react";

const BRIDGE_URL = "ws://localhost:8080";
const RECHECK_MS = 15000;
const ENABLE_COMMPORT_BRIDGE = import.meta.env.VITE_ENABLE_COMMPORT_BRIDGE === "true";

let   cachedMode      = "detecting";
const listeners       = new Set();

function setMode(mode) {
  if (cachedMode === mode) return;
  cachedMode = mode;
  listeners.forEach((fn) => fn(mode));
}

function checkThingsBoard() {
  return navigator.onLine;
}

function checkBridge() {
  if (!ENABLE_COMMPORT_BRIDGE) {
    return Promise.resolve(false);
  }

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
  const bridgeOk = await checkBridge();
  const tbOk = checkThingsBoard();

  if (bridgeOk) {
    setMode("commport");
    return;
  }

  if (tbOk) {
    setMode("thingsboard");
    return;
  }

  setMode("none");
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