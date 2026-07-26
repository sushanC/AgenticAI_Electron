'use strict';

/**
 * clipboardMonitorService.js
 *
 * Background Clipboard Intelligence service.
 * Monitors system clipboard changes (opt-in), keeps a history ring buffer,
 * and allows fast AI actions (Explain, Summarize, Translate, Remember, Task, Note).
 */

const { clipboard } = require('electron');
const desktopSettings = require('../store/desktopSettings');

let _timer = null;
let _lastText = '';
let _history = []; // [{ text: string, timestamp: number }]
let _windowManager = null;

function start({ windowManager }) {
  _windowManager = windowManager;
  const enabled = desktopSettings.get('enableClipboardMonitoring');
  if (!enabled) {
    console.log('[BackgroundService] Clipboard monitor disabled by user settings');
    return;
  }

  try {
    _lastText = clipboard.readText();
  } catch {
    _lastText = '';
  }

  // Poll clipboard every 1000ms
  _timer = setInterval(_checkClipboard, 1000);
  console.log('[BackgroundService] Clipboard monitor service started');
}

function _checkClipboard() {
  const enabled = desktopSettings.get('enableClipboardMonitoring');
  if (!enabled) return;

  try {
    const text = clipboard.readText();
    if (text && text.trim().length > 0 && text !== _lastText) {
      _lastText = text;
      const limit = desktopSettings.get('clipboardHistoryLimit') || 20;

      // Add to ring buffer
      _history.unshift({ text, timestamp: Date.now() });
      if (_history.length > limit) {
        _history = _history.slice(0, limit);
      }

      console.log(`[BackgroundService] New clipboard item captured (${text.length} chars)`);

      // Broadcast to renderer
      const win = _windowManager?.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('desktop:clipboard-changed', { text, history: _history });
      }
    }
  } catch (err) {
    console.warn('[BackgroundService] Clipboard read error:', err.message);
  }
}

function getHistory() {
  return [..._history];
}

function clearHistory() {
  _history = [];
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  console.log('[BackgroundService] Clipboard monitor service stopped');
}

function getHealth() {
  return {
    name: 'clipboardMonitor',
    status: _timer ? 'running' : 'stopped',
    itemsCount: _history.length,
  };
}

module.exports = {
  start,
  stop,
  getHistory,
  clearHistory,
  getHealth,
};
