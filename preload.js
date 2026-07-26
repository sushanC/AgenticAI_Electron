'use strict';

/**
 * preload.js — samGPT contextBridge
 *
 * Exposes TWO top-level APIs to the renderer:
 *
 *   window.electronAPI  — backward-compatible (get-user-data-path)
 *   window.desktopAPI   — unified desktop + dev-console bridge
 *
 * Rules:
 *   • No raw Electron APIs leak into React components
 *   • Every method is typed via JSDoc for IDE autocompletion
 *   • Methods that can fail return { ok: boolean, error?: string }
 *   • on*() methods return an unsubscribe function to prevent leaks
 */

const { contextBridge, ipcRenderer } = require('electron');

// ─── Backward-compat API ──────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
});

// ─── Unified Desktop API ──────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('desktopAPI', {

  // ── Metadata ──────────────────────────────────────────────────────────────

  /** True in any Electron renderer context */
  isElectron: true,

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

  // ── Voice Assistant ───────────────────────────────────────────────────────

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

  // ── Developer Console ─────────────────────────────────────────────────────

  /**
   * Fetch the full ring-buffer history (called when console first opens).
   * @returns {Promise<object[]>}
   */
  getHistory: () => ipcRenderer.invoke('dev:get-history'),

  /**
   * Clear all developer console history.
   */
  clearHistory: () => ipcRenderer.send('dev:clear'),

  // ── Event subscriptions (Main → Renderer) ─────────────────────────────────
  // Every on*() method returns an unsubscribe function: () => void

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
   * Fires when main wants to open the Voice overlay.
   * @param {() => void} cb
   * @returns {() => void} unsubscribe
   */
  onOpenVoiceOverlay: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:open-voice-overlay', handler);
    return () => ipcRenderer.removeListener('desktop:open-voice-overlay', handler);
  },

  /**
   * Quick Ask window: fires when a text payload should be sent to main chat.
   * @param {(text: string) => void} cb
   * @returns {() => void} unsubscribe
   */
  onOpenQuickAsk: (cb) => {
    const handler = (_e, text) => cb(text);
    ipcRenderer.on('desktop:open-quick-ask', handler);
    return () => ipcRenderer.removeListener('desktop:open-quick-ask', handler);
  },

  /**
   * Fires when a quick-action shortcut is invoked (tray menu / shortcut).
   * @param {(actionId: string) => void} cb
   * @returns {() => void} unsubscribe
   */
  onQuickAction: (cb) => {
    const handler = (_e, actionId) => cb(actionId);
    ipcRenderer.on('desktop:quick-action', handler);
    return () => ipcRenderer.removeListener('desktop:quick-action', handler);
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

  /**
   * Listen for state changes (e.g. listening, processing, speaking, idle)
   * @param {(payload: { state: string, text?: string, reply?: string, error?: string }) => void} cb
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

  /**
   * Fires when the developer console should be opened or toggled.
   * @param {() => void} cb
   * @returns {() => void} unsubscribe
   */
  onOpenDeveloperConsole: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:open-developer-console', handler);
    return () => ipcRenderer.removeListener('desktop:open-developer-console', handler);
  },

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

  // ── Desktop Screenshot & OCR Workflow ────────────────────────────────────

  /** Capture desktop screen / window / region for OCR & AI analysis */
  captureScreenshot: (opts) => ipcRenderer.invoke('desktop:capture-screenshot', opts),

  /** Fires when a screenshot is captured via hotkey */
  onScreenshotCaptured: (cb) => {
    const handler = (_e, res) => cb(res);
    ipcRenderer.on('desktop:screenshot-captured', handler);
    return () => ipcRenderer.removeListener('desktop:screenshot-captured', handler);
  },

  // ── Background Clipboard Intelligence ────────────────────────────────────

  /** Fetch clipboard history buffer */
  getClipboardHistory: () => ipcRenderer.invoke('desktop:get-clipboard-history'),

  /** Clear clipboard history buffer */
  clearClipboardHistory: () => ipcRenderer.send('desktop:clear-clipboard-history'),

  /** Fires when system clipboard content changes */
  onClipboardChanged: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('desktop:clipboard-changed', handler);
    return () => ipcRenderer.removeListener('desktop:clipboard-changed', handler);
  },

  /** Fires when Clipboard Actions overlay is triggered by shortcut */
  onOpenClipboardActions: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:open-clipboard-actions', handler);
    return () => ipcRenderer.removeListener('desktop:open-clipboard-actions', handler);
  },

  // ── Unified Desktop Search ────────────────────────────────────────────────

  /** Search across chats, notes, tasks, PDFs, memory, and commands */
  globalSearch: (query) => ipcRenderer.invoke('desktop:global-search', { query }),

  /** Fires when Global Search overlay is triggered by shortcut */
  onOpenGlobalSearch: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('desktop:open-global-search', handler);
    return () => ipcRenderer.removeListener('desktop:open-global-search', handler);
  },

  // ── Background Services & Session ────────────────────────────────────────

  /** Fetch background services health status */
  getBackgroundHealth: () => ipcRenderer.invoke('desktop:get-background-health'),

  /** Fetch active desktop session state */
  getSession: () => ipcRenderer.invoke('desktop:get-session'),

  /** Save desktop session updates */
  saveSession: (updates) => ipcRenderer.send('desktop:save-session', updates),

  /** Schedule a background task reminder */
  scheduleReminder: (text, dueTime) => ipcRenderer.send('desktop:schedule-reminder', { text, dueTime }),

  /** Fires when a document file is opened from the OS */
  onFileOpenedFromOS: (cb) => {
    const handler = (_e, fileInfo) => cb(fileInfo);
    ipcRenderer.on('desktop:file-opened-from-os', handler);
    return () => ipcRenderer.removeListener('desktop:file-opened-from-os', handler);
  },
});