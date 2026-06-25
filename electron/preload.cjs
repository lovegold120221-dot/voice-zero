const { contextBridge } = require('electron');

// Expose Electron-specific APIs to the renderer
contextBridge.exposeInMainWorld('beatriceDesktop', {
  platform: process.platform,
  isElectron: true,
  appVersion: require('electron').app?.getVersion() || '1.0.0',
});
