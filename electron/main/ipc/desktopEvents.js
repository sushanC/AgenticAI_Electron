'use strict';

/**
 * desktopEvents.js
 *
 * Central IPC hub for the samGPT desktop layer.
 *
 * ALL ipcMain handlers must be registered here.
 * No other module may call ipcMain.handle/on directly.
 *
 * IPC Event Map:
 * ┌──────────────────────────────────┬───────────────────┬───────────────────────────────────┐
 * │ Channel                          │ Direction         │ Purpose                           │
 * ├──────────────────────────────────┼───────────────────┼───────────────────────────────────┤
 * │ get-user-data-path               │ Renderer → Main   │ Existing: Electron userData path  │
 * │ desktop:get-settings             │ Renderer → Main   │ Load desktop settings             │
 * │ desktop:save-settings            │ Renderer → Main   │ Persist one or more settings      │
 * │ desktop:get-commands             │ Renderer → Main   │ Fetch command palette list        │
 * │ desktop:execute-command          │ Renderer → Main   │ Run a palette command             │
 * │ desktop:notify                   │ Renderer → Main   │ Show a native notification        │
 * │ desktop:files-dropped            │ Renderer → Main   │ Renderer reports dropped files    │
 * │ desktop:quick-ask-close          │ Renderer → Main   │ Hide the Quick Ask window         │
 * │ desktop:quick-ask-resize         │ Renderer → Main   │ Resize Quick Ask to fit content   │
 * │ desktop:window-minimize-to-tray  │ Renderer → Main   │ Programmatic hide to tray         │
 * │ desktop:reload-shortcuts         │ Renderer → Main   │ Re-register after key bind change │
 * │ dev:get-history                  │ Renderer → Main   │ Fetch buffered developer events   │
 * │ dev:clear                        │ Renderer → Main   │ Clear developer event ring buffer │
 * │ ─────────────────────────────── │ ───────────────── │ ─────────────────────────────── │
 * │ desktop:new-chat                 │ Main → Renderer   │ Clear the conversation            │
 * │ desktop:navigate                 │ Main → Renderer   │ Switch to a page                  │
 * │ desktop:open-command-palette     │ Main → Renderer   │ Show palette overlay              │
 * │ desktop:focus-chat-input         │ Main → Renderer   │ Focus the message textarea        │
 * │ desktop:open-developer-console   │ Main → Renderer   │ Open developer console overlay    │
 * │ dev:event                        │ Main → Renderer   │ Push a DevEvent to the console    │
 * │ quick-ask:focus                  │ Main → Quick Ask  │ Focus input, reset state          │
 * └──────────────────────────────────┴───────────────────┴───────────────────────────────────┘
 */

const { ipcMain, app } = require('electron');

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   windowManager:        object,
 *   trayManager:          object,
 *   notificationManager:  object,
 *   commandPaletteManager: object,
 *   dragDropManager:      object,
 *   desktopSettings:      object,
 *   shortcutManager:      object,
 * }} deps
 */
function init({
  windowManager,
  trayManager,
  notificationManager,
  commandPaletteManager,
  dragDropManager,
  desktopSettings,
  shortcutManager,
  developerManager,
}) {

  // ── Existing handler (keep backward compat) ──────────────────────────────
  ipcMain.handle('get-user-data-path', () => app.getPath('userData'));

  // ── Desktop settings ─────────────────────────────────────────────────────

  ipcMain.handle('desktop:get-settings', () => {
    return desktopSettings.get();
  });

  ipcMain.handle('desktop:save-settings', (_e, updates) => {
    desktopSettings.set(updates);

    // Apply side-effects immediately
    if (Object.prototype.hasOwnProperty.call(updates, 'enableGlobalShortcut')) {
      shortcutManager.reinit({ windowManager, desktopSettings });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'launchAtLogin')) {
      _applyLoginItem(updates.launchAtLogin);
    }

    console.log('[Desktop] Settings saved:', updates);
    return { ok: true };
  });

  // ── Command Palette ───────────────────────────────────────────────────────

  ipcMain.handle('desktop:get-commands', () => {
    return commandPaletteManager.getCommands();
  });

  ipcMain.handle('desktop:execute-command', (_e, { id }) => {
    const ok = commandPaletteManager.executeCommand(id);
    return { ok };
  });

  // ── Native Notifications ─────────────────────────────────────────────────

  ipcMain.on('desktop:notify', (_e, { title, body, urgency, type }) => {
    // Route to named convenience methods when type is known
    switch (type) {
      case 'email-sent':           notificationManager.showEmailSent(body);           break;
      case 'task-created':         notificationManager.showTaskCreated(body);          break;
      case 'reminder':             notificationManager.showReminder(body);             break;
      case 'research-completed':   notificationManager.showResearchCompleted(body);    break;
      case 'pdf-indexed':          notificationManager.showPDFIndexed(body);           break;
      case 'download-completed':   notificationManager.showDownloadCompleted(body);    break;
      case 'memory-saved':         notificationManager.showMemorySaved(body);          break;
      default:                     notificationManager.show({ title, body, urgency }); break;
    }
  });

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  ipcMain.on('desktop:files-dropped', (_e, files) => {
    // files: { path, name, ext, size }[]
    const filtered = dragDropManager.filterDroppedFiles(files);
    if (filtered.length === 0) return;

    const win = windowManager.getMainWindow();
    if (win) {
      // Relay filtered list back to renderer for actual upload handling
      win.webContents.send('desktop:files-accepted', filtered);
    }
    console.log(`[Desktop] ${filtered.length} file(s) dropped:`, filtered.map(f => f.name));
  });

  // ── Quick Ask window controls ─────────────────────────────────────────────

  ipcMain.on('desktop:quick-ask-close', () => {
    windowManager.hideQuickAsk();
  });

  ipcMain.on('desktop:quick-ask-resize', (_e, { height }) => {
    windowManager.resizeQuickAsk(height);
  });

  // ── Main window controls ──────────────────────────────────────────────────

  ipcMain.on('desktop:window-minimize-to-tray', () => {
    windowManager.hideMainWindow();
  });

  ipcMain.on('desktop:reload-shortcuts', () => {
    shortcutManager.reinit({ windowManager, desktopSettings });
    console.log('[Desktop] Shortcuts reloaded');
  });

  // ── Developer Console ────────────────────────────────────────────
  // dev:get-history and dev:clear are registered by developerManager.init().
  // This ensures they are only active when developerManager is initialized.
  // We register the relay here because desktopEvents owns all ipcMain calls.
  ipcMain.handle('dev:get-history', () => {
    const developerLogger = require('../../developer/developerLogger');
    return developerLogger.getHistory();
  });

  ipcMain.on('dev:clear', () => {
    const developerLogger = require('../../developer/developerLogger');
    developerLogger.clear();
    console.log('[Developer] History cleared via IPC');
  });

  console.log('[Desktop] IPC handlers registered');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _applyLoginItem(enabled) {
  try {
    // Best-effort on Linux (works reliably on macOS + Windows)
    app.setLoginItemSettings({ openAtLogin: enabled });
  } catch (err) {
    console.warn('[Desktop] setLoginItemSettings failed (not critical):', err.message);
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = { init };
