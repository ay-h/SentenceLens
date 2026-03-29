/**
 * Electron Main Process
 * Manages Express.js backend server
 */

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { spawn } = require("child_process");

// Keep global reference for window instance
let mainWindow = null;
let server = null;
let serverLogStream = null;

function formatLogTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const offsetMinutes = now.getTimezoneOffset();
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const totalMinutes = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(totalMinutes / 60));
  const offsetRemaining = pad(totalMinutes % 60);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${sign}${offsetHours}:${offsetRemaining}`;
}

const CONFIG_PATH = path.join(app.getPath("userData"), "settings.json");
const DEFAULT_DATA_DIR = path.join(
  app.getPath("userData"),
  "english-reading-helper",
);
const SERVER_PORT = 8000;

function normalizePath(dirPath) {
  return path.resolve(dirPath);
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Failed to load app config:", error);
  }
  return {};
}

async function saveConfig(config) {
  try {
    await fsPromises.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fsPromises.writeFile(
      CONFIG_PATH,
      JSON.stringify(config, null, 2),
      "utf-8",
    );
  } catch (error) {
    console.error("Failed to save app config:", error);
    throw error;
  }
}

let appConfig = loadConfig();
let currentDataDir = normalizePath(appConfig.dataDir || DEFAULT_DATA_DIR);

function getDataDir() {
  return currentDataDir;
}

async function setDataDir(dir) {
  currentDataDir = normalizePath(dir);
  appConfig = { ...appConfig, dataDir: currentDataDir };
  await saveConfig(appConfig);
}

function isSubPath(target, base) {
  const relative = path.relative(base, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function pathExists(p) {
  try {
    await fsPromises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function directoryIsEmpty(dir) {
  try {
    const entries = await fsPromises.readdir(dir);
    return entries.length === 0;
  } catch (error) {
    if (error.code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

async function inspectDataDir(dir) {
  const result = {
    exists: false,
    hasDatabase: false,
    databaseSize: 0,
    uploadsExists: false,
    uploadsCount: 0,
  };

  if (!(await pathExists(dir))) {
    return result;
  }

  result.exists = true;

  const databasePath = path.join(dir, "database.db");
  if (await pathExists(databasePath)) {
    const stats = await fsPromises.stat(databasePath);
    result.hasDatabase = true;
    result.databaseSize = stats.size;
  }

  const uploadsPath = path.join(dir, "uploads");
  if (await pathExists(uploadsPath)) {
    const entries = await fsPromises.readdir(uploadsPath);
    result.uploadsExists = true;
    result.uploadsCount = entries.length;
  }

  return result;
}

function verifyMigrationState(oldState, newState) {
  if (oldState.hasDatabase && (!newState.hasDatabase || newState.databaseSize !== oldState.databaseSize)) {
    throw new Error("数据库文件复制失败，请重试");
  }

  if (oldState.uploadsExists && !newState.uploadsExists) {
    throw new Error("上传目录复制失败，请重试");
  }
}

/**
 * Create necessary directories
 */
async function ensureDirectories(dir = getDataDir()) {
  const dirs = [
    dir,
    path.join(dir, "uploads"),
    path.join(dir, "logs"),
  ];

  for (const dirPath of dirs) {
    try {
      await fsPromises.mkdir(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    } catch (error) {
      if (error.code !== "EEXIST") {
        console.error(`Failed to create directory: ${dirPath}`, error);
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

    const currentDir = getDataDir();
    await ensureDirectories(currentDir);

    const logFile = path.join(currentDir, "logs", "server.log");
    await fsPromises.mkdir(path.dirname(logFile), { recursive: true });
    serverLogStream = fs.createWriteStream(logFile, { flags: "a" });

    server = spawn("node", ["server/app.js"], {
      cwd: __dirname,
      env: {
        ...process.env,
        APP_DATA_DIR: currentDir,
      },
    });

    // Handle output
    server.stdout.on("data", (data) => {
      const message = data.toString().trim();
      console.log(`[Server] ${message}`);
      serverLogStream?.write(`[${formatLogTimestamp()}] ${message}\n`);
    });

    server.stderr.on("data", (data) => {
      const message = data.toString().trim();
      console.error(`[Server Error] ${message}`);
      serverLogStream?.write(`[${formatLogTimestamp()}] ERROR: ${message}\n`);
    });

    // Handle process exit
    server.on("exit", (code, signal) => {
      console.log(
        `Server process exited with code: ${code}, signal: ${signal}`,
      );
      serverLogStream?.write(
        `[${formatLogTimestamp()}] Server exited: code=${code}, signal=${signal}\n`,
      );
      if (serverLogStream) {
        serverLogStream.end();
        serverLogStream = null;
      }
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
  if (serverLogStream) {
    serverLogStream.end();
    serverLogStream = null;
  }
}

async function migrateDataDirectory(targetDir) {
  const newDir = normalizePath(targetDir);
  const oldDir = getDataDir();

  if (newDir === oldDir) {
    return { success: true, message: "数据目录未改变", newDir };
  }

  if (isSubPath(newDir, oldDir)) {
    throw new Error("请选择不在当前数据目录内部的位置");
  }

  if (await pathExists(newDir) && !(await directoryIsEmpty(newDir))) {
    throw new Error("目标目录必须为空。如需打开已有数据，请使用“切换至已有数据目录”。");
  }

  console.log(`Migrating data from ${oldDir} to ${newDir}`);

  await stopServer();
  const oldState = await inspectDataDir(oldDir);

  let cleanupWarning = null;

  try {
    await fsPromises.mkdir(newDir, { recursive: true });

    if (await pathExists(oldDir)) {
      const entries = await fsPromises.readdir(oldDir);
      for (const entry of entries) {
        const source = path.join(oldDir, entry);
        const destination = path.join(newDir, entry);
        await fsPromises.cp(source, destination, { recursive: true, force: true });
      }
    }

    await ensureDirectories(newDir);

    const newState = await inspectDataDir(newDir);
    verifyMigrationState(oldState, newState);

    await setDataDir(newDir);

    if ((await pathExists(oldDir)) && !isSubPath(oldDir, newDir)) {
      try {
        await fsPromises.rm(oldDir, { recursive: true, force: true });
        console.log(`Removed old data directory: ${oldDir}`);
      } catch (error) {
        cleanupWarning = `旧数据目录删除失败: ${error.message}`;
        console.warn(`Failed to remove old data directory ${oldDir}:`, error);
      }
    } else if (await pathExists(oldDir)) {
      console.warn(
        "Skipping removal of old data directory due to nested path relationship.",
      );
    }

    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 300);

    return { success: true, newDir, cleanupWarning };
  } catch (error) {
    await startServer().catch((restartError) => {
      console.error("Failed to restart server after migration error:", restartError);
    });
    throw error;
  }
}

async function useExistingDataDirectory(targetDir) {
  const newDir = normalizePath(targetDir);
  const oldDir = getDataDir();

  if (newDir === oldDir) {
    return { success: true, message: "数据目录未改变", newDir };
  }

  if (!(await pathExists(newDir))) {
    throw new Error("选择的目录不存在");
  }

  if (await directoryIsEmpty(newDir)) {
    throw new Error("目标目录为空。若要迁移，请先使用“选择新的数据目录”。");
  }

  const targetState = await inspectDataDir(newDir);
  if (!targetState.hasDatabase) {
    throw new Error("未检测到数据库文件。请确认该目录为有效的数据目录。");
  }

  await stopServer();

  try {
    await setDataDir(newDir);
    await ensureDirectories(newDir);

    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 300);

    return { success: true, newDir, reused: true };
  } catch (error) {
    await startServer().catch((restartError) => {
      console.error("Failed to restart server after switching data directory:", restartError);
    });
    throw error;
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
require("electron").ipcMain.handle("get-app-data-dir", () => getDataDir());
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
require("electron").ipcMain.handle("change-data-dir", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "选择新的数据目录",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: getDataDir(),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const targetDir = result.filePaths[0];
    const migrationResult = await migrateDataDirectory(targetDir);

    return { ...migrationResult, canceled: false, restarting: true };
  } catch (error) {
    console.error("Failed to change data directory:", error);
    if (!server) {
      await startServer();
    }
    return { success: false, error: error.message, canceled: false };
  }
});

require("electron").ipcMain.handle("use-existing-data-dir", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "选择已有的数据目录",
      properties: ["openDirectory"],
      defaultPath: getDataDir(),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const targetDir = result.filePaths[0];
    const switchResult = await useExistingDataDirectory(targetDir);

    return { ...switchResult, canceled: false, restarting: true };
  } catch (error) {
    console.error("Failed to use existing data directory:", error);
    if (!server) {
      await startServer();
    }
    return { success: false, error: error.message, canceled: false };
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
