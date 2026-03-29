/**
 * Preload Script
 * Context bridge for IPC
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Get app data directory
  getAppDataDir: () => ipcRenderer.invoke('get-app-data-dir'),

  // Get server status
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),

  // Start server
  startServer: () => ipcRenderer.invoke('start-server'),

  // Stop server
  stopServer: () => ipcRenderer.invoke('stop-server'),

  // Change data directory
  changeDataDir: () => ipcRenderer.invoke('change-data-dir'),

  // Use existing data directory
  useExistingDataDir: () => ipcRenderer.invoke('use-existing-data-dir'),
});

console.log('Preload script loaded');
