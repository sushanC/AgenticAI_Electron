'use strict';

/**
 * startupManager.js
 *
 * Premium startup flow orchestrator for samGPT desktop.
 *
 * Sequence:
 *   1. Load desktop settings & session state.
 *   2. Prepare window & tray services.
 *   3. Perform backend IPC handshake.
 *   4. Restore session & reveal app smoothly.
 */

const sessionManager = require('../session/sessionManager');

async function runStartupSequence({ windowManager, trayManager, sendToBackend }) {
  console.log('[Startup] Beginning samGPT desktop startup sequence...');

  // 1. Session Restoration
  sessionManager.init();

  // 2. Perform backend health check/handshake via IPC if sendToBackend is available
  if (typeof sendToBackend === 'function') {
    try {
      sendToBackend({ type: 'HANDSHAKE', payload: { client: 'samGPT-Desktop-Native', version: '1.0.0' } });
      console.log('[Startup] Backend handshake dispatched');
    } catch (err) {
      console.warn('[Startup] Backend handshake warning:', err.message);
    }
  }

  // 3. Update tray status to reflect online & ready state
  if (trayManager && typeof trayManager.updateAIStatus === 'function') {
    trayManager.updateAIStatus('● Online');
  }

  // 4. Notify main window on ready
  const mainWin = windowManager?.getMainWindow();
  if (mainWin && !mainWin.isDestroyed()) {
    const session = sessionManager.getSession();
    mainWin.webContents.send('desktop:navigate', { page: session.lastPage || 'dashboard' });
  }

  console.log('[Startup] samGPT desktop startup sequence completed');
}

module.exports = {
  runStartupSequence,
};
