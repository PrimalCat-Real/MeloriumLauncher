import { useState, useCallback } from 'react';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { exists, rename, remove, writeFile } from '@tauri-apps/plugin-fs';
import { matchesIgnoredPath } from '@/lib/glob-utils';
import * as Sentry from "@sentry/browser";
import { listen } from '@tauri-apps/api/event';
import { silentRelogin } from '@/lib/auth';
import { RootState } from '@/store/configureStore';
import { useSelector, useDispatch } from 'react-redux';
import { SERVER_ENDPOINTS } from '@/lib/config';
import { setUserData } from '@/store/slice/authSlice';

interface FileEntry {
  path: string;
  hash: string;
  size: number;
  url: string;
  optional: boolean;
  dependencies?: string[];
}

interface LauncherManifest {
  version: string;
  timestamp: number;
  totalSize: number;
  files: FileEntry[];
}

interface SyncResult {
  toDownload: FileEntry[];
  toUpdate: FileEntry[];
  toDelete: string[];
  toDisable: string[];
  upToDate: string[];
  skipped: string[];
}

const useDownload = () => {
  const { authToken } = useSelector((state: RootState) => state.authSlice);
  const activeEndPoint = useSelector((state: RootState) => state.settingsState.activeEndPoint);
  const dispatch = useDispatch();

  const downloadFileFallbackJs = async (url: string, path: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) throw new Error(`JS Download HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    await writeFile(path, uint8Array);
  };

  const downloadFileWithRetries = useCallback(async (
    file: FileEntry,
    gameDir: string
  ) => {
    const localPath = await join(gameDir, file.path);
    const taskId = crypto.randomUUID();
    
    const endpoints = activeEndPoint === SERVER_ENDPOINTS.main 
        ? [SERVER_ENDPOINTS.main, SERVER_ENDPOINTS.proxy] 
        : [SERVER_ENDPOINTS.proxy, SERVER_ENDPOINTS.main];

    const maxRetriesPerEndpoint = 2;
    
    // Локальная переменная для токена, чтобы обновить её при релогине без ре-рендера
    let currentToken = authToken;

    const unlistenPromise = listen(`download-progress-${taskId}`, () => {});

    for (const endpoint of endpoints) {
        const baseUrl = endpoint.replace(/\/$/, '');
        const fullUrl = `${baseUrl}${file.url}`;
        
        let attempts = 0;
        
        while (attempts < maxRetriesPerEndpoint) {
            attempts++;

            try {
                const strategy = attempts === 1 ? 'direct' : 'fallback';
                
                if (strategy === 'direct') {
                    await invoke("download_file_direct", {
                        url: fullUrl,
                        path: localPath,
                        authToken: currentToken || null,
                    });
                } else {
                    await invoke("download_file_with_fallbacks", {
                        url: fullUrl,
                        path: localPath,
                        authToken: currentToken || null,
                        taskId: taskId
                    });
                }

                (await unlistenPromise)();
                return;

            } catch (error: any) {
                const msg = String(error?.message || error);
                
                if (msg.includes("401") || msg.includes("UNAUTHORIZED")) {
                    console.warn(`[download] 401 Token expired. Relogin...`);
                    try {
                        const newToken = await silentRelogin(baseUrl); 
                        if (newToken) {
                            currentToken = newToken;
                            dispatch(setUserData({ authToken: newToken }));
                            attempts--; 
                            continue;
                        }
                    } catch (e) {
                         console.error("Relogin failed during download", e);
                    }
                }

                console.warn(`[download] Failed ${file.path} on ${endpoint}: ${msg}`);
                
                if (endpoint === endpoints[endpoints.length - 1] && attempts === maxRetriesPerEndpoint) {
                     Sentry.captureException(error);
                     throw new Error(`All mirrors failed for ${file.path}. Last error: ${msg}`);
                }

                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    
    (await unlistenPromise)();
  }, [authToken, activeEndPoint, dispatch]);

  return { downloadFileWithRetries };
};

export function useFileSync() {
  const [isComparing, setIsComparing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  
  const { downloadFileWithRetries } = useDownload(); 

  const isInMeloriamFolder = useCallback((path: string): boolean => {
    return path.startsWith('Melorium/');
  }, []);

  const isModFile = useCallback((path: string): boolean => {
    return path.startsWith('Melorium/mods/') && (path.endsWith('.jar') || path.endsWith('.jar.disabled'));
  }, []);

  const isOptionalMod = useCallback((filePath: string, serverFileMap: Map<string, FileEntry>): boolean => {
    const normalPath = filePath.replace(/\.disabled$/, '');
    const serverFile = serverFileMap.get(normalPath);
    return serverFile?.optional || false;
  }, []);

  const compareFiles = useCallback((
    localHashes: Record<string, string>,
    serverManifest: LauncherManifest,
    ignoredPaths: string[],
    localVersion?: string,
    serverVersion?: string
  ): SyncResult => {
    setIsComparing(true);

    const result: SyncResult = {
      toDownload: [],
      toUpdate: [],
      toDelete: [],
      toDisable: [],
      upToDate: [],
      skipped: [],
    };

    try {
      const requiredFiles = serverManifest.files.filter(f => !f.optional);
      const optionalFiles = serverManifest.files.filter(f => f.optional);

      const versionUnchanged = !localVersion || localVersion === serverVersion || localVersion === serverManifest.version;

      const localHashMap = new Map(Object.entries(localHashes));
      const serverFileMap = new Map(
        serverManifest.files.map(f => [f.path, f])
      );

      for (const file of requiredFiles) {
        const inMelorium = isInMeloriamFolder(file.path);
        
        if (matchesIgnoredPath(file.path, ignoredPaths)) {
          result.skipped.push(file.path);
          continue;
        }
        
        if (versionUnchanged && !inMelorium) {
          result.skipped.push(file.path);
          continue;
        }

        const localHash = localHashMap.get(file.path);

        if (!localHash) {
          result.toDownload.push(file);
        } else if (localHash !== file.hash) {
          result.toUpdate.push(file);
        } else {
          result.upToDate.push(file.path);
        }
      }

      for (const file of optionalFiles) {
        if (!isModFile(file.path)) continue;

        const normalPath = file.path;
        const disabledPath = `${file.path}.disabled`;
        
        const hasNormal = localHashMap.has(normalPath);
        const hasDisabled = localHashMap.has(disabledPath);

        if (hasDisabled && !hasNormal) {
          result.skipped.push(disabledPath);
          continue;
        }

        if (hasNormal && file.dependencies && file.dependencies.length > 0) {
          const missingDeps: string[] = [];
          for (const depPath of file.dependencies) {
            const depNormalPath = depPath;
            if (!localHashMap.has(depNormalPath)) {
              missingDeps.push(depPath);
            }
          }

          if (missingDeps.length > 0) {
            result.toDisable.push(normalPath);
          }
        }
      }

      for (const localPath of localHashMap.keys()) {
        const inMelorium = isInMeloriamFolder(localPath);
        
        if (localPath.endsWith('.disabled')) {
          const normalPath = localPath.replace(/\.disabled$/, '');
          if (isOptionalMod(normalPath, serverFileMap)) {
            continue;
          }
        }
        
        if (matchesIgnoredPath(localPath, ignoredPaths)) continue;
        
        if (inMelorium && !serverFileMap.has(localPath)) {
          const serverFile = serverManifest.files.find(f => f.path === localPath);
          if (!serverFile || !serverFile.optional) {
            result.toDelete.push(localPath);
          }
        }
      }

    } catch (e) {
      console.error('Comparison failed:', e);
      throw e;
    } finally {
      setIsComparing(false);
    }

    return result;
  }, [isInMeloriamFolder, isModFile, isOptionalMod]);

  const deleteFile = useCallback(async (filePath: string, gameDir: string) => {
    const localPath = await join(gameDir, filePath);
    try {
        await remove(localPath);
    } catch(e) {
        console.warn("Delete failed", e);
    }
  }, []);

  const disableMod = useCallback(async (filePath: string, gameDir: string) => {
    const localPath = await join(gameDir, filePath);
    const disabledPath = `${localPath}.disabled`;
    
    if (await exists(localPath)) {
      await rename(localPath, disabledPath);
    }
  }, []);

  const syncFiles = useCallback(async (
    syncResult: SyncResult,
    gameDir: string
  ): Promise<void> => {
    setIsSyncing(true);

    try {
      const totalOperations = 
        syncResult.toDownload.length + 
        syncResult.toUpdate.length + 
        syncResult.toDelete.length +
        syncResult.toDisable.length;

      if (totalOperations === 0) return;

      let currentOperation = 0;
      const updateProgress = () => {
          currentOperation++;
          const percent = Math.round((currentOperation / totalOperations) * 100);
          setProgress({ current: currentOperation, total: totalOperations, percent });
      };

      for (const filePath of syncResult.toDisable) {
        await disableMod(filePath, gameDir);
        updateProgress();
      }

      for (const file of syncResult.toDownload) {
        await downloadFileWithRetries(file, gameDir);
        updateProgress();
      }

      for (const file of syncResult.toUpdate) {
        await deleteFile(file.path, gameDir);
        await downloadFileWithRetries(file, gameDir);
        updateProgress();
      }

      for (const filePath of syncResult.toDelete) {
        await deleteFile(filePath, gameDir);
        updateProgress();
      }

    } catch (error) {
      Sentry.captureException(error);
      throw error;
    } finally {
      setIsSyncing(false);
      setProgress({ current: 0, total: 0, percent: 0 });
    }
  }, [downloadFileWithRetries, deleteFile, disableMod]);

  return {
    compareFiles,
    syncFiles,
    isComparing,
    isSyncing,
    progress,
  };
}
