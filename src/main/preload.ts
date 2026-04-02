import { contextBridge } from 'electron';

/**
 * Preload script — exposes a minimal API to the renderer process.
 * The renderer primarily uses socket.io for communication, so this
 * is kept minimal for platform info only.
 */
contextBridge.exposeInMainWorld('orchestra', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});
