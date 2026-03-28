/**
 * Electron Main Process
 * Manages Express.js backend server
 */

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { spawn } = require("child_process");

// Keep global reference for window instance
let mainWindow = null;
let server = null;

// App data directory
const APP_DATA_DIR = path.join(
  app.getPath("userData"),
  "english-reading-helper",
);
const SERVER_PORT = 8000;

/**
 * Create necessary directories
 */
async function ensureDirectories() {
  const dirs = [
    APP_DATA_DIR,
    path.join(APP_DATA_DIR, "uploads"),
    path.join(APP_DATA_DIR, "data"),
    path.join(APP_DATA_DIR, "logs"),
  ];

  for (const dir of dirs) {
    try {
      await fsPromises.mkdir(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    } catch (error) {
      if (error.code !== "EEXIST") {
        console.error(`Failed to create directory: ${dir}`, error);
        throw error;
      }
    }
  }
}

/**
 * Start Express.js server
 */
async function startServer() {
  if (server) {
    console.log("Server already running");
    return true;
  }

  try {
    console.log("Starting Express.js server...");

    const logFile = path.join(APP_DATA_DIR, "logs", "server.log");
    const logStream = fs.createWriteStream(logFile, { flags: "a" });

    server = spawn("node", ["server/app.js"], {
      cwd: __dirname,
      env: {
        ...process.env,
        APP_DATA_DIR: APP_DATA_DIR,
      },
    });

    // Handle output
    server.stdout.on("data", (data) => {
      const message = data.toString().trim();
      console.log(`[Server] ${message}`);
      logStream.write(`[${new Date().toISOString()}] ${message}\n`);
    });

    server.stderr.on("data", (data) => {
      const message = data.toString().trim();
      console.error(`[Server Error] ${message}`);
      logStream.write(`[${new Date().toISOString()}] ERROR: ${message}\n`);
    });

    // Handle process exit
    server.on("exit", (code, signal) => {
      console.log(
        `Server process exited with code: ${code}, signal: ${signal}`,
      );
      logStream.write(
        `[${new Date().toISOString()}] Server exited: code=${code}, signal=${signal}\n`,
      );
      server = null;
    });

    // Wait for server to be ready
    const isReady = await waitForServer();
    if (isReady) {
      console.log("Server started successfully");
      return true;
    } else {
      console.error("Server failed to start");
      return false;
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    return false;
  }
}

/**
 * Wait for server to respond to health check
 */
async function waitForServer(maxAttempts = 30, interval = 1000) {
  const http = require("http");

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${SERVER_PORT}/api/health`,
          (res) => {
            if (res.statusCode === 200) {
              console.log("Server health check passed");
              resolve(true);
            } else {
              reject(new Error(`Health check failed: ${res.statusCode}`));
            }
          },
        );

        req.on("error", reject);
        req.setTimeout(interval, () => {
          req.destroy();
          reject(new Error("Health check timeout"));
        });
      });
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        console.log(`Waiting for server... (${i + 1}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }
  }
  return false;
}

/**
 * Stop server process
 */
async function stopServer() {
  if (server) {
    console.log("Stopping server process...");
    server.kill("SIGTERM");

    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(() => resolve(), 5000);
    });

    if (server && !server.killed) {
      server.kill("SIGKILL");
    }

    console.log("Server stopped");
    server = null;
  }
}

/**
 * Create main window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false, // Allow loading local modules
    },
    title: "English Reading Helper",
    backgroundColor: "#1e1e1e",
    autoHideMenuBar: true,
    show: false,
  });

  // Load built frontend from renderer/ directory
  const frontendDistPath = path.join(__dirname, "renderer");
  const indexPath = path.join(frontendDistPath, "index.html");

  console.log(`Loading frontend from: ${indexPath}`);

  // Use loadFile for reliable local file loading
  mainWindow.loadFile(indexPath);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    // Open DevTools for debugging (remove in production)
    //mainWindow.webContents.openDevTools();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// IPC handlers
require("electron").ipcMain.handle("get-app-data-dir", () => APP_DATA_DIR);
require("electron").ipcMain.handle("get-server-status", () => ({
  isRunning: server !== null,
}));
require("electron").ipcMain.handle("start-server", async () => {
  try {
    const success = await startServer();
    return { success };
  } catch (error) {
    console.error("Failed to start server:", error);
    return { success: false, error: error.message };
  }
});
require("electron").ipcMain.handle("stop-server", async () => {
  try {
    await stopServer();
    return { success: true };
  } catch (error) {
    console.error("Failed to stop server:", error);
    return { success: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(async () => {
  console.log("App is ready");
  await ensureDirectories();

  const serverReady = await startServer();
  if (!serverReady) {
    console.error("Failed to start server. App may not function properly.");
  }

  createWindow();
});

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    await stopServer();
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", async () => {
  console.log("App is about to quit");
  await stopServer();
});

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}
