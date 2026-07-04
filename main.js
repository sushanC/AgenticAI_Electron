'use strict';

/**
 * main.js — samGPT Electron entry point
 *
 * This file is intentionally thin. All desktop feature logic lives
 * in electron/main/index.js. This file handles:
 *   1. Spawning the Node.js backend process
 *   2. Calling the desktop bootstrap
 *   3. App lifecycle hooks (before-quit, window-all-closed)
 *
 * Rules:
 *   • Do NOT add window creation logic here
 *   • Do NOT add tray/shortcut logic here
 *   • DO keep backend management here (it predates the desktop layer)
 */

const { app }      = require('electron');
const { spawn }    = require('child_process');
const path         = require('path');

const desktopBootstrap = require('./electron/main/index');

// ─── Backend Process ──────────────────────────────────────────────────────────

let backend = null;

function startBackend() {
  backend = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..', 'Agentic-Ai'),
  });

  backend.stdout.on('data', data => {
    console.log(`BACKEND: ${data.toString().trim()}`);
  });

  backend.stderr.on('data', data => {
    console.error(`BACKEND ERROR: ${data.toString().trim()}`);
  });

  backend.on('close', code => {
    console.log(`[Backend] Process exited with code ${code}`);
    backend = null;
  });

  backend.on('error', err => {
    console.error('[Backend] Spawn error:', err.message);
  });

  console.log('[Backend] Process started');
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  startBackend();
  desktopBootstrap.init();
});

// Prevent app from quitting when all windows are closed — tray keeps it alive
app.on('window-all-closed', () => {
  // Do not call app.quit() — the tray keeps the app running
});

// macOS: re-create window when dock icon is clicked
app.on('activate', () => {
  const { getMainWindow, showMainWindow } = require('./electron/main/windows/windowManager');
  if (getMainWindow()) {
    showMainWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (backend) {
    backend.kill();
    console.log('[Backend] Process killed');
  }
  desktopBootstrap.destroy();
});