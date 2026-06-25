const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('beatriceDesktop', {
  platform: process.platform,
  isElectron: true,

  // Direct terminal execution (no daemon needed)
  runTerminal: (command, cwd, timeout) =>
    ipcRenderer.invoke('run-terminal', { command, cwd, timeout }),

  // Workspace checks (no daemon needed)
  checkOpenCode: () => ipcRenderer.invoke('check-opencode'),
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  checkNode: () => ipcRenderer.invoke('check-node'),
  health: () => ipcRenderer.invoke('health'),

  // Full workspace setup status
  setupWorkspace: () => ipcRenderer.invoke('setup-workspace'),
});
