const {
  app,
  BrowserWindow
} = require("electron");

function createWindow() {

  const win =
    new BrowserWindow({

      width: 1600,
      height: 1000,

      minWidth: 1200,
      minHeight: 800,

      webPreferences: {
        preload:
          __dirname +
          "/preload.js"
      }
    });

  win.maximize();

  win.loadURL(
    "http://localhost:5173"
  );

  win.webContents.openDevTools();
}

app.whenReady().then(
  createWindow
);