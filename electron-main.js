const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// 战区历史数据文件路径
function getHistoryDataPath() {
    return path.join(app.getPath('userData'), 'warzone-history.json');
}

// 确保 userData 中有历史数据（首次运行从打包资源复制）
function ensureHistoryData() {
    const userPath = getHistoryDataPath();
    if (!fs.existsSync(userPath)) {
        const bundledPath = path.join(app.getAppPath(), 'data', 'warzone-history.json');
        if (fs.existsSync(bundledPath)) {
            fs.copyFileSync(bundledPath, userPath);
        }
    }
}

// 获取历史数据中的最大周号
function getHistoryMaxWeek() {
    try {
        const dataPath = getHistoryDataPath();
        if (!fs.existsSync(dataPath)) return null;
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        if (!Array.isArray(data) || data.length === 0) return null;
        return Math.max(...data.map(d => d.week));
    } catch {
        return null;
    }
}

// 保存更新后的历史数据
function saveHistoryData(data) {
    const userPath = getHistoryDataPath();
    fs.writeFileSync(userPath, JSON.stringify(data), 'utf-8');
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#ebebf2',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'electron-preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');

    // 外部链接用默认浏览器打开
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    ensureHistoryData();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('get-history-path', () => getHistoryDataPath());

ipcMain.handle('get-history-max-week', () => getHistoryMaxWeek());

ipcMain.handle('save-history-data', (_, data) => {
    try {
        saveHistoryData(data);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('get-app-version', () => app.getVersion());
