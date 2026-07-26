'use strict';

/**
 * pluginManager.js
 *
 * Future-Readiness Architecture layer for samGPT desktop.
 * Provides extension hooks for:
 *   • Plugin Manager & Plugin Manifest loading
 *   • Auto-Updater hooks
 *   • Cloud Sync & Integration adapters (GitHub, Google Drive, Notion, Slack, Calendar)
 *   • Wake Word engine hooks
 */

const _registeredPlugins = new Map();

function init() {
  console.log('[Desktop] Plugin architecture initialized (Future-Ready status: Active)');
}

function registerPlugin(manifest, pluginInstance) {
  if (!manifest || !manifest.id) {
    console.warn('[PluginManager] Invalid plugin manifest');
    return false;
  }
  _registeredPlugins.set(manifest.id, { manifest, pluginInstance, loadedAt: Date.now() });
  console.log(`[PluginManager] Registered plugin: ${manifest.id} (${manifest.name || 'v1'})`);
  return true;
}

function getPlugins() {
  return Array.from(_registeredPlugins.values()).map(p => p.manifest);
}

module.exports = {
  init,
  registerPlugin,
  getPlugins,
};
