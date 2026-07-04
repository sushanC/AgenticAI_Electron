'use strict';

/**
 * desktopSettings.js
 *
 * Lightweight settings store backed by a JSON file in Electron's userData
 * directory. Designed as a singleton — call init() once on app start.
 *
 * Schema is defined in DEFAULTS. All unknown keys from disk are ignored,
 * missing keys are filled in from DEFAULTS, ensuring forward-compatibility
 * across versions.
 *
 * Future phases (Phase 2+) can add keys to DEFAULTS without any migration logic.
 */

const { app } = require('electron');
const path    = require('path');
const fs      = require('fs');

// ─── Schema ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
  /** Minimize window to tray on close instead of quitting */
  minimizeToTray: true,

  /** Show native OS notifications for AI events */
  enableNotifications: true,

  /** Register global shortcut keys */
  enableGlobalShortcut: true,

  /** Accept file drag & drop into the chat window */
  enableDragDrop: true,

  /** Launch samGPT when the OS boots (best-effort on Linux) */
  launchAtLogin: false,

  /** Accelerator string for the Quick Ask floating window */
  shortcutQuickAsk: 'CmdOrCtrl+Space',

  /** Accelerator string for the Command Palette overlay */
  shortcutCommandPalette: 'CmdOrCtrl+K',
};

// ─── State ───────────────────────────────────────────────────────────────────

let _settings     = { ...DEFAULTS };
let _settingsPath = null;
let _initialized  = false;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load settings from disk. Must be called once, inside app.whenReady().
 */
function init() {
  if (_initialized) return;

  try {
    _settingsPath = path.join(app.getPath('userData'), 'samgpt-desktop-settings.json');

    if (fs.existsSync(_settingsPath)) {
      const raw    = fs.readFileSync(_settingsPath, 'utf8');
      const parsed = JSON.parse(raw);

      // Merge: DEFAULTS provide missing keys, disk overrides known keys
      _settings = { ...DEFAULTS };
      for (const key of Object.keys(DEFAULTS)) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          _settings[key] = parsed[key];
        }
      }

      console.log('[Desktop] Settings loaded from', _settingsPath);
    } else {
      _persist(); // Write defaults to disk on first run
      console.log('[Desktop] Settings initialized with defaults at', _settingsPath);
    }
  } catch (err) {
    console.warn('[Desktop] Failed to load settings, using defaults:', err.message);
    _settings = { ...DEFAULTS };
  }

  _initialized = true;
}

/**
 * Read one setting or all settings.
 * @param {string} [key] — If provided, returns that value; otherwise returns a copy of all settings.
 */
function get(key) {
  return key !== undefined ? _settings[key] : { ..._settings };
}

/**
 * Write one or more settings and persist to disk.
 * @param {Partial<typeof DEFAULTS>} updates
 */
function set(updates) {
  // Only allow known keys to prevent schema pollution
  for (const key of Object.keys(updates)) {
    if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      _settings[key] = updates[key];
    }
  }
  _persist();
}

/** The full schema with its default values (for UI rendering). */
function getDefaults() {
  return { ...DEFAULTS };
}

// ─── Private ──────────────────────────────────────────────────────────────────

function _persist() {
  if (!_settingsPath) return;
  try {
    fs.writeFileSync(_settingsPath, JSON.stringify(_settings, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Desktop] Failed to persist settings:', err.message);
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = { init, get, set, getDefaults, DEFAULTS };
