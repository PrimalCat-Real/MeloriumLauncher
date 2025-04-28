import { ipcMain } from 'electron';
import os from 'os'; 

export function registerSystemInfoHandlers() {
  ipcMain.handle('get-system-ram-mb', () => {
    try {
      const totalBytes = os.totalmem(); 
      const totalMB = Math.floor(totalBytes / (1024 * 1024));
      console.log(`[IPC SystemInfo] Detected RAM: ${totalMB} MB`); 
      return totalMB; 
    } catch (error) {
      console.error('[IPC SystemInfo] Failed to get system RAM:', error);
      return null; 
    }
  });

}