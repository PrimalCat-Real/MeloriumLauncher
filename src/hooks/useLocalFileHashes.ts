import { useState, useCallback } from 'react';
import { readDir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';

interface CachedFileInfo {
  hash: string;
  lastModified: number;
  size: number;
}

interface LocalFileHashes {
  [relativePath: string]: string;
}

// Структура ответа от Rust команды get_files_meta_batch
interface RustFileMeta {
  size: number;
  last_modified: number;
  exists: boolean;
}

const CACHE_KEY = 'file_hash_cache';
const BATCH_SIZE = 50; // Оптимальный размер пачки (можно 20-100)

export function useLocalFileHashes() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // --- Работа с кэшем (без изменений) ---
  const loadCache = useCallback((): Map<string, CachedFileInfo> => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return new Map();

      const parsed = JSON.parse(cached);
      return new Map(Object.entries(parsed));
    } catch (e) {
      console.warn('[cache] Failed to load cache:', e);
      return new Map();
    }
  }, []);

  const saveCache = useCallback((cache: Map<string, CachedFileInfo>) => {
    try {
      const obj = Object.fromEntries(cache);
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('[cache] Failed to save cache:', e);
    }
  }, []);

  // --- Основная логика сканирования ---
  const scanDirectory = useCallback(async (dirPath: string): Promise<LocalFileHashes> => {
    setIsScanning(true);
    const cache = loadCache();
    const finalHashes: LocalFileHashes = {};

    try {
      // ШАГ 1: Мгновенное получение всех файлов через Rust (1 запрос вместо тысяч)
      // Требует реализации команды 'scan_directory_recursive' на бэкенде
      const allFiles = await invoke<string[]>('scan_directory_recursive', { 
        rootPath: dirPath 
      });
      
      const totalFiles = allFiles.length;
      console.log(`[scan] Found ${totalFiles} files via Rust scan`);
      
      setProgress({ current: 0, total: totalFiles });

      // ШАГ 2: Пакетная обработка (Batching)
      for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
        const chunkPaths = allFiles.slice(i, i + BATCH_SIZE);
        
        try {
          // А. Получаем метаданные пачкой (размер, дата)
          const metaMap = await invoke<Record<string, RustFileMeta>>('get_files_meta_batch', { 
            paths: chunkPaths 
          });

          const pathsToHash: string[] = [];

          // Б. Анализируем: кэш vs реальность
          for (const filePath of chunkPaths) {
            const meta = metaMap[filePath];
            
            if (!meta || !meta.exists) continue;

            const cached = cache.get(filePath);

            // Сравниваем с кэшем (размер + время изменения)
            if (cached && cached.size === meta.size && cached.lastModified === meta.last_modified) {
              // Данные актуальны -> берем хеш из кэша
              const relativePath = filePath
                .replace(dirPath, '')
                .replace(/^[\\\/]+/, '') // Убираем лидирующие слеши
                .replace(/\\/g, '/');    // Нормализуем разделители

              finalHashes[relativePath] = cached.hash;
            } else {
              // Файл новый или изменен -> в очередь на хеширование
              pathsToHash.push(filePath);
            }
          }

          // В. Хешируем только то, что реально изменилось
          if (pathsToHash.length > 0) {
            const newHashes = await invoke<Record<string, string>>('hash_files_batch', { 
              paths: pathsToHash 
            });

            // Сохраняем новые хеши
            for (const [filePath, hash] of Object.entries(newHashes)) {
              const meta = metaMap[filePath];
              if (meta && hash) {
                const relativePath = filePath
                  .replace(dirPath, '')
                  .replace(/^[\\\/]+/, '')
                  .replace(/\\/g, '/');

                finalHashes[relativePath] = hash;

                // Обновляем кэш
                cache.set(filePath, {
                  hash,
                  size: meta.size,
                  lastModified: meta.last_modified,
                });
              }
            }
          }

        } catch (e) {
          console.error('[batch] Failed to process chunk:', e);
        }

        // Обновляем UI прогресс
        setProgress({ current: Math.min(i + BATCH_SIZE, totalFiles), total: totalFiles });
      }

      saveCache(cache);
      
      // Лог для отладки (первые 5 файлов)
      const firstFive = Object.entries(finalHashes).slice(0, 5).map(([path, hash]) => ({
        path,
        hash,
      }));
      console.log('[LOCAL MANIFEST] First 5 files:', JSON.stringify(firstFive, null, 2));
      
      return finalHashes;

    } catch (e) {
      console.error('[scan] Fatal error during directory scan:', e);
      setIsScanning(false);
      return {};
    } finally {
      setIsScanning(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [loadCache, saveCache]);
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return {
    scanDirectory,
    clearCache,
    isScanning,
    progress,
  };
}