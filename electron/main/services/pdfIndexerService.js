'use strict';

/**
 * pdfIndexerService.js
 *
 * Background PDF Indexer service.
 * Manages background PDF processing queue and notifies trayManager / renderer when completed.
 */

let _indexingQueue = [];
let _isProcessing = false;
let _trayManager = null;
let _notificationManager = null;

function start({ trayManager, notificationManager }) {
  _trayManager = trayManager;
  _notificationManager = notificationManager;
  console.log('[BackgroundService] Background PDF indexer service started');
}

function queuePDF(fileInfo) {
  _indexingQueue.push(fileInfo);
  if (_trayManager && typeof _trayManager.updateRecentPDFs === 'function') {
    _trayManager.updateRecentPDFs(_indexingQueue.map(f => ({ label: f.name, path: f.path })));
  }
  if (_notificationManager && typeof _notificationManager.showPDFIndexed === 'function') {
    _notificationManager.showPDFIndexed(fileInfo.name);
  }
}

function stop() {
  _indexingQueue = [];
  console.log('[BackgroundService] Background PDF indexer service stopped');
}

function getHealth() {
  return {
    name: 'pdfIndexer',
    status: 'running',
    queueLength: _indexingQueue.length,
  };
}

module.exports = {
  start,
  stop,
  queuePDF,
  getHealth,
};
