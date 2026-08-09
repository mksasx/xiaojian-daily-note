const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, shell, Tray } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { normalizeBackup } = require('./src/task-utils');

let mainWindow;
let tray;
let isQuitting = false;

const launchHidden = process.argv.includes('--hidden');
const appIconPath = path.join(__dirname, 'src', 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon-512.png');
const trayIconPath = path.join(__dirname, 'src', 'icons', 'tray-icon.png');

const defaultStore = {
  version: 2,
  tasks: [],
  deletedTasks: [],
  settings: {
    alwaysOnTop: false,
    launchAtLogin: false,
    compactMode: false
  }
};

function storePath() {
  return path.join(app.getPath('userData'), 'daily-note.json');
}

function showWindow() {
  if (!mainWindow) {
    createWindow(true);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideWindow() {
  mainWindow?.hide();
}

function toggleWindow() {
  if (mainWindow?.isVisible()) hideWindow();
  else showWindow();
}

function setLoginItem(enabled) {
  const loginOptions = { openAtLogin: Boolean(enabled) };
  if (process.platform === 'win32') loginOptions.args = ['--hidden'];
  if (process.platform === 'darwin') loginOptions.openAsHidden = true;
  app.setLoginItemSettings(loginOptions);
  return app.getLoginItemSettings(process.platform === 'win32' ? { args: ['--hidden'] } : {}).openAtLogin;
}

function createTray() {
  const trayImage = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(trayImage);
  tray.setToolTip('小笺 · 每日待办');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开小笺', click: showWindow },
    { type: 'separator' },
    {
      label: '退出小笺',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('click', toggleWindow);
}

async function loadStore() {
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeBackup({ ...parsed, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] }, defaultStore.settings);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Unable to read store:', error);
    return structuredClone(defaultStore);
  }
}

async function saveStore(nextStore) {
  const safeStore = normalizeBackup(nextStore, defaultStore.settings);
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  const temporaryPath = `${storePath()}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(safeStore, null, 2), 'utf8');
  await fs.rename(temporaryPath, storePath());
  return safeStore;
}

async function exportBackup(data) {
  const safeStore = normalizeBackup(data, defaultStore.settings);
  const date = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出小笺备份',
    defaultPath: `小笺备份-${date}.json`,
    filters: [{ name: 'JSON 备份', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const backup = { ...safeStore, exportedAt: new Date().toISOString(), appVersion: app.getVersion() };
  await fs.writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf8');
  return { canceled: false, fileName: path.basename(result.filePath) };
}

async function importBackup() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入小笺备份',
    properties: ['openFile'],
    filters: [{ name: 'JSON 备份', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    const raw = await fs.readFile(result.filePaths[0], 'utf8');
    const imported = normalizeBackup(JSON.parse(raw), defaultStore.settings);
    return { canceled: false, store: imported, fileName: path.basename(result.filePaths[0]) };
  } catch (error) {
    console.error('Unable to import backup:', error);
    return { canceled: false, error: 'INVALID_BACKUP' };
  }
}

function createWindow(showOnReady = true) {
  const display = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 520,
    maxWidth: 560,
    show: false,
    skipTaskbar: true,
    icon: appIconPath,
    x: Math.max(display.x, display.x + display.width - 452),
    y: Math.max(display.y, display.y + 32),
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    backgroundColor: '#F7F5F0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (showOnReady) showWindow();
  });
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    hideWindow();
  });
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hideWindow();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
  app.setAppUserModelId('com.dailynote.desktop');
  if (process.platform === 'darwin') app.dock.hide();
  ipcMain.handle('store:load', loadStore);
  ipcMain.handle('store:save', (_event, data) => saveStore(data));
  ipcMain.handle('data:export', (_event, data) => exportBackup(data));
  ipcMain.handle('data:import', importBackup);
  ipcMain.handle('data:show-in-folder', async () => {
    try {
      await fs.access(storePath());
    } catch {
      await saveStore(await loadStore());
    }
    shell.showItemInFolder(storePath());
  });
  ipcMain.handle('window:minimize', hideWindow);
  ipcMain.handle('window:close', hideWindow);
  ipcMain.handle('window:set-always-on-top', (_event, enabled) => {
    mainWindow?.setAlwaysOnTop(Boolean(enabled), 'floating');
    return mainWindow?.isAlwaysOnTop() ?? false;
  });
  ipcMain.handle('window:set-compact', (_event, compact) => {
    if (!mainWindow) return;
    const [width] = mainWindow.getSize();
    mainWindow.setSize(width, compact ? 520 : 680, true);
  });
  ipcMain.handle('app:set-login-item', (_event, enabled) => {
    return setLoginItem(enabled);
  });
  const initialStore = await loadStore();
  if (initialStore.settings.launchAtLogin) setLoginItem(true);
  createTray();
  createWindow(!launchHidden);
    app.on('activate', showWindow);
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});
