'use strict';

/**
 * electron/main/index.js
 *
 * Desktop layer bootstrap.
 *
 * This is the single entry point for all Phase 1 desktop features.
 * It wires together all managers in the correct order, establishes
 * their dependencies, and exposes a destroy() function for graceful
 * shutdown.
 *
 * Startup sequence:
 *   1. desktopSettings.init()     — load persisted settings from disk
 *   2. windowManager.init()       — create main window (show after ready-to-show)
 *   3. trayManager.init()         — create system tray icon + menu
 *   4. shortcutManager.init()     — register global keyboard shortcuts
 *   5. notificationManager.init() — configure native notification defaults
 *   6. dragDropManager.init()     — configure drag-and-drop on webContents
 *   7. commandPaletteManager.init() — register built-in commands
 *   8. desktopEvents.init()       — wire all ipcMain handlers
 *
 * Each module fails gracefully and logs a warning — no single failure
 * should prevent the app from starting.
 */

const desktopSettings      = require('./store/desktopSettings');
const windowManager        = require('./windows/windowManager');
const trayManager          = require('./tray/trayManager');
const shortcutManager      = require('./shortcuts/shortcutManager');
const notificationManager  = require('./notifications/notificationManager');
const dragDropManager      = require('./dragdrop/dragDropManager');
const commandPaletteManager = require('./commandPalette/commandPaletteManager');
const desktopEvents        = require('./ipc/desktopEvents');
const developerManager     = require('../developer/developerManager');

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function init() {

  // 1 ── Persistent settings (must be first — others read from it)
  _try('desktopSettings', () => desktopSettings.init());

  // 2 ── Windows
  _try('windowManager', () => windowManager.init({
    onCloseToTray: () => { /* future: show "minimized to tray" notification */ },
  }));

  // 3 ── System Tray
  _try('trayManager', () => trayManager.init({ windowManager }));

  // 4 ── Global Shortcuts
  _try('shortcutManager', () => shortcutManager.init({ windowManager, desktopSettings }));

  // 5 ── Native Notifications
  _try('notificationManager', () => notificationManager.init({ desktopSettings, windowManager }));

  // 6 ── Drag & Drop (needs mainWindow to exist)
  _try('dragDropManager', () => dragDropManager.init({ windowManager, desktopSettings }));

  // 7 ── Command Palette registry
  _try('commandPaletteManager', () => commandPaletteManager.init({ windowManager }));

  // 8 ── IPC — must be last (all managers must be ready to receive calls)
  _try('desktopEvents', () => desktopEvents.init({
    windowManager,
    trayManager,
    notificationManager,
    commandPaletteManager,
    dragDropManager,
    desktopSettings,
    shortcutManager,
    developerManager,
  }));

  // 9 ── Developer Console (after IPC is wired)
  _try('developerManager', () => developerManager.init({ windowManager }));

  console.log('[Desktop] All Phase 1 modules initialized');
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

function destroy() {
  _try('shortcutManager.destroy',       () => shortcutManager.destroy());
  _try('trayManager.destroy',           () => trayManager.destroy());
  _try('commandPaletteManager.destroy', () => commandPaletteManager.destroy());
  _try('developerManager.destroy',      () => developerManager.destroy());
  console.log('[Desktop] Desktop layer shut down');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Run a function and log any error without crashing.
 * @param {string} name
 * @param {() => void} fn
 */
function _try(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[Desktop] ${name} initialization failed:`, err.message, err.stack);
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = { init, destroy };
