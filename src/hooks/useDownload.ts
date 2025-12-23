import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SERVER_ENDPOINTS } from '@/lib/config';
import { toast } from 'sonner';
import { LOGGER } from '@/lib/loger';
import { useAuthStore } from '@/store/useAuthStore';

export type DownloadStrategy = 
  | 'fallback'
  | 'heavy'     
  | 'direct'    
  | 'mod';      

interface DownloadOptions {
  strategy?: DownloadStrategy;
  taskId?: string;
  modName?: string; 
  username?: string;
  password?: string;
}

export const useDownload = () => {
  const authToken = useAuthStore((state) => state.authToken);
  const userLogin = useAuthStore((state) => state.username);
  const userPassword = useAuthStore((state) => state.password);

  const downloadFile = useCallback(async (
    relativeUrl: string,
    destinationPath: string,
    options: DownloadOptions = {}
  ) => {
    const { strategy = 'fallback', taskId = 'unknown', modName } = options;
    
    console.log("start download", {
      relativeUrl,
      destinationPath,
      strategy,
      taskId,
      modName
    });
    
    const endpoints = [SERVER_ENDPOINTS.main, SERVER_ENDPOINTS.proxy];
    
    let lastError: any = null;

    for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
      const currentEndpoint = endpoints[endpointIndex];
      
      console.log("download attempt", {
        endpointIndex: endpointIndex + 1,
        totalEndpoints: endpoints.length,
        currentEndpoint
      });
      
      try {
        const cleanEndpoint = currentEndpoint.replace(/\/$/, '');
        const cleanRelativeUrl = relativeUrl.replace(/^\//, '');
        const fullUrl = `${cleanEndpoint}/${cleanRelativeUrl}`;

        console.log("download details", {
          cleanEndpoint,
          cleanRelativeUrl,
          fullUrl,
          strategy,
          taskId
        });

        switch (strategy) {
          case 'fallback':
            await invoke('download_file_with_fallbacks', {
              url: fullUrl,
              path: destinationPath,
              authToken: authToken,
              taskId: taskId
            });
            break;

          case 'heavy':
            await invoke('download_file_heavy', {
              url: fullUrl,
              path: destinationPath,
              authToken: authToken,
              taskId: taskId
            });
            break;

          case 'direct':
            await invoke('download_file_direct', {
              url: fullUrl,
              path: destinationPath,
              authToken: authToken
            });
            break;

          case 'mod':
            await invoke('download_mod_file', { 
              url: fullUrl,
              path: destinationPath,
              modName: modName || cleanRelativeUrl.split('/').pop(),
              username: userLogin,
              password: userPassword
            });
            break;
        }

        console.log("download success", {
          relativeUrl,
          destinationPath,
          strategy,
          endpoint: currentEndpoint
        });
        return;

      } catch (error) {
        console.error("download attempt failed", {
          endpointIndex: endpointIndex + 1,
          currentEndpoint,
          strategy,
          error: error
        });
        lastError = error;
      }
    }

    const errorMessage = `All download attempts failed for ${relativeUrl}`;
    console.error("download completely failed", {
      relativeUrl,
      destinationPath,
      totalAttempts: endpoints.length,
      lastError
    });
    console.error('Download failed', { description: `Could not download ${relativeUrl}` });
    throw new Error(errorMessage);

  }, [authToken, userLogin, userPassword]);

  return { downloadFile };
};
