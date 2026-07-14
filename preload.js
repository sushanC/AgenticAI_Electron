'use strict';

/**
 * preload.js — samGPT contextBridge
 *
 * Exposes THREE top-level APIs to the renderer:
 *
 *   window.electronAPI  — backward-compatible (get-user-data-path)
 *   window.desktopAPI   — full Phase 1 desktop feature bridge
 *   window.devConsoleAPI — Developer Console event bridge (Electron-only)
 *
 * Rules:
 *   • No raw Electron APIs leak into React components
 *   • Every method is typed via JSDoc for IDE autocompletion
 *   • Methods that can fail return { ok: boolean, error?: string }
 *   • on*() methods return an unsubscribe function to prevent leaks
 */

const { contextBridge, ipcRenderer } = require('electron');

// ─── Backward-compat API (existing) ──────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
});

// ─── Desktop API ──────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('desktopAPI', {

  // ── Settings ─────────────────────────────────────────────────────────────

  /** @returns {Promise<object>} All desktop settings */
  getSettings: () => ipcRenderer.invoke('desktop:get-settings'),

  /**
   * Persist one or more setting values.
   * @param {object} updates
   * @returns {Promise<{ ok: boolean }>}
   */
  saveSettings: (updates) => ipcRenderer.invoke('desktop:save-settings', updates),

  // ── Command Palette ───────────────────────────────────────────────────────

  /**
   * Fetch all registered commands (safe, serialisable).
   * @returns {Promise<{ id: string, label: string, icon: string, description: string }[]>}
   */
  getCommands: () => ipcRenderer.invoke('desktop:get-commands'),

  /**
   * Execute a command by id.
   * @param {string} id
   * @returns {Promise<{ ok: boolean }>}
   */
  executeCommand: (id) => ipcRenderer.invoke('desktop:execute-command', { id }),

  // ── Notifications ─────────────────────────────────────────────────────────

  /**
   * Show a native OS notification.
   * @param {{ title: string, body: string, urgency?: string, type?: string }} opts
   */
  notify: (opts) => ipcRenderer.send('desktop:notify', opts),

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  /**
   * Report dropped files to main process for filtering and relay.
   * @param {{ path: string, name: string, ext: string, size: number }[]} files
   */
  reportDroppedFiles: (files) => ipcRenderer.send('desktop:files-dropped', files),

  // ── Quick Ask window ──────────────────────────────────────────────────────

  /** Hide the Quick Ask window (called on ESC) */
  closeQuickAsk: () => ipcRenderer.send('desktop:quick-ask-close'),

  /**
   * Resize the Quick Ask window vertically as content expands.
   * @param {number} height — Desired height in logical pixels
   */
  resizeQuickAsk: (height) => ipcRenderer.send('desktop:quick-ask-resize', { height }),

  // ── Window management ─────────────────────────────────────────────────────

  /** Minimize the main window to tray programmatically */
  minimizeToTray: () => ipcRenderer.send('desktop:window-minimize-to-tray'),

  // ── Event subscriptions (Main → Renderer) ─────────────────────────────────

  /**
   * Fires when main process wants to start a new chat.
   * @param {() => void} cb
   * @returns {() => void} unsubscribe
   */
  onNewChat: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:new-chat', handler);
    return () => ipcRenderer.removeListener('desktop:new-chat', handler);
  },

  /**
   * Fires when main process wants to navigate to a page.
   * @param {(payload: { page: string }) => void} cb
   * @returns {() => void} unsubscribe
   */
  onNavigate: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('desktop:navigate', handler);
    return () => ipcRenderer.removeListener('desktop:navigate', handler);
  },

  /**
   * Fires when the command palette shortcut is triggered.
   * @param {() => void} cb
   * @returns {() => void} unsubscribe
   */
  onOpenCommandPalette: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:open-command-palette', handler);
    return () => ipcRenderer.removeListener('desktop:open-command-palette', handler);
  },

  /**
   * Fires when main wants to focus the chat input field.
   * @param {() => void} cb
   * @returns {() => void} unsubscribe
   */
  onFocusChatInput: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:focus-chat-input', handler);
    return () => ipcRenderer.removeListener('desktop:focus-chat-input', handler);
  },

  /**
   * Fires after drag-drop files have been filtered by main process.
   * @param {(files: object[]) => void} cb
   * @returns {() => void} unsubscribe
   */
  onFilesAccepted: (cb) => {
    const handler = (_e, files) => cb(files);
    ipcRenderer.on('desktop:files-accepted', handler);
    return () => ipcRenderer.removeListener('desktop:files-accepted', handler);
  },

  /**
   * Quick Ask window: fires when main wants the input to receive focus.
   * @param {() => void} cb
   * @returns {() => void} unsubscribe
   */
  onQuickAskFocus: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('quick-ask:focus', handler);
    return () => ipcRenderer.removeListener('quick-ask:focus', handler);
  },

  // ── Voice Assistant API ──────────────────────────────────────────────────

  /** Start recording user speech */
  startListening: () => ipcRenderer.send('desktop:start-listening'),

  /** Cancel active user recording */
  cancelListening: () => ipcRenderer.send('desktop:cancel-listening'),

  /** Stop speaking queue and current audio playback */
  stopSpeaking: () => ipcRenderer.send('desktop:stop-speaking'),

  /** Pause active audio playback */
  pauseSpeaking: () => ipcRenderer.send('desktop:pause-speaking'),

  /** Resume paused audio playback */
  resumeSpeaking: () => ipcRenderer.send('desktop:resume-speaking'),

  /** Toggle the voice assistant activation state */
  toggleVoice: () => ipcRenderer.send('desktop:toggle-voice'),

  /** Notify backend that settings were saved */
  voiceSettingsChanged: () => ipcRenderer.send('desktop:voice-settings-change'),

  /**
   * Listen for state changes (e.g. listening, processing, speaking, idle)
   * @param {(payload: { state: string, oldState: string }) => void} cb
   * @returns {() => void} unsubscribe
   */
  onVoiceStateChange: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('desktop:voice-state-change', handler);
    return () => ipcRenderer.removeListener('desktop:voice-state-change', handler);
  },

  /**
   * Listen for voice dashboard commands from the main process
   * @param {(payload: { action: string }) => void} cb
   * @returns {() => void} unsubscribe
   */
  onVoiceCommand: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('desktop:voice-command', handler);
    return () => ipcRenderer.removeListener('desktop:voice-command', handler);
  },

  /**
   * Listen for global keyboard shortcut toggle command
   * @param {() => void} cb
   * @returns {() => void} unsubscribe
   */
  onToggleVoice: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:toggle-voice', handler);
    return () => ipcRenderer.removeListener('desktop:toggle-voice', handler);
  },

  // ── Utility ───────────────────────────────────────────────────────────────

  /** True in any Electron renderer context */
  isElectron: true,
});

// ─── Developer Console API ────────────────────────────────────────────────

contextBridge.exposeInMainWorld('devConsoleAPI', {

  /**
   * Subscribe to incoming DevEvents pushed by the main process.
   * @param {(event: object) => void} cb
   * @returns {() => void} unsubscribe
   */
  onDevEvent: (cb) => {
    const handler = (_e, event) => cb(event);
    ipcRenderer.on('dev:event', handler);
    return () => ipcRenderer.removeListener('dev:event', handler);
  },

  /**
   * Fetch the full ring-buffer history (called when console first opens).
   * @returns {Promise<object[]>}
   */
  getHistory: () => ipcRenderer.invoke('dev:get-history'),

  /**
   * Clear all developer console history.
   * @returns {void}
   */
  clearHistory: () => ipcRenderer.send('dev:clear'),

  /**
   * Subscribe to the "open developer console" signal (shortcut / command palette).
   * @param {() => void} cb
   * @returns {() => void} unsubscribe
   */
  onOpenDeveloperConsole: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:open-developer-console', handler);
    return () => ipcRenderer.removeListener('desktop:open-developer-console', handler);
  },
});