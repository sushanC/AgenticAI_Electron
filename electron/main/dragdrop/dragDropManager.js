'use strict';

/**
 * dragDropManager.js
 *
 * Configures drag-and-drop behaviour at the Electron main-process level.
 *
 * Responsibilities:
 *   • Prevent the default Electron behaviour of navigating away when a
 *     user drops a file onto the window (Electron opens it in a new window
 *     by default — we stop that)
 *   • Re-broadcast file drop events that originate from the webContents
 *     back to the renderer as structured IPC so React can handle them
 *
 * The actual drop overlay UI and file handling live in the renderer
 * (DragDropOverlay.jsx). This module only configures the main-process side.
 *
 * Supported file types are defined here so the renderer can display them,
 * and so future extensions only require adding to ACCEPTED_EXTENSIONS.
 */

const { ipcMain } = require('electron');

// ─── Accepted Extensions ─────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = new Set([
  'pdf',
  'txt',
  'md', 'markdown',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
  'docx', 'doc',
  'pptx', 'ppt',
  'xlsx', 'xls',
  'csv',
  'zip',
]);

// ─── State ────────────────────────────────────────────────────────────────────

let _windowManager = null;
let _settings      = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {{ windowManager: object, desktopSettings: object }} deps
 */
function init({ windowManager, desktopSettings }) {
  _windowManager = windowManager;
  _settings      = desktopSettings;

  const enabled = desktopSettings.get('enableDragDrop');
  if (!enabled) {
    console.log('[Desktop] Drag & Drop disabled by settings');
    return;
  }

  _configureMainWindow();
  console.log('[Desktop] Drag & Drop manager initialized');
}

// ─── Configure Window ────────────────────────────────────────────────────────

function _configureMainWindow() {
  const mainWindow = _windowManager.getMainWindow();
  if (!mainWindow) return;

  const wc = mainWindow.webContents;

  /**
   * Prevent Electron's default drag-navigation behaviour.
   * Without this, dropping a file onto the window would navigate to file://...
   */
  wc.on('will-navigate', (e, url) => {
    if (url.startsWith('file://') && !url.endsWith('index.html')) {
      e.preventDefault();
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Filter and normalise a list of dropped file paths.
 * Called by desktopEvents.js when the renderer reports a drop.
 *
 * @param {{ path: string, name: string, ext: string, size: number }[]} files
 * @returns {{ path: string, name: string, ext: string, size: number }[]}
 */
function filterDroppedFiles(files) {
  return files.filter(f => ACCEPTED_EXTENSIONS.has(f.ext.toLowerCase()));
}

/**
 * Returns the set of accepted extensions for renderer display.
 * @returns {string[]}
 */
function getAcceptedExtensions() {
  return Array.from(ACCEPTED_EXTENSIONS);
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  init,
  filterDroppedFiles,
  getAcceptedExtensions,
  ACCEPTED_EXTENSIONS,
};
