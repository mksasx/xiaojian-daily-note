const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (data) => ipcRenderer.invoke('store:save', data),
  exportBackup: (data) => ipcRenderer.invoke('data:export', data),
  importBackup: () => ipcRenderer.invoke('data:import'),
  showDataInFolder: () => ipcRenderer.invoke('data:show-in-folder'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('window:set-always-on-top', enabled),
  setCompact: (enabled) => ipcRenderer.invoke('window:set-compact', enabled),
  setLoginItem: (enabled) => ipcRenderer.invoke('app:set-login-item', enabled)
});
