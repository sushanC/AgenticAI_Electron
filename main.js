const {
  app,
  BrowserWindow
} = require("electron");

function createWindow() {

  const win =
    new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload:
          __dirname +
          "/preload.js"
      }
    });

  win.loadURL(
    "http://localhost:5173"
  );
}

app.whenReady().then(
  createWindow
);