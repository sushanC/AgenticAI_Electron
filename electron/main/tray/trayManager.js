'use strict';

/**
 * trayManager.js
 *
 * System tray integration for samGPT.
 *
 * Responsibilities:
 *   • Create a tray icon using an SVG-rendered NativeImage
 *   • Build a context menu with all tray actions
 *   • Respond to double-click (restore window)
 *   • Expose updateRecentItems() so future phases can populate
 *     Recent PDFs / Recent Tasks dynamically from backend data
 *
 * Design:
 *   • Menu is rebuilt (not mutated) on every state change —
 *     Electron's Menu.buildFromTemplate() is cheap enough
 *   • All window interactions delegate to windowManager
 *   • Failure is non-fatal: app continues without tray
 */

const { Tray, Menu, nativeImage, app } = require('electron');

// ─── Tray Icon (SVG → NativeImage) ───────────────────────────────────────────

/**
 * Build a 22×22 SVG tray icon that matches the samGPT ✦ brand mark.
 * Uses nativeImage.createFromDataURL which accepts SVG on all platforms.
 */
function _buildIcon() {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <rect width="22" height="22" rx="5" fill="#10A37F"/>
  <text x="11" y="16.5"
        font-family="Arial, Helvetica, sans-serif"
        font-size="13"
        font-weight="bold"
        text-anchor="middle"
        fill="white">✦</text>
</svg>`.trim();

  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  try {
    return nativeImage.createFromDataURL(dataUrl);
  } catch {
    return nativeImage.createEmpty();
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

let _tray          = null;
let _windowManager = null;

let _aiStatus     = '● Online';
let _voiceStatus  = '🎙️ Standby';
let _currentModel = '⚡ Gemini 3.6 Flash';
let _workspace    = 'Default Workspace';

let _recentChats  = [];  // [{ label: string, id: string }]
let _recentPDFs   = [];  // [{ label: string, path: string }]
let _recentTasks  = [];  // [{ label: string }]

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {{ windowManager: object }} deps
 */
function init({ windowManager }) {
  _windowManager = windowManager;

  try {
    const icon = _buildIcon();
    _tray      = new Tray(icon);

    _tray.setToolTip('samGPT — Native AI Operating Companion');
    _rebuildMenu();

    // Single-click on Linux/Windows should restore the window
    _tray.on('click', () => _windowManager.showMainWindow());

    // Double-click is the standard gesture on macOS and some Linux DEs
    _tray.on('double-click', () => _windowManager.showMainWindow());

    console.log('[Desktop] Tray AI Control Center initialized');
  } catch (err) {
    console.warn('[Desktop] Tray initialization failed (app continues):', err.message);
  }
}

// ─── Menu Builder ─────────────────────────────────────────────────────────────

function _rebuildMenu() {
  if (!_tray) return;

  const chatSubmenu = _recentChats.length > 0
    ? _recentChats.map(item => ({
        label: item.label,
        click: () => {
          _windowManager.showMainWindow();
          const win = _windowManager.getMainWindow();
          if (win) win.webContents.send('desktop:navigate', { page: 'chat', chatId: item.id });
        },
      }))
    : [{ label: 'No recent chats', enabled: false }];

  const pdfSubmenu = _recentPDFs.length > 0
    ? _recentPDFs.map(item => ({
        label: item.label,
        click: () => {
          _windowManager.showMainWindow();
          const win = _windowManager.getMainWindow();
          if (win) win.webContents.send('desktop:navigate', { page: 'pdfs' });
        },
      }))
    : [{ label: 'No recent PDFs', enabled: false }];

  const taskSubmenu = _recentTasks.length > 0
    ? _recentTasks.map(item => ({
        label: item.label,
        click: () => {
          _windowManager.showMainWindow();
          const win = _windowManager.getMainWindow();
          if (win) win.webContents.send('desktop:navigate', { page: 'tasks' });
        },
      }))
    : [{ label: 'No recent tasks', enabled: false }];

  const menu = Menu.buildFromTemplate([
    // ── Header & Live Status ──────────────────────────────────────────────
    { label: 'samGPT Native AI Companion', enabled: false },
    { label: `AI Engine: ${_aiStatus}`, enabled: false },
    { label: `Voice Assistant: ${_voiceStatus}`, enabled: false },
    { label: `Active Model: ${_currentModel}`, enabled: false },
    { label: `Workspace: ${_workspace}`, enabled: false },
    { type: 'separator' },

    // ── Primary Desktop Workflows ─────────────────────────────────────────
    {
      label: 'Open samGPT Desktop',
      click: () => _windowManager.showMainWindow(),
    },
    {
      label:       'Quick Ask',
      accelerator: 'CmdOrCtrl+Space',
      click: () => _windowManager.showQuickAsk(),
    },
    {
      label:       'Command Palette',
      accelerator: 'CmdOrCtrl+K',
      click: () => {
        const commandPaletteManager = require('../commandPalette/commandPaletteManager');
        commandPaletteManager.openPalette();
      },
    },
    {
      label: 'New Chat',
      click: () => {
        _windowManager.showMainWindow();
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:new-chat');
      },
    },
    { type: 'separator' },

    // ── Recent Context Submenus ───────────────────────────────────────────
    { label: 'Recent Chats', submenu: chatSubmenu },
    { label: 'Recent PDFs',  submenu: pdfSubmenu  },
    { label: 'Recent Tasks', submenu: taskSubmenu },
    { type: 'separator' },

    // ── Intelligence & Developer Tools ────────────────────────────────────
    {
      label: 'Memory & Facts',
      click: () => {
        _windowManager.showMainWindow();
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:navigate', { page: 'memory' });
      },
    },
    {
      label:       'Developer Console',
      accelerator: 'CmdOrCtrl+Shift+D',
      click: () => {
        const developerManager = require('../../developer/developerManager');
        developerManager.openConsole();
      },
    },
    {
      label: 'Settings',
      click: () => {
        _windowManager.showMainWindow();
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:navigate', { page: 'settings' });
      },
    },
    { type: 'separator' },

    // ── Quit ─────────────────────────────────────────────────────────────
    {
      label: 'Quit samGPT',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  _tray.setContextMenu(menu);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function updateAIStatus(status) {
  _aiStatus = status || '● Online';
  _rebuildMenu();
}

function updateVoiceStatus(status) {
  _voiceStatus = status || '🎙️ Standby';
  _rebuildMenu();
}

function updateModel(modelName) {
  _currentModel = modelName || '⚡ Gemini 3.6 Flash';
  _rebuildMenu();
}

function updateWorkspace(workspaceName) {
  _workspace = workspaceName || 'Default Workspace';
  _rebuildMenu();
}

function updateRecentChats(items) {
  _recentChats = Array.isArray(items) ? items.slice(0, 5) : [];
  _rebuildMenu();
}

/**
 * Update the Recent PDFs submenu.
 * @param {{ label: string, path: string }[]} items
 */
function updateRecentPDFs(items) {
  _recentPDFs = Array.isArray(items) ? items.slice(0, 5) : [];
  _rebuildMenu();
}

/**
 * Update the Recent Tasks submenu.
 * @param {{ label: string }[]} items
 */
function updateRecentTasks(items) {
  _recentTasks = Array.isArray(items) ? items.slice(0, 5) : [];
  _rebuildMenu();
}

function destroy() {
  if (_tray) {
    _tray.destroy();
    _tray = null;
    console.log('[Desktop] Tray destroyed');
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  init,
  updateAIStatus,
  updateVoiceStatus,
  updateModel,
  updateWorkspace,
  updateRecentChats,
  updateRecentPDFs,
  updateRecentTasks,
  destroy,
};
