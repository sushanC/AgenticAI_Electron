'use strict';

/**
 * windowManager.js
 *
 * Single source of truth for all BrowserWindows in samGPT.
 *
 * Responsibilities:
 *   • Create the main application window with proper security settings
 *   • Create the Quick Ask floating window lazily (on first use)
 *   • Enforce close-to-tray behaviour for the main window
 *   • Provide createFutureWindow() as the Phase 2/3/4 extension point
 *
 * Rules:
 *   • No window creation may happen outside this module
 *   • All paths are resolved at require() time to avoid race conditions
 *   • desktopSettings is required lazily to prevent circular references
 */

const { BrowserWindow, app, screen } = require('electron');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const ELECTRON_ROOT = path.resolve(__dirname, '..', '..', '..');
const PRELOAD_PATH  = path.join(ELECTRON_ROOT, 'preload.js');
const DIST_PATH     = path.resolve(
  ELECTRON_ROOT,
  '..',
  'AgenticAI_Frontend',
  'dist'
);

// ─── State ────────────────────────────────────────────────────────────────────

let _mainWindow     = null;
let _quickAskWindow = null;
let _onCloseToTray  = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {{ onCloseToTray?: () => void }} [options]
 */
function init({ onCloseToTray } = {}) {
  _onCloseToTray = onCloseToTray || null;
  _createMainWindow();
}

// ─── Main Window ──────────────────────────────────────────────────────────────

function _createMainWindow() {
  _mainWindow = new BrowserWindow({
    width:          1600,
    height:         1000,
    minWidth:       1200,
    minHeight:      800,
    backgroundColor: '#212121',
    show:           false, // Show after ready-to-show to prevent flash
    webPreferences: {
      preload:          PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false, // Required for preload to access require
    },
  });

  _mainWindow.once('ready-to-show', () => {
    _mainWindow.maximize();
    _mainWindow.show();
    console.log('[Desktop] Main window ready');
  });

  _mainWindow.loadFile(path.join(DIST_PATH, 'index.html'));

  // Intercept close: hide to tray instead of destroying
  _mainWindow.on('close', (e) => {
    const settings = require('../store/desktopSettings');
    if (!app.isQuitting && settings.get('minimizeToTray')) {
      e.preventDefault();
      _mainWindow.hide();
      if (_onCloseToTray) _onCloseToTray();
      console.log('[Desktop] Main window hidden to tray');
    }
  });

  _mainWindow.on('closed', () => {
    _mainWindow = null;
  });

  console.log('[Desktop] Main window created');
}

// ─── Quick Ask Window ─────────────────────────────────────────────────────────

function _createQuickAskWindow() {
  const display   = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  const winWidth  = 600;
  const startX    = Math.round((width - winWidth) / 2);
  const startY    = Math.round(display.workAreaSize.height * 0.22);

  _quickAskWindow = new BrowserWindow({
    x:            startX,
    y:            startY,
    width:        winWidth,
    height:       120,
    minHeight:    120,
    maxHeight:    620,
    resizable:    false,
    alwaysOnTop:  true,
    frame:        false,
    transparent:  true,
    hasShadow:    true,
    skipTaskbar:  true,
    show:         false,
    webPreferences: {
      preload:          PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  _quickAskWindow.loadFile(path.join(DIST_PATH, 'quickask.html'));

  // Hide on focus loss (Raycast-style)
  _quickAskWindow.on('blur', () => {
    _quickAskWindow?.hide();
  });

  _quickAskWindow.on('closed', () => {
    _quickAskWindow = null;
  });

  console.log('[Desktop] Quick Ask window created (lazy)');
}

// ─── Public API ───────────────────────────────────────────────────────────────

function getMainWindow()     { return _mainWindow; }
function getQuickAskWindow() { return _quickAskWindow; }

function showMainWindow() {
  if (!_mainWindow) _createMainWindow();
  if (_mainWindow.isMinimized()) _mainWindow.restore();
  _mainWindow.show();
  _mainWindow.focus();
  console.log('[Desktop] Main window restored');
}

function hideMainWindow() {
  _mainWindow?.hide();
}

function showQuickAsk() {
  if (!_quickAskWindow) _createQuickAskWindow();

  // Re-center horizontally on the active display each time it opens
  const display        = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width }      = display.workAreaSize;
  const winWidth       = 600;
  const currentBounds  = _quickAskWindow.getBounds();

  _quickAskWindow.setBounds({
    x:      Math.round(display.bounds.x + (width - winWidth) / 2),
    y:      Math.round(display.bounds.y + display.workAreaSize.height * 0.22),
    width:  winWidth,
    height: currentBounds.height,
  });

  _quickAskWindow.show();
  _quickAskWindow.focus();

  // Tell renderer to focus the input and reset state
  _quickAskWindow.webContents.send('quick-ask:focus');
  console.log('[Desktop] Quick Ask window shown');
}

function hideQuickAsk() {
  _quickAskWindow?.hide();
  console.log('[Desktop] Quick Ask window hidden');
}

/**
 * Resize the Quick Ask window vertically as content expands.
 * Called by the renderer via IPC when the response area grows.
 * @param {number} height — Target height in logical pixels
 */
function resizeQuickAsk(height) {
  if (!_quickAskWindow) return;
  const bounds        = _quickAskWindow.getBounds();
  const clampedHeight = Math.max(120, Math.min(height, 620));
  _quickAskWindow.setBounds(
    { x: bounds.x, y: bounds.y, width: bounds.width, height: clampedHeight },
    true // animate
  );
}

/**
 * Phase 2/3/4 extension point.
 * Creates a named window with sensible security defaults.
 *
 * @param {string} name — Identifier for logging
 * @param {Electron.BrowserWindowConstructorOptions} options
 * @returns {BrowserWindow}
 */
function createFutureWindow(name, options = {}) {
  const { webPreferences: extraWP = {}, ...rest } = options;
  const win = new BrowserWindow({
    width:          800,
    height:         600,
    backgroundColor: '#212121',
    show:           false,
    ...rest,
    webPreferences: {
      preload:          PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
      ...extraWP,
    },
  });
  win.once('ready-to-show', () => win.show());
  console.log(`[Desktop] Future window "${name}" created`);
  return win;
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  init,
  getMainWindow,
  getQuickAskWindow,
  showMainWindow,
  hideMainWindow,
  showQuickAsk,
  hideQuickAsk,
  resizeQuickAsk,
  createFutureWindow,
};
