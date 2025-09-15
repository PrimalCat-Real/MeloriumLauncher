// app/hooks/useModsAudit.ts
'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import pLimit from 'p-limit';
import { invoke } from '@tauri-apps/api/core';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/configureStore';

type LocalFile = { path: string; size: number; mtime_ms: number; sha256: string };
type ManifestFile = { path: string; size: number; mtimeMs: number; sha256: string };
type ModsManifest = {
  generatedAt: string;
  dirHash: string;
  required: ManifestFile[];
  optional: ManifestFile[];
};

type AuditResult = {
  toDelete: string[];
  toDownload: string[];
  mismatched: string[];
  totalDownloadBytes: number;
  totalDownloadCount: number;
};

type Status =
  | 'idle'
  | 'hashing'
  | 'fetching'
  | 'diffing'
  | 'deleting'
  | 'downloading'
  | 'ready'
  | 'error';

type ResolveItem = { path: string; size: number; sha256: string; url: string };
type ResolveResponse = {
  available: ResolveItem[];
  missing: string[];
  totalBytes: number;
  totalCount: number;
};

const CONCURRENCY = 3;
const DEBUG = false; // при необходимости включи

const logGroup = (title: string, fn: () => void): void => {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.groupCollapsed(title);
  try {
    fn();
  } finally {
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
};

const log = (...args: unknown[]): void => {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(...args);
};

const logTable = (label: string, rows: unknown[]): void => {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(label);
  // eslint-disable-next-line no-console
  console.table(rows);
};

const buildBaseUrl = (endpoint: string | null | undefined): string => {
  if (!endpoint || endpoint.trim().length === 0) return '';
  let base = String(endpoint);
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  base = base.replace(/\/+$/, '');
  return base;
};

const normalizePath = (p: string): string => p.replace(/\\/g, '/');
const isJar = (p: string): boolean => /\.jar$/i.test(p);
const isJarDisabled = (p: string): boolean => /\.jar\.disabled$/i.test(p);
const toBaseName = (p: string): string => p.replace(/\.jar(\.disabled)?$/i, '');
const baseKey = (p: string): string => toBaseName(normalizePath(p)).toLowerCase();

// версионный хвост: -1.2.3, _v1.2, -beta, +build, и т.п.
const VERSION_TAIL_RE = /([-_.]v?\d[\w.+-]*)$/i;
const toStem = (p: string): string => baseKey(p).replace(VERSION_TAIL_RE, '');

// извлечь версию для сравнения
const extractVersion = (p: string): string => {
  const k = baseKey(p);
  const m = k.match(VERSION_TAIL_RE);
  return m ? m[1].replace(/^[-_.]v?/i, '') : '';
};

// сравнение версий: числовые токены как числа, остальное лексикографически
const compareVersions = (aRaw: string, bRaw: string): number => {
  const split = (s: string) => s.split(/[^0-9A-Za-z]+/).filter(Boolean);
  const a = split(aRaw);
  const b = split(bRaw);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? '';
    const bi = b[i] ?? '';
    const an = /^\d+$/.test(ai);
    const bn = /^\d+$/.test(bi);
    if (an && bn) {
      const na = Number(ai);
      const nb = Number(bi);
      if (na !== nb) return na < nb ? -1 : 1;
    } else {
      if (ai !== bi) return ai < bi ? -1 : 1;
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

  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [speedBps, setSpeedBps] = useState<number>(0);

  const modsDirRef = useRef<string>('');
  const speedWindowRef = useRef<{ lastTs: number; lastBytes: number }>({ lastTs: 0, lastBytes: 0 });

  const activeEndPoint = useSelector((s: RootState) => s.settingsState.activeEndPoint);
  const userLogin = useSelector((s: RootState) => s.authSlice.userLogin);
  const userPassword = useSelector((s: RootState) => s.authSlice.userPassword);

  const runAudit = useCallback(
    async (modsDir: string): Promise<AuditResult> => {
      const t0 = performance.now();
      setStatus('hashing');
      setError(null);
      modsDirRef.current = modsDir;

      const base = buildBaseUrl(activeEndPoint);
      if (!base) {
        setStatus('error');
        setError('Active endpoint is not set.');
        return {
          toDelete: [],
          toDownload: [],
          mismatched: [],
          totalDownloadBytes: 0,
          totalDownloadCount: 0,
        };
      }

      logGroup('[mods-audit] setup', () => {
        log('endpoint:', base);
        log('modsDir:', modsDir);
        log('user:', userLogin ?? '<empty>');
      });

      // 1) Локальные файлы
      let localFiles: LocalFile[] = [];
      const tHashStart = performance.now();
      try {
        const hashed = (await invoke('hash_mods', { dir: modsDir })) as LocalFile[];
        const next: LocalFile[] = [];
        for (const f of hashed) {
          if (isJar(f.path) || isJarDisabled(f.path)) next.push(f);
        }
        localFiles = next;
        logGroup('[mods-audit] local hashing', () => {
          log(`count: ${localFiles.length}`);
          logTable('sample (first 20)', localFiles.slice(0, 20));
        });
      } catch (e) {
        setStatus('error');
        setError(`hash_mods failed: ${e instanceof Error ? e.message : String(e)}`);
        log('[mods-audit] hash_mods error:', e);
        return {
          toDelete: [],
          toDownload: [],
          mismatched: [],
          totalDownloadBytes: 0,
          totalDownloadCount: 0,
        };
      } finally {
        log('[mods-audit] hash time ms:', Math.max(0, Math.round(performance.now() - tHashStart)));
      }

      await Promise.resolve();

      // 2) Серверный манифест
      setStatus('fetching');
      let manifest: ModsManifest;
      const tFetchStart = performance.now();
      try {
        const { data } = await axios.get<ModsManifest>(`${base}/mods-manifest`, {
          withCredentials: true,
          timeout: 15000,
        });
        manifest = data;
        logGroup('[mods-audit] server manifest', () => {
          log('generatedAt:', manifest.generatedAt);
          log('dirHash:', manifest.dirHash);
          log(`required: ${manifest.required.length}, optional: ${manifest.optional.length}`);
          logTable('required (first 20)', manifest.required.slice(0, 20));
          logTable('optional (first 20)', manifest.optional.slice(0, 20));
        });
      } catch (e) {
        setStatus('error');
        setError(`manifest fetch failed: ${e instanceof Error ? e.message : String(e)}`);
        log('[mods-audit] fetch manifest error:', e);
        return {
          toDelete: [],
          toDownload: [],
          mismatched: [],
          totalDownloadBytes: 0,
          totalDownloadCount: 0,
        };
      } finally {
        log('[mods-audit] manifest fetch time ms:', Math.max(0, Math.round(performance.now() - tFetchStart)));
      }

      await Promise.resolve();

      // 3) Эффективные серверные наборы: оставляем по одной версии на семью (самая "новая")
      setStatus('diffing');
      const tDiffStart = performance.now();

      type ServerEntry = {
        mf: ManifestFile;
        base: string;
        stem: string;
        version: string; // из имени
        kind: 'required' | 'optional';
      };

      const requiredList: ServerEntry[] = manifest.required.map((mf) => ({
        mf,
        base: baseKey(mf.path),
        stem: toStem(mf.path),
        version: extractVersion(mf.path),
        kind: 'required',
      }));
      const optionalList: ServerEntry[] = manifest.optional.map((mf) => ({
        mf,
        base: baseKey(mf.path),
        stem: toStem(mf.path),
        version: extractVersion(mf.path),
        kind: 'optional',
      }));

      const allServer: ServerEntry[] = [...requiredList, ...optionalList];

      const bestByStem = new Map<string, ServerEntry>();
      for (const e of allServer) {
        const prev = bestByStem.get(e.stem);
        if (!prev) {
          bestByStem.set(e.stem, e);
        } else {
          const cmp = compareVersions(prev.version, e.version);
          // если версия неизвестна у обеих, fallback на лексикографию base
          if (prev.version === '' && e.version === '') {
            if (prev.base < e.base) continue;
            bestByStem.set(e.stem, e);
          } else if (cmp < 0) {
            bestByStem.set(e.stem, e);
          }
        }
      }

      const requiredByBase = new Map<string, ManifestFile>();
      const optionalByBase = new Map<string, ManifestFile>();
      for (const [, best] of bestByStem) {
        if (best.kind === 'required') requiredByBase.set(best.base, best.mf);
        else optionalByBase.set(best.base, best.mf);
      }

      const requiredBases = new Set<string>(Array.from(requiredByBase.keys()));
      const optionalBases = new Set<string>(Array.from(optionalByBase.keys()));
      const serverStems = new Set<string>(Array.from(bestByStem.keys()));

      // 4) Индексы локальных
      const localEnabledByBase = new Map<string, LocalFile>();
      const localDisabledByBase = new Map<string, LocalFile>();
      const localAllBases = new Set<string>();
      for (const lf of localFiles) {
        const key = baseKey(lf.path);
        if (isJar(lf.path)) {
          localEnabledByBase.set(key, lf);
          localAllBases.add(key);
        } else if (isJarDisabled(lf.path)) {
          localDisabledByBase.set(key, lf);
          localAllBases.add(key);
        }
      }

      const nextToDelete: string[] = [];
      const nextToDownload: string[] = [];
      const nextMismatched: string[] = [];
      let bytesToDownload = 0;

      // 5) Required: отсутствует → скачать; mismatch → скачать и удалить текущий
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
          nextToDelete.push(enabledLocal.path); // гарантированная перезапись
          bytesToDownload += serverMeta.size;
        }
      }

      // 6) Optional: аналогично, но disabled оставляем как есть
      for (const baseName of optionalBases) {
        const serverMeta = optionalByBase.get(baseName);
        if (!serverMeta) continue;

        const enabledLocal = localEnabledByBase.get(baseName);
        const disabledLocal = localDisabledByBase.get(baseName);

        if (!enabledLocal && disabledLocal) continue;

        if (!enabledLocal) {
          // по желанию можно автоскачивать optional, но сейчас не добавляем
          continue;
        }

        if (enabledLocal.sha256 !== serverMeta.sha256 || enabledLocal.size !== serverMeta.size) {
          nextMismatched.push(serverMeta.path);
          nextToDelete.push(enabledLocal.path);
          bytesToDownload += serverMeta.size;
        }
      }

      // 7) Удалить все лишние и старые версии семей
      for (const baseName of localAllBases) {
        const isKnown = requiredBases.has(baseName) || optionalBases.has(baseName);
        if (!isKnown) {
          const e = localEnabledByBase.get(baseName);
          const d = localDisabledByBase.get(baseName);
          if (e) nextToDelete.push(e.path);
          if (d) nextToDelete.push(d.path);
          continue;
        }
      }

      // Если сервер по ошибке держал несколько версий в одной семье, оставляем только "лучшую"
      // и удаляем локальные, у которых stem совпадает, но baseName != best.base.
      for (const baseName of localAllBases) {
        const stem = baseName.replace(VERSION_TAIL_RE, '');
        if (!serverStems.has(stem)) continue;
        const best = bestByStem.get(stem);
        if (!best) continue;
        if (baseName !== best.base) {
          const e = localEnabledByBase.get(baseName);
          const d = localDisabledByBase.get(baseName);
          if (e) nextToDelete.push(e.path);
          if (d) nextToDelete.push(d.path);
        }
      }

      const dedupDelete = Array.from(new Set(nextToDelete));

      logGroup('[mods-audit] diff result', () => {
        log('bytesToDownload:', bytesToDownload);
        logTable('toDownload', nextToDownload.map((p) => ({ path: p })));
        logTable('mismatched', nextMismatched.map((p) => ({ path: p })));
        logTable('toDelete', dedupDelete.map((p) => ({ path: p })));
      });

      setToDelete(dedupDelete);
      setToDownload(nextToDownload);
      setMismatched(nextMismatched);
      setTotalDownloadBytes(bytesToDownload);
      setTotalDownloadCount(nextToDownload.length + nextMismatched.length);
      setStatus('ready');

      const dtDiff = Math.max(0, Math.round(performance.now() - tDiffStart));
      const totalDt = Math.max(0, Math.round(performance.now() - t0));
      log('[mods-audit] diff time ms:', dtDiff, 'total runAudit ms:', totalDt);

      return {
        toDelete: dedupDelete,
        toDownload: nextToDownload,
        mismatched: nextMismatched,
        totalDownloadBytes: bytesToDownload,
        totalDownloadCount: nextToDownload.length + nextMismatched.length,
      };
    },
    [activeEndPoint, userLogin]
  );

  const deleteExtras = useCallback(async (): Promise<number> => {
    if (toDelete.length === 0 || !modsDirRef.current) {
      log('[mods-audit] deleteExtras: nothing to delete');
      return 0;
    }
    setStatus('deleting');
    logGroup('[mods-audit] deleting extras', () => {
      log('baseDir:', modsDirRef.current);
      logTable('relativePaths', toDelete.map((p) => ({ path: p })));
    });
    try {
      const deleted = (await invoke('delete_extra_files', {
        baseDir: modsDirRef.current,
        relativePaths: toDelete,
      })) as number;
      setStatus('ready');
      log('[mods-audit] deleted count:', deleted);
      return deleted;
    } catch (e) {
      setStatus('error');
      setError(`delete_extra_files failed: ${e instanceof Error ? e.message : String(e)}`);
      log('[mods-audit] delete_extra_files error:', e);
      return 0;
    }
  }, [toDelete]);

  const resetDownloadProgress = useCallback((totalBytes: number) => {
    setDownloadedBytes(0);
    setSpeedBps(0);
    setTotalDownloadBytes(totalBytes);
    speedWindowRef.current = { lastTs: performance.now(), lastBytes: 0 };
    log('[mods-audit] progress reset, totalBytes:', totalBytes);
  }, []);

  const addDownloaded = useCallback(
    (deltaBytes: number) => {
      setDownloadedBytes((prev) => {
        const next = prev + deltaBytes;
        const now = performance.now();
        const { lastTs, lastBytes } = speedWindowRef.current;
        const dtMs = now - lastTs;
        if (dtMs >= 250) {
          const dBytes = next - lastBytes;
          const bps = dBytes > 0 && dtMs > 0 ? (dBytes * 1000) / dtMs : 0;
          setSpeedBps((prevBps) => (prevBps === 0 ? bps : prevBps * 0.7 + bps * 0.3));
          speedWindowRef.current = { lastTs: now, lastBytes: next };
          log('[mods-audit] progress tick:', {
            downloadedBytes: next,
            totalDownloadBytes,
            speedBps: Math.round(bps),
            pct: totalDownloadBytes > 0 ? Math.floor((next / totalDownloadBytes) * 100) : 0,
          });
        }
        return next;
      });
    },
    [totalDownloadBytes]
  );

  const resolveAndDownload = useCallback(
    async (wanted: string[]): Promise<{ downloadedCount: number; missingOnServer: string[] }> => {
      const base = buildBaseUrl(activeEndPoint);
      if (!base) {
        setError('Active endpoint is not set.');
        return { downloadedCount: 0, missingOnServer: [] };
      }
      if (!modsDirRef.current) {
        setError('modsDir is not set. Call runAudit first.');
        return { downloadedCount: 0, missingOnServer: [] };
      }
      if (wanted.length === 0) {
        log('[mods-audit] resolveAndDownload: nothing to download');
        return { downloadedCount: 0, missingOnServer: [] };
      }

      logGroup('[mods-audit] download plan request', () => {
        log('endpoint:', base);
        log('modsDir:', modsDirRef.current);
        logTable('wanted', wanted.map((p) => ({ path: p })));
      });

      setStatus('fetching');
      const tResolve = performance.now();
      const { data } = await axios.post<ResolveResponse>(
        `${base}/download/resolve-mods`,
        { files: wanted, username: userLogin, password: userPassword },
        { withCredentials: true, timeout: 20000 }
      );
      logGroup('[mods-audit] download plan response', () => {
        log('totalBytes:', data.totalBytes, 'totalCount:', data.totalCount);
        logTable(
          'available',
          (data.available ?? []).map((x) => ({ path: x.path, size: x.size, url: x.url }))
        );
        logTable('missing', (data.missing ?? []).map((p) => ({ path: p })));
      });
      log('[mods-audit] resolve time ms:', Math.round(performance.now() - tResolve));

      resetDownloadProgress(data.totalBytes);

      // Перед скачиванием принудительно удалим целевые имена,
      // чтобы перекачка с тем же именем всегда сработала.
      if (data.available?.length) {
        const overwriteTargets = Array.from(new Set(data.available.map((x) => x.path)));
        logGroup('[mods-audit] pre-delete overwrite targets', () => {
          logTable('targets', overwriteTargets.map((p) => ({ path: p })));
        });
        try {
          await invoke('delete_extra_files', {
            baseDir: modsDirRef.current,
            relativePaths: overwriteTargets,
          });
        } catch (e) {
          log('[mods-audit] pre-delete overwrite error:', e);
          // продолжаем, загрузчик на Rust должен открывать с truncate
        }
      }

      setStatus('downloading');
      const limit = pLimit(CONCURRENCY);
      let downloadedCount = 0;

      const tasks: Promise<void>[] = [];
      for (const item of data.available) {
        const task = limit(async () => {
          const tStart = performance.now();
          logGroup(`[mods-audit] download start: ${item.path}`, () => {
            log('url:', `${base}${item.url}`);
            log('size:', item.size);
          });
          try {
            await invoke('download_mod_file', {
              url: `${base}${item.url}`,
              path: modsDirRef.current,
              mod_name: item.path,
              modName: item.path,
              username: userLogin,
              password: userPassword,
            });
            addDownloaded(item.size);
            downloadedCount += 1;
            log(
              `[mods-audit] download ok: ${item.path} (${Math.round(performance.now() - tStart)} ms)`
            );
          } catch (e) {
            const reason = e instanceof Error ? e.message : String(e);
            log(`[mods-audit] download failed: ${item.path}`, reason);
          }
        });
        tasks.push(task);
      }

      const tAll = performance.now();
      for (const t of tasks) {
        await t;
      }
      log('[mods-audit] all downloads done in ms:', Math.round(performance.now() - tAll));

      setStatus('ready');
      return { downloadedCount, missingOnServer: Array.isArray(data.missing) ? data.missing : [] };
    },
    [activeEndPoint, userLogin, userPassword, resetDownloadProgress, addDownloaded]
  );

  const downloadPlanned = useCallback(async (): Promise<{ downloadedCount: number; missingOnServer: string[] }> => {
    const wanted: string[] = [];
    for (const p of toDownload) wanted.push(p);
    for (const p of mismatched) wanted.push(p);
    return resolveAndDownload(wanted);
  }, [toDownload, mismatched, resolveAndDownload]);

  const downloadSelected = useCallback(
    async (files: string[]): Promise<{ downloadedCount: number; missingOnServer: string[] }> => {
      const unique = Array.from(new Set(files));
      return resolveAndDownload(unique);
    },
    [resolveAndDownload]
  );

  const summary = useMemo(
    () => ({
      deleteCount: toDelete.length,
      downloadCount: totalDownloadCount,
      downloadBytes: totalDownloadBytes,
      downloadedBytes,
      speedBps,
      progress:
        totalDownloadBytes > 0 ? Math.min(100, Math.floor((downloadedBytes / totalDownloadBytes) * 100)) : 0,
    }),
    [toDelete.length, totalDownloadCount, totalDownloadBytes, downloadedBytes, speedBps]
  );

  const placeholders = useMemo(
    () => ({
      logPlannedDownloads: () => {
        logGroup('[mods-audit] planned', () => {
          if (toDownload.length > 0) logTable('toDownload', toDownload.map((p) => ({ path: p })));
          if (mismatched.length > 0) logTable('mismatched', mismatched.map((p) => ({ path: p })));
        });
      },
    }),
    [toDownload, mismatched]
  );

  return {
    status,
    error,
    toDelete,
    toDownload,
    mismatched,
    totalDownloadBytes,
    totalDownloadCount,
    downloadedBytes,
    speedBps,
    summary,
    runAudit,
    deleteExtras,
    resetDownloadProgress,
    addDownloaded,
    downloadPlanned,
    downloadSelected,
    placeholders,
  };
};
