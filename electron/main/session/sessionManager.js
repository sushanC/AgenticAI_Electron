'use strict';

/**
 * sessionManager.js
 *
 * Persists and restores samGPT desktop session state (active workspace,
 * last page, sidebar state, active chat, voice assistant state) across application restarts.
 */

const desktopSettings = require('../store/desktopSettings');

let _sessionState = {
  lastPage: 'dashboard',
  activeWorkspaceId: null,
  sidebarCollapsed: false,
  activeChatId: null,
  voiceMode: 'idle',
};

function init() {
  try {
    const saved = desktopSettings.get('sessionState');
    if (saved && typeof saved === 'object') {
      _sessionState = { ..._sessionState, ...saved };
    }
    console.log('[Desktop] Session manager initialized with state:', _sessionState);
  } catch (err) {
    console.warn('[Desktop] Session manager init non-fatal warning:', err.message);
  }
}

function getSession() {
  return { ..._sessionState };
}

function updateSession(updates) {
  if (!updates || typeof updates !== 'object') return;
  _sessionState = { ..._sessionState, ...updates };
  desktopSettings.set({ sessionState: _sessionState });
}

module.exports = {
  init,
  getSession,
  updateSession,
};
