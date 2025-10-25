import { useState, useCallback } from 'react';
import { readDir, readFile, stat } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

interface CachedFileInfo {
  hash: string;
  lastModified: number;
  size: number;
}

interface LocalFileHashes {
  [relativePath: string]: string;
}

const CACHE_KEY = 'file_hash_cache';

export function useLocalFileHashes() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

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

  const calculateFileHash = useCallback(async (filePath: string): Promise<string> => {
    try {
      const contents = await readFile(filePath);
      const hashBuffer = await crypto.subtle.digest('SHA-256', contents);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      console.error('[hash] Failed to calculate hash for', filePath, e);
      throw e;
    }
  }, []);

  const getFileStats = useCallback(async (filePath: string): Promise<{ size: number; lastModified: number } | null> => {
    try {
      const metadata = await stat(filePath);
      return {
        size: metadata.size,
        lastModified: metadata.mtime ? new Date(metadata.mtime).getTime() : 0,
      };
    } catch (e) {
      return null;
    }
  }, []);

  const getFileHash = useCallback(async (
    filePath: string,
    cache: Map<string, CachedFileInfo>
  ): Promise<string | null> => {
    const stats = await getFileStats(filePath);
    if (!stats) return null;

    const cached = cache.get(filePath);
    
    if (cached && cached.size === stats.size && cached.lastModified === stats.lastModified) {
      return cached.hash;
    }

    const hash = await calculateFileHash(filePath);
    
    cache.set(filePath, {
      hash,
      size: stats.size,
      lastModified: stats.lastModified,
    });

    return hash;
  }, [calculateFileHash, getFileStats]);

  const scanDirectory = useCallback(async (dirPath: string): Promise<LocalFileHashes> => {
    setIsScanning(true);
    const cache = loadCache();
    const hashes: LocalFileHashes = {};
    const allFiles: string[] = [];

    const collectFiles = async (currentPath: string) => {
      try {
        const entries = await readDir(currentPath);
        
        for (const entry of entries) {
          const fullPath = await join(currentPath, entry.name);
          
          if (entry.isDirectory) {
            await collectFiles(fullPath);
          } else if (entry.isFile) {
            allFiles.push(fullPath);
          }
        }
      } catch (e) {
        console.error('[scan] Failed to scan:', currentPath, e);
      }
    };

    await collectFiles(dirPath);
    setProgress({ current: 0, total: allFiles.length });

    for (let i = 0; i < allFiles.length; i++) {
      const fullPath = allFiles[i];
      
      let relativePath = fullPath
        .replace(dirPath, '')
        .replace(/^[\\\/]+/, '')
        .replace(/\\/g, '/');
      
      setProgress({ current: i + 1, total: allFiles.length });

      const hash = await getFileHash(fullPath, cache);
      if (hash) {
        hashes[relativePath] = hash;
      }
    }

    saveCache(cache);
    setIsScanning(false);
    setProgress({ current: 0, total: 0 });

    const firstFive = Object.entries(hashes).slice(0, 5).map(([path, hash]) => ({
      path,
      hash,
    }));

    console.log('[LOCAL MANIFEST] First 5 files:', JSON.stringify(firstFive, null, 2));
    
    return hashes;
  }, [loadCache, saveCache, getFileHash]);

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
