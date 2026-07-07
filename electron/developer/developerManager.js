'use strict';

/**
 * developerManager.js
 *
 * Bootstrap and IPC bridge for the samGPT Developer Console.
 *
 * Responsibilities:
 *   1. Subscribe to devEventBus (fed by main.js backend IPC listener)
 *   2. Accumulate events in developerLogger
 *   3. Forward each event to the renderer via mainWindow.webContents.send('dev:event')
 *   4. Handle renderer IPC requests: dev:get-history, dev:clear
 *   5. Relay 'desktop:open-developer-console' to renderer when triggered by
 *      shortcut or command palette
 *
 * IPC channels registered here:
 *   dev:get-history  (handle) Renderer → Main → returns history array
 *   dev:clear        (on)     Renderer → Main → clears logger
 *
 * IPC channels sent by this module:
 *   dev:event                Main → Renderer → single DevEvent
 *   desktop:open-developer-console  Main → Renderer → open the console overlay
 */

const devEventBus       = require('./devEventBus');
const developerLogger = require('./developerLogger');

// ─── State ────────────────────────────────────────────────────────────────────

let _windowManager = null;
let _initialized   = false;

// ─── All event types the bus can emit ────────────────────────────────────────

const ALL_EVENT_TYPES = [
  'IntentDetected',
  'MemoryRetrieved',
  'PromptBuilt',
  'ModelSelected',
  'ProviderCalled',
  'ProviderSucceeded',
  'ProviderFailed',
  'RetryStarted',
  'RetryFinished',
  'FallbackStarted',
  'ToolStarted',
  'ToolFinished',
  'EmailSent',
  'TaskCreated',
  'NotificationSent',
  'PDFIndexed',
  'ResearchCompleted',
  'FullRequestSummary',
];

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {{ windowManager: object }} deps
 */
function init({ windowManager }) {
  if (_initialized) return;
  _windowManager = windowManager;
  _initialized   = true;

  // ── Subscribe to all event types from the bus ──────────────────────────
  for (const type of ALL_EVENT_TYPES) {
    devEventBus.on(type, (event) => {
      // 1. Log into ring buffer
      developerLogger.push(event);

      // 2. Forward to renderer (fire-and-forget, non-blocking)
      _sendToRenderer('dev:event', event);
    });
  }

  console.log('[Developer] Console manager initialized');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Open the developer console overlay in the renderer.
 * Called by shortcutManager and commandPaletteManager.
 */
function openConsole() {
  const win = _windowManager?.getMainWindow();
  if (!win) return;
  _windowManager.showMainWindow();
  win.webContents.send('desktop:open-developer-console');
  console.log('[Developer] Console opened');
}

function destroy() {
  for (const type of ALL_EVENT_TYPES) {
    devEventBus.removeAllListeners(type);
  }
  try { ipcMain.removeHandler('dev:get-history'); } catch { /* already removed */ }
  _initialized = false;
  console.log('[Developer] Console manager destroyed');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _sendToRenderer(channel, payload) {
  try {
    const win = _windowManager?.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  } catch {
    // Never crash the app due to dev tooling
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = { init, openConsole, destroy };
