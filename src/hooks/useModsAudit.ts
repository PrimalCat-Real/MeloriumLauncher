// app/hooks/useModsAudit.ts
'use client';

import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { invoke } from '@tauri-apps/api/core';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/configureStore';

type LocalFile = { path: string; size: number; mtime_ms: number; sha256: string };
type ManifestFile = { path: string; size: number; mtimeMs: number; sha256: string };
type ModsManifest = { generatedAt: string; dirHash: string; required: ManifestFile[]; optional: ManifestFile[] };
type ResolveItem = { path: string; size: number; sha256: string; url: string };
type ResolveResponse = { available: ResolveItem[]; missing: string[]; totalBytes: number; totalCount: number };
type AuditResult = { toDelete: string[]; toDownload: string[]; mismatched: string[]; totalDownloadBytes: number; totalDownloadCount: number };
type ResolveResult = { downloaded: string[]; missingOnServer: string[] };
type DownloadPlannedResult = { planned: string[]; downloaded: string[]; missingOnServer: string[] };
type Status = 'idle' | 'hashing' | 'fetching' | 'diffing' | 'downloading' | 'ready' | 'error';

const buildBaseUrl = (endpoint: string | null | undefined): string => {
  if (!endpoint || endpoint.trim().length === 0) return '';
  let baseUrl = String(endpoint);
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;
  return baseUrl.replace(/\/+$/, '');
};

const normalizePath = (inputPath: string): string => inputPath.replace(/\\/g, '/');
const isJar = (filePath: string): boolean => /\.jar$/i.test(filePath);
const isJarDisabled = (filePath: string): boolean => /\.jar\.disabled$/i.test(filePath);
const toBaseName = (filePath: string): string => filePath.replace(/\.jar(\.disabled)?$/i, '');
const baseKey = (filePath: string): string => toBaseName(normalizePath(filePath)).toLowerCase();
const VERSION_TAIL_RE = /([-_.]v?\d[\w.+-]*)$/i;
const toStem = (filePath: string): string => baseKey(filePath).replace(VERSION_TAIL_RE, '');
const extractVersion = (filePath: string): string => {
  const key = baseKey(filePath);
  const match = key.match(VERSION_TAIL_RE);
  return match ? match[1].replace(/^[-_.]v?/i, '') : '';
};
const compareVersions = (leftVersion: string, rightVersion: string): number => {
  const splitIntoTokens = (input: string) => input.split(/[^0-9A-Za-z]+/).filter(Boolean);
  const leftTokens = splitIntoTokens(leftVersion);
  const rightTokens = splitIntoTokens(rightVersion);
  const tokenCount = Math.max(leftTokens.length, rightTokens.length);
  for (let index = 0; index < tokenCount; index++) {
    const leftToken = leftTokens[index] ?? '';
    const rightToken = rightTokens[index] ?? '';
    const leftIsNumeric = /^\d+$/.test(leftToken);
    const rightIsNumeric = /^\d+$/.test(rightToken);
    if (leftIsNumeric && rightIsNumeric) {
      const leftNumber = Number(leftToken);
      const rightNumber = Number(rightToken);
      if (leftNumber !== rightNumber) return leftNumber < rightNumber ? -1 : 1;
    } else if (leftToken !== rightToken) {
      return leftToken < rightToken ? -1 : 1;
    }
  }
  return 0;
};

