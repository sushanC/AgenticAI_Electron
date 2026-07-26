'use strict';

/**
 * reminderSchedulerService.js
 *
 * Background Reminder Scheduler service.
 * Periodically checks for upcoming task reminders and displays native notifications.
 */

const notificationManager = require('../notifications/notificationManager');

let _timer = null;
let _tasksQueue = [];

function start({ windowManager, notificationManager }) {
  _timer = setInterval(_checkReminders, 15000); // Check every 15s
  console.log('[BackgroundService] Reminder scheduler service started');
}

function _checkReminders() {
  const now = Date.now();
  const due = _tasksQueue.filter(t => t.dueTime <= now && !t.notified);

  for (const item of due) {
    item.notified = true;
    notificationManager.showReminder(item.text);
  }

  // Remove notified items
  _tasksQueue = _tasksQueue.filter(t => !t.notified);
}

function scheduleReminder(text, dueTime) {
  _tasksQueue.push({ id: Date.now().toString(), text, dueTime, notified: false });
  console.log(`[BackgroundService] Reminder scheduled: "${text}" in ${Math.round((dueTime - Date.now()) / 1000)}s`);
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  console.log('[BackgroundService] Reminder scheduler service stopped');
}

function getHealth() {
  return {
    name: 'reminderScheduler',
    status: _timer ? 'running' : 'stopped',
    pendingReminders: _tasksQueue.length,
  };
}

module.exports = {
  start,
  stop,
  scheduleReminder,
  getHealth,
};
