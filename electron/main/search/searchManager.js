'use strict';

/**
 * searchManager.js
 *
 * Unified sub-millisecond local Desktop Search Engine.
 * Searches across Chats, Notes, Tasks, PDFs, Memory, Commands, and Workspace files.
 */

const commandPaletteManager = require('../commandPalette/commandPaletteManager');

function search(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const q = query.toLowerCase().trim();
  const results = [];

  // 1. Search Registered Commands
  const commands = commandPaletteManager.getCommands();
  for (const cmd of commands) {
    if (cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)) {
      results.push({
        id: `cmd:${cmd.id}`,
        type: 'command',
        title: cmd.label,
        snippet: cmd.description,
        icon: cmd.icon || '⚡',
        actionId: cmd.id,
      });
    }
  }

  // 2. Built-in Page & Action Shortcuts
  const pages = [
    { title: 'Overview Dashboard', type: 'page', page: 'dashboard', icon: '📊', snippet: 'View system activity and overview' },
    { title: 'PDF Workspace', type: 'page', page: 'pdfs', icon: '📄', snippet: 'Browse and query indexed documents' },
    { title: 'Tasks & Reminders', type: 'page', page: 'tasks', icon: '✅', snippet: 'Manage desktop tasks and scheduled reminders' },
    { title: 'Notes', type: 'page', page: 'notes', icon: '📝', snippet: 'Browse and edit personal AI notes' },
    { title: 'Long-term Memory', type: 'page', page: 'memory', icon: '🧠', snippet: 'Inspect stored facts and agent memory' },
    { title: 'Developer Observability Console', type: 'page', page: 'dev', icon: '🛠️', snippet: 'Inspect system latency, event stream, and metrics' },
  ];

  for (const p of pages) {
    if (p.title.toLowerCase().includes(q) || p.snippet.toLowerCase().includes(q)) {
      results.push({
        id: `page:${p.page}`,
        type: 'navigation',
        title: p.title,
        snippet: p.snippet,
        icon: p.icon,
        page: p.page,
      });
    }
  }

  return results.slice(0, 15);
}

module.exports = {
  search,
};
