'use strict';

/**
 * commandPaletteManager.js
 *
 * Manages the Command Palette command registry and execution.
 *
 * Architecture:
 *   • Commands are objects: { id, label, icon, description, handler }
 *   • registerCommand() adds a command — no switch statements anywhere
 *   • getCommands() returns a serialisable list (no functions) for IPC
 *   • executeCommand(id) dispatches to the registered handler
 *   • Phase 2/3/4: each new feature registers its own commands on init
 *
 * The palette UI itself lives in the renderer (CommandPalette.jsx).
 * This module manages state and handles main-process-side execution.
 */

// ─── State ────────────────────────────────────────────────────────────────────

let _windowManager = null;

/** @type {Map<string, { id: string, label: string, icon: string, description: string, handler: () => void }>} */
const _registry = new Map();

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {{ windowManager: object }} deps
 */
function init({ windowManager }) {
  _windowManager = windowManager;
  _registerBuiltInCommands();
  console.log(`[Desktop] Command Palette initialized with ${_registry.size} commands`);
}

// ─── Built-in Commands ────────────────────────────────────────────────────────

function _registerBuiltInCommands() {
  const cmds = [
    {
      id:          'new-chat',
      label:       'New Chat',
      icon:        '💬',
      description: 'Start a fresh conversation',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:new-chat');
      },
    },
    {
      id:          'upload-pdf',
      label:       'Upload PDF',
      icon:        '📄',
      description: 'Open the PDF workspace and upload a document',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:navigate', { page: 'pdfs' });
      },
    },
    {
      id:          'open-tasks',
      label:       'Open Tasks',
      icon:        '✅',
      description: 'View your task list',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:navigate', { page: 'tasks' });
      },
    },
    {
      id:          'open-notes',
      label:       'Open Notes',
      icon:        '📝',
      description: 'View and edit your notes',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:navigate', { page: 'notes' });
      },
    },
    {
      id:          'search-memory',
      label:       'Search Memory',
      icon:        '🧠',
      description: 'Browse stored facts and long-term memory',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:navigate', { page: 'memory' });
      },
    },
    {
      id:          'open-dashboard',
      label:       'Open Dashboard',
      icon:        '📊',
      description: 'View the overview dashboard',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:navigate', { page: 'dashboard' });
      },
    },
    {
      id:          'settings',
      label:       'Settings',
      icon:        '⚙️',
      description: 'Configure samGPT and desktop preferences',
      handler() {
        _windowManager.showMainWindow();
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:navigate', { page: 'settings' });
      },
    },
    {
      id:          'dev-console',
      label:       'Developer Console',
      icon:        '🛠️',
      description: 'Open the samGPT AI observability dashboard',
      handler() {
        const developerManager = require('../developer/developerManager');
        developerManager.openConsole();
      },
    },
    {
      id:          'focus-chat',
      label:       'Focus Chat Input',
      icon:        '⌨️',
      description: 'Move cursor to the message input',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:focus-chat-input');
      },
    },
    {
      id:          'clear-conversation',
      label:       'Clear Conversation',
      icon:        '🗑️',
      description: 'Erase the current chat history',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:new-chat');
      },
    },
    {
      id:          'quit',
      label:       'Quit samGPT',
      icon:        '⏻',
      description: 'Close the application completely',
      handler() {
        const { app } = require('electron');
        app.isQuitting = true;
        app.quit();
      },
    },
    {
      id:          'start-voice-conv',
      label:       'Start Voice Conversation',
      icon:        '🎙️',
      description: 'Start continuous voice assistant interaction',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:voice-command', { action: 'start-conversation' });
      },
    },
    {
      id:          'stop-voice-conv',
      label:       'Stop Voice Conversation',
      icon:        '🔇',
      description: 'Stop active voice mode and speaking queue',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:voice-command', { action: 'stop-conversation' });
      },
    },
    {
      id:          'push-to-talk',
      label:       'Push To Talk',
      icon:        '🗣️',
      description: 'Activate voice in Push To Talk mode',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:voice-command', { action: 'push-to-talk' });
      },
    },
    {
      id:          'mute-voice',
      label:       'Mute Voice',
      icon:        '🔇',
      description: 'Mute the audio feedback from assistant',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:voice-command', { action: 'mute' });
      },
    },
    {
      id:          'unmute-voice',
      label:       'Unmute Voice',
      icon:        '🔊',
      description: 'Unmute the audio feedback from assistant',
      handler() {
        const win = _windowManager.getMainWindow();
        if (win) win.webContents.send('desktop:voice-command', { action: 'unmute' });
      },
    },
  ];

  for (const cmd of cmds) {
    _registry.set(cmd.id, cmd);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a new command (Phase 2/3/4 extension point).
 * Overwrites an existing command if the same id is used.
 *
 * @param {{ id: string, label: string, icon: string, description: string, handler: () => void }} cmd
 */
function registerCommand(cmd) {
  if (!cmd.id || !cmd.label || typeof cmd.handler !== 'function') {
    console.warn('[Desktop] registerCommand: invalid command structure', cmd);
    return;
  }
  _registry.set(cmd.id, cmd);
  console.log(`[Desktop] Command registered: ${cmd.id}`);
}

/**
 * Returns a serialisable list of all commands (safe to send over IPC).
 * @returns {{ id: string, label: string, icon: string, description: string }[]}
 */
function getCommands() {
  return Array.from(_registry.values()).map(({ handler: _h, ...rest }) => rest);
}

/**
 * Execute a command by id.
 * @param {string} id
 * @returns {boolean} — true if command was found and executed
 */
function executeCommand(id) {
  const cmd = _registry.get(id);
  if (!cmd) {
    console.warn(`[Desktop] Unknown command: "${id}"`);
    return false;
  }
  try {
    cmd.handler();
    console.log(`[Desktop] Command executed: ${id}`);
    return true;
  } catch (err) {
    console.error(`[Desktop] Command "${id}" threw an error:`, err.message);
    return false;
  }
}

/**
 * Open the command palette on the main window.
 * Separated from shortcutManager so it can be called from tray or IPC.
 */
function openPalette() {
  _windowManager.showMainWindow();
  const win = _windowManager.getMainWindow();
  if (win) win.webContents.send('desktop:open-command-palette');
}

function destroy() {
  _registry.clear();
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  init,
  registerCommand,
  getCommands,
  executeCommand,
  openPalette,
  destroy,
};
