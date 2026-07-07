'use strict';

/**
 * shortcutManager.js
 *
 * Registers and manages global keyboard shortcuts for samGPT.
 *
 * Design:
 *   • Shortcuts are defined in a registry array — adding a new shortcut
 *     in Phase 2/3/4 is a single array.push() with no switch statements
 *   • Each shortcut has an id, accelerator, and handler function
 *   • Registration failures are non-fatal: a warning is logged and the
 *     shortcut is skipped; the app continues normally
 *   • All shortcuts are released when the app is about to quit
 *
 * Shortcut precedence:
 *   CmdOrCtrl+Space — Quick Ask floating window
 *   CmdOrCtrl+K     — Command Palette overlay
 */

const { globalShortcut, app } = require('electron');

// ─── State ────────────────────────────────────────────────────────────────────

let _windowManager  = null;
let _desktopSettings = null;
let _registered     = [];   // accelerator strings that were successfully registered

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * @typedef {{ id: string, accelerator: string, handler: () => void }} ShortcutEntry
 */

/** @returns {ShortcutEntry[]} */
function _buildRegistry() {
  return [
    {
      id:          'quick-ask',
      accelerator: _desktopSettings?.get('shortcutQuickAsk') || 'CmdOrCtrl+Space',
      handler() {
        const win = _windowManager.getQuickAskWindow();
        if (win && win.isVisible()) {
          win.focus();
        } else {
          _windowManager.showQuickAsk();
        }
        console.log('[Desktop] Shortcut: Quick Ask triggered');
      },
    },
    {
      id:          'command-palette',
      accelerator: _desktopSettings?.get('shortcutCommandPalette') || 'CmdOrCtrl+K',
      handler() {
        const main = _windowManager.getMainWindow();
        if (!main) return;
        _windowManager.showMainWindow();
        main.webContents.send('desktop:open-command-palette');
        console.log('[Desktop] Shortcut: Command Palette triggered');
      },
    },
    // Phase 2 shortcuts — Developer Console
    {
      id:          'developer-console',
      accelerator: 'CmdOrCtrl+Shift+D',
      handler() {
        const developerManager = require('../developer/developerManager');
        developerManager.openConsole();
        console.log('[Desktop] Shortcut: Developer Console triggered');
      },
    },
  ];
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {{ windowManager: object, desktopSettings: object }} deps
 */
function init({ windowManager, desktopSettings }) {
  _windowManager   = windowManager;
  _desktopSettings = desktopSettings;

  const enabled = desktopSettings.get('enableGlobalShortcut');
  if (!enabled) {
    console.log('[Desktop] Global shortcuts disabled by settings');
    return;
  }

  const registry = _buildRegistry();

  for (const entry of registry) {
    try {
      const ok = globalShortcut.register(entry.accelerator, entry.handler);
      if (ok) {
        _registered.push(entry.accelerator);
        console.log(`[Desktop] Shortcut registered: ${entry.id} (${entry.accelerator})`);
      } else {
        console.warn(
          `[Desktop] Shortcut "${entry.accelerator}" already registered by another app — skipped`
        );
      }
    } catch (err) {
      console.warn(
        `[Desktop] Shortcut registration failed for "${entry.accelerator}":`,
        err.message
      );
    }
  }

  // Release all shortcuts when the app quits
  app.on('will-quit', destroy);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Re-register shortcuts (e.g. after user changes key bindings in Settings).
 * @param {{ windowManager: object, desktopSettings: object }} deps
 */
function reinit(deps) {
  destroy();
  init(deps);
}

function destroy() {
  for (const accelerator of _registered) {
    try {
      globalShortcut.unregister(accelerator);
    } catch { /* ignore */ }
  }
  _registered = [];
  console.log('[Desktop] Global shortcuts released');
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = { init, reinit, destroy };
