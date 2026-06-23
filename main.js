const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let backend;
function startBackend() {

  backend = spawn(
    "node",
    ["server.js"],
    {
      cwd: "/home/sushan_acharya/Documents/Personal Agent/Agentic-Ai"
    }
  );

  backend.stdout.on(
    "data",
    data => {
      console.log(
        `BACKEND: ${data}`
      );
    }
  );

  backend.stderr.on(
    "data",
    data => {
      console.error(
        `BACKEND ERROR: ${data}`
      );
    }
  );

  backend.on(
    "close",
    code => {
      console.log(
        `Backend exited with code ${code}`
      );
    }
  );

  backend.on(
    "error",
    err => {
      console.error(
        "Backend Error:",
        err
      );
    }
  );
}

function createWindow() {

  const win =
    new BrowserWindow({

      width: 1600,
      height: 1000,

      minWidth: 1200,
      minHeight: 800,

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.js"
          )
      }
    });

  win.maximize();

  win.loadFile(
    "/home/sushan_acharya/Documents/Personal Agent/AgenticAI_Frontend/dist/index.html"
  );
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on("before-quit", () => {
  if (backend) backend.kill();
});