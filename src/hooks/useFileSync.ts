import { useState, useCallback } from 'react';
import { join } from '@tauri-apps/api/path';
import { remove, exists, rename } from '@tauri-apps/plugin-fs';
import { matchesIgnoredPath } from '@/lib/glob-utils';
import * as Sentry from "@sentry/browser";
import { useDownload } from '@/hooks/useDownload';
import { LOGGER } from '@/lib/loger';

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

export function useFileSync() {
  const [isComparingFiles, setIsComparingFiles] = useState(false);
  const [isSyncingFiles, setIsSyncingFiles] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, percent: 0 });
  
  const { downloadFile } = useDownload(); 

  const isInMeloriumFolder = useCallback((path: string): boolean => {
    // console.log("check melorium folder", path);
    return path.startsWith('Melorium/');
  }, []);

  const isModFile = useCallback((path: string): boolean => {
    console.log("check mod file", path);
    return path.startsWith('Melorium/mods/') && (path.endsWith('.jar') || path.endsWith('.jar.disabled'));
  }, []);

  const isOptionalMod = useCallback((filePath: string, serverFileMap: Map<string, FileEntry>): boolean => {
    console.log("check optional mod", filePath);
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
    console.log("start file comparison", { serverManifest: serverManifest.files });
    setIsComparingFiles(true);

    const syncResult: SyncResult = {
      toDownload: [],
      toUpdate: [],
      toDelete: [],
      toDisable: [],
      upToDate: [],
      skipped: [],
    };

    try {
      const requiredFiles = serverManifest.files.filter(file => !file.optional);
      const optionalFiles = serverManifest.files.filter(file => file.optional);

      const versionUnchanged = !localVersion || localVersion === serverVersion || localVersion === serverManifest.version;
      console.log("version check", { versionUnchanged, localVersion, serverVersion });

      const localHashMap = new Map(Object.entries(localHashes));
      const serverFileMap = new Map(serverManifest.files.map(file => [file.path, file]));

      console.log("localHash", localHashMap)
      console.log("serverHash", serverFileMap)
      for (const file of requiredFiles) {
        const inMelorium = isInMeloriumFolder(file.path);
        
        if (matchesIgnoredPath(file.path, ignoredPaths)) {
          syncResult.skipped.push(file.path);
          // console.log("file skipped ignored", file.path);
          continue;
        }
        
        if (versionUnchanged && !inMelorium) {
          syncResult.skipped.push(file.path);
          // LOGGER.log("file skipped version", file.path);
          continue;
        }

        const localHash = localHashMap.get(file.path);

        if (!localHash) {
          syncResult.toDownload.push(file);
          console.log("file to download", file.path);
        } else if (localHash !== file.hash) {
          syncResult.toUpdate.push(file);
          console.log("file to update", file.path);
        } else {
          syncResult.upToDate.push(file.path);
          console.log("file up to date", file.path);
        }
      }

      for (const file of optionalFiles) {
        if (!isModFile(file.path)) continue;

        const normalPath = file.path;
        const disabledPath = `${file.path}.disabled`;
        
        const hasNormal = localHashMap.has(normalPath);
        const hasDisabled = localHashMap.has(disabledPath);

        if (hasDisabled && !hasNormal) {
          syncResult.skipped.push(disabledPath);
          console.log("mod skipped disabled", disabledPath);
          continue;
        }

        if (hasNormal && file.dependencies && file.dependencies.length > 0) {
          const missingDependencies: string[] = [];
          for (const depPath of file.dependencies) {
            const depNormalPath = depPath;
            if (!localHashMap.has(depNormalPath)) {
              missingDependencies.push(depPath);
            }
          }

          if (missingDependencies.length > 0) {
            syncResult.toDisable.push(normalPath);
            console.log("mod to disable dependencies", { mod: normalPath, missing: missingDependencies });
          }
        }
      }

      for (const localPath of localHashMap.keys()) {
        const inMelorium = isInMeloriumFolder(localPath);
        
        if (localPath.endsWith('.disabled')) {
          const normalPath = localPath.replace(/\.disabled$/, '');
          if (isOptionalMod(normalPath, serverFileMap)) {
            console.log("disabled mod skipped", localPath);
            continue;
          }
        }
        
        if (matchesIgnoredPath(localPath, ignoredPaths)) {
          console.log("local file ignored", localPath);
          continue;
        }
        
        if (inMelorium && !serverFileMap.has(localPath)) {
          const serverFile = serverManifest.files.find(f => f.path === localPath);
          if (!serverFile || !serverFile.optional) {
            syncResult.toDelete.push(localPath);
            console.log("file to delete", localPath);
          }
        }
      }

    } catch (error) {
      console.error('File comparison failed', error);
      Sentry.captureException(error);
      throw error;
    } finally {
      setIsComparingFiles(false);
    }

    console.log("comparison result", {
      toDownload: syncResult.toDownload,
      toUpdate: syncResult.toUpdate,
      toDelete: syncResult.toDelete,
      toDisable: syncResult.toDisable
    });

    return syncResult;
  }, [isInMeloriumFolder, isModFile, isOptionalMod]);

  const deleteFile = useCallback(async (filePath: string, gameDir: string) => {
    const localPath = await join(gameDir, filePath);
    console.log("delete file", localPath);
    try {
      await remove(localPath);
      console.log("file deleted", localPath);
    } catch(error) {
      console.error("Delete failed", error);
    }
  }, []);

  const disableMod = useCallback(async (filePath: string, gameDir: string) => {
    const localPath = await join(gameDir, filePath);
    const disabledPath = `${localPath}.disabled`;
    
    console.log("disable mod", { from: localPath, to: disabledPath });
    
    if (await exists(localPath)) {
      await rename(localPath, disabledPath);
      console.log("mod disabled", disabledPath);
    }
  }, []);

  const syncFiles = useCallback(async (
    syncResult: SyncResult,
    gameDir: string
  ): Promise<void> => {
    console.log("start file sync", {
      toDownload: syncResult.toDownload,
      toUpdate: syncResult.toUpdate,
      toDelete: syncResult.toDelete,
      toDisable: syncResult.toDisable
    });
    
    setIsSyncingFiles(true);

    try {
      const totalOperations = 
        syncResult.toDownload.length + 
        syncResult.toUpdate.length + 
        syncResult.toDelete.length +
        syncResult.toDisable.length;

      if (totalOperations === 0) {
        console.log("no sync operations needed");
        return;
      }

      let currentOperation = 0;
      const updateProgress = () => {
        currentOperation++;
        const percent = Math.round((currentOperation / totalOperations) * 100);
        setSyncProgress({ current: currentOperation, total: totalOperations, percent });
      };

      for (const filePath of syncResult.toDisable) {
        await disableMod(filePath, gameDir);
        updateProgress();
      }

      for (const file of syncResult.toDownload) {
        const localPath = await join(gameDir, file.path);
        console.log("download file", { path: file.path, url: file.url });
        await downloadFile(file.url, localPath, { 
          strategy: 'fallback', 
          taskId: crypto.randomUUID() 
        });
        updateProgress();
      }

      for (const file of syncResult.toUpdate) {
        await deleteFile(file.path, gameDir);
        
        const localPath = await join(gameDir, file.path);
        console.log("update file", { path: file.path, url: file.url });
        await downloadFile(file.url, localPath, { 
          strategy: 'fallback', 
          taskId: crypto.randomUUID() 
        });
        updateProgress();
      }

      for (const filePath of syncResult.toDelete) {
        await deleteFile(filePath, gameDir);
        updateProgress();
      }

      console.log("sync completed", { totalOperations });

    } catch (error) {
      console.error("Sync failed", error);
      Sentry.captureException(error);
      throw error;
    } finally {
      setIsSyncingFiles(false);
      setSyncProgress({ current: 0, total: 0, percent: 0 });
    }
  }, [downloadFile, deleteFile, disableMod]);

  return {
    compareFiles,
    syncFiles,
    isComparingFiles,
    isSyncingFiles,
    syncProgress,
  };
}
