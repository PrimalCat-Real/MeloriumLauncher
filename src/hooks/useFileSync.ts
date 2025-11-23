import { useState, useCallback } from 'react';
import axios from 'axios';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { remove, mkdir, exists, readDir, rename } from '@tauri-apps/plugin-fs';
import { matchesIgnoredPath } from '@/lib/glob-utils';
import * as Sentry from "@sentry/browser";

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
  const [isComparing, setIsComparing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });

  const isInMeloriamFolder = useCallback((path: string): boolean => {
    return path.startsWith('Melorium/');
  }, []);

  const isModFile = useCallback((path: string): boolean => {
    return path.startsWith('Melorium/mods/') && (path.endsWith('.jar') || path.endsWith('.jar.disabled'));
  }, []);

  /**
   * Проверяет, является ли файл опциональным модом на сервере
   */
  const isOptionalMod = useCallback((filePath: string, serverFileMap: Map<string, FileEntry>): boolean => {
    // Убираем .disabled если есть
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

      console.log('\n=== COMPARISON START ===');
      console.log('Local version:', localVersion || 'none');
      console.log('Server version:', serverVersion || serverManifest.version);
      console.log('Required files:', requiredFiles.length);
      console.log('Optional files:', optionalFiles.length);
      console.log('Ignored patterns:', ignoredPaths);

      const versionUnchanged = !localVersion || localVersion === serverVersion || localVersion === serverManifest.version;

      
      if (versionUnchanged) {
        console.log('Version unchanged, will skip non-Melorium files');
      }

      const localHashMap = new Map(Object.entries(localHashes));
      const serverFileMap = new Map(
        serverManifest.files.map(f => [f.path, f])
      );

      // Обрабатываем обязательные файлы
      for (const file of requiredFiles) {
        const inMelorium = isInMeloriamFolder(file.path);
        
        // Пропускаем файлы в игнорируемых путях (glob patterns)
        if (matchesIgnoredPath(file.path, ignoredPaths)) {
          console.log(`[IGNORED] ${file.path} - matches ignored pattern`);
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
          console.log(`[MISMATCH] ${file.path}`);
          console.log(`  Local:  ${localHash.substring(0, 16)}...`);
          console.log(`  Server: ${file.hash.substring(0, 16)}...`);
        } else {
          result.upToDate.push(file.path);
        }
      }

      // Обрабатываем опциональные моды
      for (const file of optionalFiles) {
        if (!isModFile(file.path)) continue;

        const normalPath = file.path;
        const disabledPath = `${file.path}.disabled`;
        
        const hasNormal = localHashMap.has(normalPath);
        const hasDisabled = localHashMap.has(disabledPath);

        // Если мод отключен (.disabled) - НЕ трогаем его
        if (hasDisabled && !hasNormal) {
          console.log(`[SKIP] ${disabledPath} - optional mod is disabled by user`);
          result.skipped.push(disabledPath);
          continue;
        }

        // Проверяем зависимости только если мод включен
        if (hasNormal && file.dependencies && file.dependencies.length > 0) {
          const missingDeps: string[] = [];
          
          for (const depPath of file.dependencies) {
            const depFile = serverFileMap.get(depPath);
            if (!depFile) continue;

            const depNormalPath = depPath;
            
            // Зависимость должна быть включена (не .disabled)
            if (!localHashMap.has(depNormalPath)) {
              missingDeps.push(depPath);
            }
          }

          // Если есть недостающие зависимости - отключаем мод
          if (missingDeps.length > 0) {
            result.toDisable.push(normalPath);
            console.log(`[DISABLE] ${normalPath} - missing dependencies:`, missingDeps);
          }
        }
      }

      // Проверяем лишние локальные файлы
      for (const localPath of localHashMap.keys()) {
        const inMelorium = isInMeloriamFolder(localPath);
        
        // ВАЖНО: Пропускаем .disabled файлы - они управляются пользователем
        if (localPath.endsWith('.disabled')) {
          // Проверяем, является ли это опциональным модом
          const normalPath = localPath.replace(/\.disabled$/, '');
          if (isOptionalMod(normalPath, serverFileMap)) {
            console.log(`[SKIP] ${localPath} - disabled optional mod, user choice`);
            continue;
          }
        }
        
        // Пропускаем файлы в игнорируемых путях (glob patterns)
        if (matchesIgnoredPath(localPath, ignoredPaths)) {
          console.log(`[IGNORED] ${localPath} - matches ignored pattern`);
          continue;
        }
        
        // Удаляем лишние файлы только в папке Melorium
        if (inMelorium && !serverFileMap.has(localPath)) {
          const serverFile = serverManifest.files.find(f => f.path === localPath);
          
          // Удаляем только если это не опциональный файл
          if (!serverFile || !serverFile.optional) {
            result.toDelete.push(localPath);
          }
        }
      }

      console.log('\n=== SUMMARY ===');
      console.log(`Download: ${result.toDownload.length}`);
      console.log(`Update:   ${result.toUpdate.length}`);
      console.log(`Delete:   ${result.toDelete.length}`);
      console.log(`Disable:  ${result.toDisable.length}`);
      console.log(`Up-to-date: ${result.upToDate.length}`);
      console.log(`Skipped: ${result.skipped.length}`);
      console.log('===============\n');

    } catch (e) {
      console.error('Comparison failed:', e);
      throw e;
    } finally {
      setIsComparing(false);
    }

    return result;
  }, [isInMeloriamFolder, isModFile, isOptionalMod]);

    const downloadFile = useCallback(async (
      file: FileEntry,
      serverUrl: string,
      gameDir: string,
      authToken?: string
    ): Promise<void> => {
      const fullUrl = `${serverUrl}${file.url}`;
      const localPath = await join(gameDir, file.path);

      // Прямая загрузка через Rust (намного быстрее и стабильнее)
      // Retry логика: пробуем 3 раза перед падением
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          await invoke('download_file_direct', {
            url: fullUrl,
            path: localPath,
            authToken: authToken || null
          });
          return; // Успех
        } catch (error) {
          Sentry.captureException(error);
          attempts++;
          console.warn(`[download] Failed to download ${file.path} (Attempt ${attempts}/${maxAttempts}):`, error);
          
          if (attempts === maxAttempts) {
            // На последней попытке пробрасываем ошибку наверх
            throw new Error(`Failed to download ${file.path}: ${error}`);
          }
          
          // Пауза 1 сек перед повтором
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }, []);


  const deleteFile = useCallback(async (
    filePath: string,
    gameDir: string
  ): Promise<void> => {
    const localPath = await join(gameDir, filePath);
    await invoke('delete_file', { path: localPath });
    console.log(`[deleted] ${filePath}`);
  }, []);

  const disableMod = useCallback(async (
    filePath: string,
    gameDir: string
  ): Promise<void> => {
    const localPath = await join(gameDir, filePath);
    const disabledPath = `${localPath}.disabled`;
    
    const fileExists = await exists(localPath);
    if (fileExists) {
      await rename(localPath, disabledPath);
      console.log(`[disabled] ${filePath} -> ${filePath}.disabled`);
    }
  }, []);

  const syncFiles = useCallback(async (
    syncResult: SyncResult,
    serverUrl: string,
    gameDir: string,
    authToken?: string | null
  ): Promise<void> => {
    setIsSyncing(true);
    if(!authToken) { authToken = undefined; }
    try {
      const totalOperations = 
        syncResult.toDownload.length + 
        syncResult.toUpdate.length + 
        syncResult.toDelete.length +
        syncResult.toDisable.length;

      if (totalOperations === 0) {
        console.log('[sync] Nothing to sync');
        return;
      }

      console.group('🔍 SYNC PLAN DETAILS');
      
      if (syncResult.toDownload.length > 0) {
        console.log(`📥 Files to DOWNLOAD (${syncResult.toDownload.length}):`);
        console.table(syncResult.toDownload.map(f => ({ path: f.path, size: f.size })));
      }

      if (syncResult.toUpdate.length > 0) {
        console.log(`🔄 Files to UPDATE (${syncResult.toUpdate.length}):`);
        console.table(syncResult.toUpdate.map(f => ({ path: f.path, hash: f.hash.substring(0,8)+'...' })));
      }

      if (syncResult.toDelete.length > 0) {
        console.log(`🗑️ Files to DELETE (${syncResult.toDelete.length}):`);
        // console.table может тормозить если файлов тысячи, поэтому для удаления (где просто строки) 
        // можно вывести просто список или таблицу, если их не слишком много.
        if (syncResult.toDelete.length < 200) {
            console.table(syncResult.toDelete.map(path => ({ path })));
        } else {
            console.log('(List too long, showing first 20)');
            console.log(syncResult.toDelete.slice(0, 20));
        }
      }

      if (syncResult.toDisable.length > 0) {
        console.log(`🚫 Files to DISABLE (${syncResult.toDisable.length}):`);
        console.table(syncResult.toDisable.map(path => ({ path })));
      }
      
      console.groupEnd();
      // ====================

      let currentOperation = 0;

      console.log('\n=== SYNC START ===');

      

      // 1. Отключаем моды с недостающими зависимостями
      if (syncResult.toDisable.length > 0) {
        console.log(`[sync] Disabling ${syncResult.toDisable.length} mods...`);
        
        for (const filePath of syncResult.toDisable) {
          await disableMod(filePath, gameDir);
          currentOperation++;
          const percent = Math.round((currentOperation / totalOperations) * 100);
          setProgress({ current: currentOperation, total: totalOperations, percent });
        }
      }

      // 2. Скачиваем новые файлы
      if (syncResult.toDownload.length > 0) {
        console.log(`[sync] Downloading ${syncResult.toDownload.length} files...`);
        
        for (const file of syncResult.toDownload) {
          await downloadFile(file, serverUrl, gameDir, authToken);
          currentOperation++;
          const percent = Math.round((currentOperation / totalOperations) * 100);
          setProgress({ current: currentOperation, total: totalOperations, percent });
        }
      }

      // 3. Обновляем изменённые файлы
      if (syncResult.toUpdate.length > 0) {
        console.log(`[sync] Updating ${syncResult.toUpdate.length} files...`);
        
        for (const file of syncResult.toUpdate) {
          await deleteFile(file.path, gameDir);
          await downloadFile(file, serverUrl, gameDir, authToken);
          currentOperation++;
          const percent = Math.round((currentOperation / totalOperations) * 100);
          setProgress({ current: currentOperation, total: totalOperations, percent });
        }
      }

      // 4. Удаляем лишние файлы
      if (syncResult.toDelete.length > 0) {
        console.log(`[sync] Deleting ${syncResult.toDelete.length} files...`);
        
        for (const filePath of syncResult.toDelete) {
          await deleteFile(filePath, gameDir);
          currentOperation++;
          const percent = Math.round((currentOperation / totalOperations) * 100);
          setProgress({ current: currentOperation, total: totalOperations, percent });
        }
      }

      console.log('[sync] Synchronization completed successfully');
      console.log('=================\n');

    } catch (error) {
      Sentry.captureException(error);
      console.error('[sync] Synchronization failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
      setProgress({ current: 0, total: 0, percent: 0 });
    }
  }, [downloadFile, deleteFile, disableMod]);

  return {
    compareFiles,
    syncFiles,
    isComparing,
    isSyncing,
    progress,
  };
}
