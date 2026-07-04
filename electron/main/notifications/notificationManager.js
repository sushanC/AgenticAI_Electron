'use strict';

/**
 * notificationManager.js
 *
 * Thin, event-driven wrapper over Electron's native Notification API.
 *
 * Design decisions:
 *   • Never shows HTML popups — always native OS notifications
 *   • Falls back silently when notifications are denied or unsupported
 *   • Each notification type has a named convenience method so callers
 *     never hardcode strings
 *   • onClick handlers are optional and registered per-notification
 *
 * Future phases can add new event types without changing the core show() method.
 */

const { Notification, nativeImage } = require('electron');
const path = require('path');

// ─── State ────────────────────────────────────────────────────────────────────

let _settings      = null;
let _windowManager = null;
let _supported     = false;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {{ desktopSettings: object, windowManager: object }} deps
 */
function init({ desktopSettings, windowManager }) {
  _settings      = desktopSettings;
  _windowManager = windowManager;
  _supported     = Notification.isSupported();

  if (!_supported) {
    console.warn('[Desktop] Native notifications not supported on this platform');
  } else {
    console.log('[Desktop] Notification manager initialized');
  }
}

// ─── Core Show ────────────────────────────────────────────────────────────────

/**
 * Display a native notification.
 *
 * @param {{ title: string, body: string, urgency?: 'low'|'normal'|'critical', onClick?: () => void }} opts
 */
function show({ title, body, urgency = 'normal', onClick } = {}) {
  if (!_supported) return;

  try {
    const enabled = _settings ? _settings.get('enableNotifications') : true;
    if (!enabled) return;

    const notification = new Notification({
      title,
      body,
      urgency,
      silent:  urgency === 'low',
    });

    if (onClick) {
      notification.on('click', onClick);
    } else {
      // Default: restore main window on click
      notification.on('click', () => {
        _windowManager?.showMainWindow();
      });
    }

    notification.show();
    console.log(`[Desktop] Notification shown: "${title}"`);
  } catch (err) {
    // Notifications must NEVER crash the app
    console.warn('[Desktop] Notification failed silently:', err.message);
  }
}

// ─── Convenience Methods ──────────────────────────────────────────────────────

function showEmailSent(recipient) {
  show({
    title: 'Email Sent ✉️',
    body:  `Your email to ${recipient} was sent successfully.`,
  });
}

function showTaskCreated(taskTitle) {
  show({
    title: 'Task Created ✅',
    body:  taskTitle || 'A new task has been added to your list.',
  });
}

function showReminder(text) {
  show({
    title:   'Reminder 🔔',
    body:    text || 'You have an upcoming reminder.',
    urgency: 'normal',
  });
}

function showResearchCompleted(topic) {
  show({
    title: 'Research Completed 🔬',
    body:  topic ? `Research on "${topic}" is ready.` : 'Your research task is complete.',
  });
}

function showPDFIndexed(filename) {
  show({
    title: 'PDF Indexed 📄',
    body:  `"${filename}" is ready for Q&A.`,
  });
}

function showDownloadCompleted(filename) {
  show({
    title: 'Download Complete ⬇️',
    body:  filename || 'Your download has finished.',
  });
}

function showMemorySaved(fact) {
  show({
    title: 'Memory Saved 🧠',
    body:  fact ? `Saved: "${fact}"` : 'A new fact has been stored in memory.',
    urgency: 'low',
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  init,
  show,
  showEmailSent,
  showTaskCreated,
  showReminder,
  showResearchCompleted,
  showPDFIndexed,
  showDownloadCompleted,
  showMemorySaved,
};
