const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('probe', {
  run: operation => ipcRenderer.invoke('drawio-probe:run', operation),
  report: () => ipcRenderer.invoke('drawio-probe:report'),
  ready: details => ipcRenderer.invoke('drawio-probe:ready', details)
});
