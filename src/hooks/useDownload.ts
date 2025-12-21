import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/configureStore';
import { SERVER_ENDPOINTS } from '@/lib/config';
import { toast } from 'sonner';

// Типы стратегий загрузки, соответствующие твоим Rust командам
export type DownloadStrategy = 
  | 'fallback'  // downloadfilewithfallbacks (Самая надежная)
  | 'heavy'     // downloadfileheavy
  | 'direct'    // downloadfiledirect
  | 'mod';      // downloadmodfile

interface DownloadOptions {
  strategy?: DownloadStrategy;
  taskId?: string; // Для трекинга прогресса
  // Для стратегии 'mod'
  modName?: string; 
  username?: string;
  password?: string;
}

export const useDownload = () => {
  const { authToken, userLogin, userPassword } = useSelector((state: RootState) => state.authSlice);
  const dispatch = useDispatch();

  const downloadFile = useCallback(async (
    relativeUrl: string,
    destinationPath: string,
    options: DownloadOptions = {}
  ) => {
    const { strategy = 'fallback', taskId = 'unknown', modName } = options;
    
    const endpoints = [SERVER_ENDPOINTS.main, SERVER_ENDPOINTS.proxy];
    
    let lastError: any = null;

    for (const endpoint of endpoints) {
      try {
        const cleanEndpoint = endpoint.replace(/\/$/, '');
        const cleanRelative = relativeUrl.replace(/^\//, '');
        const fullUrl = `${cleanEndpoint}/${cleanRelative}`;

        console.log(`🔽 Downloading [${strategy}] from ${endpoint}: ${cleanRelative}`);

        switch (strategy) {
          case 'fallback':
            await invoke('download_file_with_fallbacks', {
              // УДАЛИЛ: window: null
              url: fullUrl,
              path: destinationPath,
              authToken: authToken, // camelCase
              taskId: taskId        // camelCase (Tauri сам сделает task_id для Rust)
            });
            break;

          case 'heavy':
            await invoke('download_file_heavy', {
              url: fullUrl,
              path: destinationPath,
              authToken: authToken, // camelCase
              taskId: taskId        // camelCase
            });
            break;

          case 'direct':
             await invoke('download_file_direct', {
               url: fullUrl,
               path: destinationPath,
               authToken: authToken // camelCase
             });
             break;

          case 'mod':
            await invoke('download_mod_file', { 
               url: fullUrl,
               path: destinationPath,
               modName: modName || cleanRelative.split('/').pop(), // camelCase -> mod_name
               username: userLogin,
               password: userPassword
             });
            break;
        }

        console.log(`✅ Download success: ${cleanRelative}`);
        return;

      } catch (error) {
        console.warn(`⚠️ Download failed on ${endpoint}:`, error);
        lastError = error;
      }
    }

    const errorMsg = `All download attempts failed for ${relativeUrl}`;
    console.error(errorMsg, lastError);
    toast.error('Download failed', { description: `Could not download ${relativeUrl}` });
    throw new Error(errorMsg);

  }, [authToken, userLogin, userPassword]);

  return { downloadFile };
};
