// SkyTrack desktop shell: the backend runs in-process, so the app runs by
// itself — no manual backend start, no terminal. `electron .` opens the
// window; required from plain node it only exposes the test seam below.
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const DEFAULT_PORT = Number(process.env.SKTRACK_PORT || 3000);

function tryListen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(null));
    srv.once("listening", () => {
      const assigned = srv.address().port;
      srv.close(() => resolve(assigned));
    });
    srv.listen(port, host);
  });
}
async function choosePort(preferred = DEFAULT_PORT) {
  return (await tryListen(preferred)) ?? (await tryListen(0)) ?? preferred;
}

let backend = null;
function startBackend(port) {
  if (backend) return backend;
  const { start } = require("../server/src/index.js");
  backend = start(port);
  return backend;
}
function stopBackend() {
  const h = backend;
  backend = null;
  if (!h) return;
  try { h.detach && h.detach(); } catch { /* already cleared */ }
  try { h.wss && h.wss.close(); } catch { /* already closed */ }
  try { h.server && h.server.close(); } catch { /* already closed */ }
  for (const k of ["poller", "seaPoller", "streetsPoller", "quakePoller", "eventPoller", "swpcPoller", "firePoller", "fiPoller", "iePoller", "tleStore"]) {
    try { h[k] && h[k].stop && h[k].stop(); } catch { /* already stopped */ }
  }
}

const isElectron = !!(process.versions && process.versions.electron);
if (isElectron) {
  // eslint-disable-next-line node/no-missing-require
  const { app, BrowserWindow, dialog } = require("electron");
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    app.on("second-instance", () => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
    });
    app.whenReady().then(async () => {
      const port = await choosePort();
      try {
        startBackend(port);
      } catch (e) {
        dialog.showErrorBox("SkyTrack failed to start", String((e && e.message) || e));
        app.quit();
        return;
      }
      const icon = path.join(__dirname, "icon.png");
      const win = new BrowserWindow({
        width: 1440, height: 900, show: false,
        autoHideMenuBar: true, backgroundColor: "#040b26", title: "SkyTrack",
        ...(fs.existsSync(icon) ? { icon } : {}),
        webPreferences: { contextIsolation: true },
      });
      win.on("closed", () => stopBackend());
      try {
        await win.loadURL(`http://127.0.0.1:${port}/`);
      } catch (e) {
        dialog.showErrorBox("SkyTrack failed to load", String((e && e.message) || e));
        app.quit();
        return;
      }
      win.once("ready-to-show", () => win.show());
      app.on("window-all-closed", () => {
        stopBackend();
        if (process.platform !== "darwin") app.quit();
      });
    });
  }
}

module.exports = { choosePort, startBackend, stopBackend, DEFAULT_PORT };
