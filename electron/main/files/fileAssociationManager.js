'use strict';

/**
 * fileAssociationManager.js
 *
 * Desktop file association & native OS open-file handler for samGPT.
 * Processes documents opened directly from the OS file manager or command line arguments.
 */

const { app } = require('electron');
const path = require('path');

let _windowManager = null;

function init({ windowManager }) {
  _windowManager = windowManager;

  // Handle macOS & Linux file open events
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    handleOpenedFile(filePath);
  });

  // Handle process.argv on startup (Windows / Linux)
  const args = process.argv.slice(1);
  for (const arg of args) {
    if (arg && !arg.startsWith('-') && fsExists(arg)) {
      handleOpenedFile(arg);
    }
  }

  console.log('[Desktop] File association manager initialized');
}

function handleOpenedFile(filePath) {
  if (!filePath) return;
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);

  console.log(`[Desktop] Opening file from OS: ${name} (${ext})`);

  const mainWin = _windowManager?.getMainWindow();
  if (mainWin) {
    _windowManager.showMainWindow();
    mainWin.webContents.send('desktop:file-opened-from-os', {
      path: filePath,
      name,
      ext,
    });
  }
}

function fsExists(p) {
  try {
    return require('fs').existsSync(p);
  } catch {
    return false;
  }
}

module.exports = {
  init,
  handleOpenedFile,
};
