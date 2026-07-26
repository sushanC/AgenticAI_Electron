'use strict';

/**
 * backgroundServicesManager.js
 *
 * Orchestrator for all samGPT background services:
 *   1. Clipboard Monitor
 *   2. Reminder Scheduler
 *   3. Background PDF Indexer
 *   4. Memory Optimizer
 *   5. Conversation Summarizer
 *   6. Workspace Sync
 *
 * Each service starts and stops independently, reports health, and fails gracefully.
 */

const clipboardMonitor = require('./clipboardMonitorService');
const reminderScheduler = require('./reminderSchedulerService');
const pdfIndexer = require('./pdfIndexerService');
const memoryOptimizer = require('./memoryOptimizerService');
const conversationSummarizer = require('./conversationSummarizerService');
const workspaceSync = require('./workspaceSyncService');

let _started = false;

function init(deps = {}) {
  if (_started) return;

  _tryStart('clipboardMonitor', () => clipboardMonitor.start(deps));
  _tryStart('reminderScheduler', () => reminderScheduler.start(deps));
  _tryStart('pdfIndexer', () => pdfIndexer.start(deps));
  _tryStart('memoryOptimizer', () => memoryOptimizer.start(deps));
  _tryStart('conversationSummarizer', () => conversationSummarizer.start(deps));
  _tryStart('workspaceSync', () => workspaceSync.start(deps));

  _started = true;
  console.log('[BackgroundServicesManager] All background services initialized');
}

function getHealthReport() {
  return [
    clipboardMonitor.getHealth(),
    reminderScheduler.getHealth(),
    pdfIndexer.getHealth(),
    memoryOptimizer.getHealth(),
    conversationSummarizer.getHealth(),
    workspaceSync.getHealth(),
  ];
}

function destroy() {
  _tryStop('clipboardMonitor', () => clipboardMonitor.stop());
  _tryStop('reminderScheduler', () => reminderScheduler.stop());
  _tryStop('pdfIndexer', () => pdfIndexer.stop());
  _tryStop('memoryOptimizer', () => memoryOptimizer.stop());
  _tryStop('conversationSummarizer', () => conversationSummarizer.stop());
  _tryStop('workspaceSync', () => workspaceSync.stop());

  _started = false;
  console.log('[BackgroundServicesManager] All background services stopped');
}

function _tryStart(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[BackgroundServicesManager] Service "${name}" failed to start:`, err.message);
  }
}

function _tryStop(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[BackgroundServicesManager] Service "${name}" failed to stop:`, err.message);
  }
}

module.exports = {
  init,
  getHealthReport,
  destroy,
  clipboardMonitor,
  reminderScheduler,
  pdfIndexer,
};