export const useModsAudit = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [toDownload, setToDownload] = useState<string[]>([]);
  const [mismatched, setMismatched] = useState<string[]>([]);
  const [totalDownloadBytes, setTotalDownloadBytes] = useState<number>(0);
  const [totalDownloadCount, setTotalDownloadCount] = useState<number>(0);

  const activeEndPoint = useSelector((state: RootState) => state.settingsState.activeEndPoint);
  const { userLogin, userPassword } = useSelector((state: RootState) => state.authSlice);

  const lastModsDirRef = useRef<string>(''); // stores modsDir from last runAudit

  const runAudit = useCallback(
    async (modsDir: string): Promise<AuditResult> => {
      const tStartAll = performance.now();
      setStatus('hashing');
      setError(null);
      lastModsDirRef.current = modsDir;

      const baseUrl = buildBaseUrl(activeEndPoint);
      if (!baseUrl) {
        setStatus('error');
        setError('Active endpoint is not set.');
        return { toDelete: [], toDownload: [], mismatched: [], totalDownloadBytes: 0, totalDownloadCount: 0 };
      }

      let localFiles: LocalFile[] = [];
      const tStartHash = performance.now();
      try {
        const hashedList = (await invoke('hash_mods', { dir: modsDir })) as LocalFile[];
        const filtered: LocalFile[] = [];
        for (const file of hashedList) {
          if (isJar(file.path) || isJarDisabled(file.path)) filtered.push(file);
        }
        localFiles = filtered;
      } catch (errorCaught) {
        setStatus('error');
        setError(`hash_mods failed: ${errorCaught instanceof Error ? errorCaught.message : String(errorCaught)}`);
        return { toDelete: [], toDownload: [], mismatched: [], totalDownloadBytes: 0, totalDownloadCount: 0 };
      } finally {
        console.log('[mods-audit] hash time ms:', Math.max(0, Math.round(performance.now() - tStartHash)));
      }

      setStatus('fetching');
      let manifest: ModsManifest;
      const tStartFetch = performance.now();
      try {
        const { data } = await axios.get<ModsManifest>(`${baseUrl}/mods-manifest`, {
          withCredentials: true,
          timeout: 15000,
        });
        manifest = data;
      } catch (errorCaught) {
        setStatus('error');
        setError(`manifest fetch failed: ${errorCaught instanceof Error ? errorCaught.message : String(errorCaught)}`);
        return { toDelete: [], toDownload: [], mismatched: [], totalDownloadBytes: 0, totalDownloadCount: 0 };
      } finally {
        console.log('[mods-audit] manifest fetch time ms:', Math.max(0, Math.round(performance.now() - tStartFetch)));
      }

      setStatus('diffing');
      const tStartDiff = performance.now();

      type ServerEntry = { manifestFile: ManifestFile; base: string; stem: string; version: string; kind: 'required' | 'optional' };

      const requiredEntries: ServerEntry[] = manifest.required.map((manifestFile) => ({
        manifestFile,
        base: baseKey(manifestFile.path),
        stem: toStem(manifestFile.path),
        version: extractVersion(manifestFile.path),
        kind: 'required',
      }));
      const optionalEntries: ServerEntry[] = manifest.optional.map((manifestFile) => ({
        manifestFile,
        base: baseKey(manifestFile.path),
        stem: toStem(manifestFile.path),
        version: extractVersion(manifestFile.path),
        kind: 'optional',
      }));
      const allServerEntries: ServerEntry[] = [...requiredEntries, ...optionalEntries];

      const bestByStem = new Map<string, ServerEntry>();
      for (const serverEntry of allServerEntries) {
        const previousBest = bestByStem.get(serverEntry.stem);
        if (!previousBest) {
          bestByStem.set(serverEntry.stem, serverEntry);
        } else {
          const cmp = compareVersions(previousBest.version, serverEntry.version);
          if (previousBest.version === '' && serverEntry.version === '') {
            if (previousBest.base < serverEntry.base) continue;
            bestByStem.set(serverEntry.stem, serverEntry);
          } else if (cmp < 0) {
            bestByStem.set(serverEntry.stem, serverEntry);
          }
        }
      }

      const requiredByBase = new Map<string, ManifestFile>();
      const optionalByBase = new Map<string, ManifestFile>();
      for (const [, best] of bestByStem) {
        if (best.kind === 'required') requiredByBase.set(best.base, best.manifestFile);
        else optionalByBase.set(best.base, best.manifestFile);
      }

      const requiredBases = new Set<string>(Array.from(requiredByBase.keys()));
      const optionalBases = new Set<string>(Array.from(optionalByBase.keys()));
      const serverStems = new Set<string>(Array.from(bestByStem.keys()));

      const localEnabledByBase = new Map<string, LocalFile>();
      const localDisabledByBase = new Map<string, LocalFile>();
      const localAllBases = new Set<string>();
      for (const localFile of localFiles) {
        const key = baseKey(localFile.path);
        if (isJar(localFile.path)) {
          localEnabledByBase.set(key, localFile);
          localAllBases.add(key);
        } else if (isJarDisabled(localFile.path)) {
          localDisabledByBase.set(key, localFile);
          localAllBases.add(key);
        }
      }

      const nextToDelete: string[] = [];
      const nextToDownload: string[] = [];
      const nextMismatched: string[] = [];
      let bytesToDownload = 0;

      for (const baseName of requiredBases) {
        const serverMeta = requiredByBase.get(baseName);
        if (!serverMeta) continue;
        const enabledLocal = localEnabledByBase.get(baseName);
        const disabledLocal = localDisabledByBase.get(baseName);
        if (!enabledLocal) {
          nextToDownload.push(serverMeta.path);
          bytesToDownload += serverMeta.size;
          if (disabledLocal) nextToDelete.push(disabledLocal.path);
          continue;
        }
        if (enabledLocal.sha256 !== serverMeta.sha256 || enabledLocal.size !== serverMeta.size) {
          nextMismatched.push(serverMeta.path);
          nextToDelete.push(enabledLocal.path);
          bytesToDownload += serverMeta.size;
        }
      }

      for (const baseName of optionalBases) {
        const serverMeta = optionalByBase.get(baseName);
        if (!serverMeta) continue;
        const enabledLocal = localEnabledByBase.get(baseName);
        const disabledLocal = localDisabledByBase.get(baseName);
        if (!enabledLocal && disabledLocal) continue;
        if (!enabledLocal) continue;
        if (enabledLocal.sha256 !== serverMeta.sha256 || enabledLocal.size !== serverMeta.size) {
          nextMismatched.push(serverMeta.path);
          nextToDelete.push(enabledLocal.path);
          bytesToDownload += serverMeta.size;
        }
      }

      for (const baseName of localAllBases) {
        const isKnown = requiredBases.has(baseName) || optionalBases.has(baseName);
        if (!isKnown) {
          const enabledLocal = localEnabledByBase.get(baseName);
          const disabledLocal = localDisabledByBase.get(baseName);
          if (enabledLocal) nextToDelete.push(enabledLocal.path);
          if (disabledLocal) nextToDelete.push(disabledLocal.path);
        }
      }

      for (const baseName of localAllBases) {
        const stem = baseName.replace(VERSION_TAIL_RE, '');
        if (!serverStems.has(stem)) continue;
        const best = bestByStem.get(stem);
        if (!best) continue;
        if (baseName !== best.base) {
          const enabledLocal = localEnabledByBase.get(baseName);
          const disabledLocal = localDisabledByBase.get(baseName);
          if (enabledLocal) nextToDelete.push(enabledLocal.path);
          if (disabledLocal) nextToDelete.push(disabledLocal.path);
        }
      }

      const deduplicatedDelete = Array.from(new Set(nextToDelete));

      setToDelete(deduplicatedDelete);
      setToDownload(nextToDownload);
      setMismatched(nextMismatched);
      setTotalDownloadBytes(bytesToDownload);
      setTotalDownloadCount(nextToDownload.length + nextMismatched.length);
      setStatus('ready');

      const diffMs = Math.max(0, Math.round(performance.now() - tStartDiff));
      const totalMs = Math.max(0, Math.round(performance.now() - tStartAll));
      console.log('[mods-audit] done', { diffMs, totalMs });

      return {
        toDelete: deduplicatedDelete,
        toDownload: nextToDownload,
        mismatched: nextMismatched,
        totalDownloadBytes: bytesToDownload,
        totalDownloadCount: nextToDownload.length + nextMismatched.length,
      };
    },
    [activeEndPoint]
  );

  const resolveAndDownload = useCallback(
    async (modsDir: string, filePaths: string[]): Promise<ResolveResult> => {
      const baseUrl = buildBaseUrl(activeEndPoint);
      if (!baseUrl || !userLogin || !userPassword || filePaths.length === 0) {
        return { downloaded: [], missingOnServer: [] };
      }
      try {
        setStatus('fetching');
        const { data } = await axios.post<ResolveResponse>(
          `${baseUrl}/download/resolve-mods`,
          { files: filePaths, username: userLogin, password: userPassword },
          { withCredentials: true, timeout: 20000 }
        );

        const overwriteTargets = Array.from(new Set((data.available ?? []).map((item) => item.path)));
        if (overwriteTargets.length > 0) {
          try {
            await invoke('delete_extra_files', { baseDir: modsDir, relativePaths: overwriteTargets });
          } catch (errorCaught) {
            console.log('[mods-download] pre-delete failed, continue:', errorCaught);
          }
        }

        setStatus('downloading');
        const downloadedFiles: string[] = [];
        for (const item of data.available ?? []) {
          try {
            await invoke('download_mod_file', {
              url: `${baseUrl}${item.url}`,
              path: modsDir,
              modName: item.path,
              username: userLogin,
              password: userPassword,
            });
            downloadedFiles.push(item.path);
          } catch (errorCaught) {
            console.log('[mods-download] failed:', item.path, errorCaught);
          }
        }

        setStatus('ready');
        return { downloaded: downloadedFiles, missingOnServer: Array.isArray(data.missing) ? data.missing : [] };
      } catch (errorCaught) {
        setStatus('error');
        setError(errorCaught instanceof Error ? errorCaught.message : String(errorCaught));
        return { downloaded: [], missingOnServer: [] };
      }
    },
    [activeEndPoint, userLogin, userPassword]
  );

  const downloadPlanned = useCallback(
    async (modsDir: string): Promise<DownloadPlannedResult> => {
      const plannedSet = new Set<string>();
      for (const pathToFile of toDownload) plannedSet.add(pathToFile);
      for (const pathToFile of mismatched) plannedSet.add(pathToFile);
      const planned = Array.from(plannedSet);
      const { downloaded, missingOnServer } = await resolveAndDownload(modsDir, planned);
      return { planned, downloaded, missingOnServer };
    },
    [toDownload, mismatched, resolveAndDownload]
  );

  // Backward-compatible API for existing callers (e.g., BulkModDownloader)
  const downloadSelected = useCallback(
    async (files: string[]): Promise<ResolveResult> => {
      const modsDir = lastModsDirRef.current;
      if (!modsDir) return { downloaded: [], missingOnServer: [] };
      const uniqueFiles = Array.from(new Set(files));
      return resolveAndDownload(modsDir, uniqueFiles);
    },
    [resolveAndDownload]
  );

  return {
    status,
    error,
    toDelete,
    toDownload,
    mismatched,
    totalDownloadBytes,
    totalDownloadCount,
    runAudit,
    resolveAndDownload,
    downloadPlanned,
    downloadSelected,
  };
};

export type { ResolveResult, DownloadPlannedResult, AuditResult };
