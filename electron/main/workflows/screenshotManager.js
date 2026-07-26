'use strict';

/**
 * screenshotManager.js
 *
 * Native Desktop Screenshot & OCR Workflow engine for samGPT.
 * Supports capturing the full screen, active display, or window,
 * converting image data to base64, saving locally if configured,
 * and dispatching to AI engine or renderer for OCR/Explanation.
 */

const { desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const desktopSettings = require('../store/desktopSettings');

async function captureScreen({ type = 'fullscreen' } = {}) {
  try {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: {
        width: display.size.width || 1920,
        height: display.size.height || 1080,
      },
    });

    if (!sources || sources.length === 0) {
      throw new Error('No capture sources available');
    }

    const primarySource = sources.find(s => s.id.startsWith('screen')) || sources[0];
    const image = primarySource.thumbnail;
    const dataUrl = image.toDataURL();

    // Optionally save locally
    const saveLocally = desktopSettings.get('saveScreenshotsLocally');
    let filePath = null;

    if (saveLocally) {
      try {
        const { app } = require('electron');
        const dir = path.join(app.getPath('userData'), 'screenshots');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        filePath = path.join(dir, `screenshot_${Date.now()}.png`);
        fs.writeFileSync(filePath, image.toPNG());
        console.log('[Screenshot] Saved to:', filePath);
      } catch (err) {
        console.warn('[Screenshot] Local save failed non-fatally:', err.message);
      }
    }

    console.log(`[Screenshot] Screen captured (${type})`);
    return {
      ok: true,
      dataUrl,
      filePath,
      width: image.getSize().width,
      height: image.getSize().height,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[Screenshot] Capture error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  captureScreen,
};
