const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('cadencia', {
  isNative: true,
  platform: process.platform,
});
