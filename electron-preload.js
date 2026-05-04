const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getHistoryPath: () => ipcRenderer.invoke('get-history-path'),
    getHistoryMaxWeek: () => ipcRenderer.invoke('get-history-max-week'),
    saveHistoryData: (data) => ipcRenderer.invoke('save-history-data', data),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    isElectron: true
});
