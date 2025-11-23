'use client';

import React, { memo, Suspense, useCallback, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/configureStore';
import { changeDownloadStatus, setVersions } from '@/store/slice/downloadSlice';
import { useLocalFileHashes } from '@/hooks/useLocalFileHashes';
import { useManifest } from '@/hooks/useManifest';
import { useFileSync } from '@/hooks/useFileSync';
import { toast } from 'sonner';
import { LoaderCircle } from 'lucide-react';
import { Progress } from '../ui/progress';
import { invoke } from '@tauri-apps/api/core';
import * as Sentry from "@sentry/browser";

interface UpdateStatus {
  stage: 'idle' | 'scanning' | 'comparing' | 'syncing' | 'complete' | 'error';
  message?: string;
  progress?: number;
}

const UpdateButton: React.FC = () => {
  const dispatch = useDispatch();
  
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir);
  const activeEndPoint = useSelector((s: RootState) => s.settingsState.activeEndPoint);
  const authToken = useSelector((state: RootState) => state.authSlice.authToken);
  const localVersion = useSelector((state: RootState) => state.downloadSlice.localVersion);
  const serverVersion = useSelector((state: RootState) => state.downloadSlice.serverVersion);
  const ignoredPaths = useSelector((state: RootState) => state.downloadSlice.ignoredPaths);

  const { scanDirectory, isScanning, progress: scanProgress } = useLocalFileHashes();
  const { fetchManifest, isLoading: isLoadingManifest } = useManifest();
  const { compareFiles, syncFiles, isSyncing, progress: syncProgress } = useFileSync();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ stage: 'idle' });

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const resetState = useCallback((): void => {
    setUpdateStatus({ stage: 'idle' });
  }, []);

  const handleDialogOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) resetState();
      setDialogOpen(open);
    },
    [resetState]
  );

  const updateLocalVersionFile = useCallback(async (dir: string, newVersion: string) => {
    try {
      const configPath = `${dir}/melorium.json`;
      const content = await invoke<string>('get_local_version_json', { path: configPath });
      const json = JSON.parse(content);
      json.version = newVersion;
  
      const updatedContent = JSON.stringify(json, null, 2);
      const encoder = new TextEncoder();
      const data = Array.from(encoder.encode(updatedContent));
      await invoke('write_file_bytes', { path: configPath, data });
      console.log('[update] melorium.json updated to version:', newVersion);
    } catch (e) {
      console.error('[update] Failed to update melorium.json:', e);
      toast.error('Не удалось обновить файл версии', {
          description: 'Возможно, потребуется повторное обновление'
      });
    }
  }, []);

  const handleStartUpdate = useCallback(async (): Promise<void> => {
    if (!gameDir || !activeEndPoint) {
      toast.error('Не указана директория игры или сервер');
      return;
    }

    try {
      // 1. Сканирование локальных файлов
      setUpdateStatus({ stage: 'scanning', message: 'Сканирование файлов...' });
      console.log('[update] Scanning local files...');
      
      const localHashes = await scanDirectory(gameDir);
      console.log('[update] Local files scanned:', Object.keys(localHashes).length);

      // 2. Получение полного манифеста с сервера (все файлы, не только Melorium)
      setUpdateStatus({ stage: 'comparing', message: 'Получение списка файлов с сервера...' });
      console.log('[update] Fetching full manifest from server...');
      
      const serverManifest = await fetchManifest(activeEndPoint, authToken);
      console.log('[update] Server manifest received:', {
        version: serverManifest.version,
        files: serverManifest.files.length,
        totalSize: serverManifest.totalSize
      });

      // 3. Сравнение файлов (БЕЗ фильтрации по версии - обновляем все!)
      setUpdateStatus({ stage: 'comparing', message: 'Сравнение файлов...' });
      console.log('[update] Comparing files...');
      
      const safeIgnoredPaths = Array.isArray(ignoredPaths) ? ignoredPaths : [];
      
      // ВАЖНО: передаем undefined для localVersion и serverVersion 
      // чтобы compareFiles обновлял ВСЕ файлы, а не только Melorium
      const syncResult = compareFiles(
        localHashes,
        serverManifest,
        safeIgnoredPaths,
        undefined, // Не передаем localVersion - обновляем все
        undefined  // Не передаем serverVersion - обновляем все
      );

      const hasChanges = 
        syncResult.toDownload.length > 0 ||
        syncResult.toUpdate.length > 0 ||
        syncResult.toDelete.length > 0 ||
        syncResult.toDisable.length > 0;

      console.log('[update] Changes detected:', {
        toDownload: syncResult.toDownload.length,
        toUpdate: syncResult.toUpdate.length,
        toDelete: syncResult.toDelete.length,
        toDisable: syncResult.toDisable.length,
        hasChanges
      });

      if (!hasChanges) {
         // ДАЖЕ ЕСЛИ ФАЙЛЫ НЕ МЕНЯЛИСЬ, НО ВЕРСИЯ ОТЛИЧАЕТСЯ — ОБНОВЛЯЕМ JSON
         if (localVersion !== serverManifest.version) {
            console.log('[update] No file changes, but version differs. Updating melorium.json...', gameDir);
             await updateLocalVersionFile(gameDir, serverManifest.version);
             dispatch(setVersions({ local: serverManifest.version, server: serverManifest.version }));
             toast.success('Версия обновлена');
         } else {
             toast.success('Обновление не требуется');
         }
         setUpdateStatus({ stage: 'complete', message: 'Все файлы актуальны', progress: 100 });
         setTimeout(() => { setDialogOpen(false); resetState(); }, 2000);
         return;
      }

      // 4. Синхронизация файлов
      setUpdateStatus({ stage: 'syncing', message: 'Обновление файлов...', progress: 0 });
      await syncFiles(syncResult, activeEndPoint, gameDir, authToken);

      // === ВАЖНЫЙ ФИКС: ЯВНОЕ ОБНОВЛЕНИЕ melorium.json ===
      await updateLocalVersionFile(gameDir, serverManifest.version);
      // ====================================================

      // 5. Обновление версии в store
      dispatch(setVersions({
        local: serverManifest.version,
        server: serverManifest.version
      }));

      setUpdateStatus({ stage: 'complete', message: 'Обновление завершено', progress: 100 });
      toast.success('Обновление завершено', { description: `Версия ${serverManifest.version}` });
      dispatch(changeDownloadStatus('downloaded'));

      setTimeout(() => {
        setDialogOpen(false);
        resetState();
      }, 2000);

    } catch (error) {
      Sentry.captureException(error);
      console.error('[update] Update failed:', error);
      setUpdateStatus({ 
        stage: 'error', 
        message: String(error) 
      });
      
      toast.error('Ошибка обновления', {
        description: String(error)
      });
    }
  }, [
    gameDir, 
    activeEndPoint, 
    authToken, 
    ignoredPaths,
    scanDirectory, 
    fetchManifest, 
    compareFiles, 
    syncFiles,
    dispatch,
    resetState
  ]);

  const canStart = useMemo(
    () => Boolean(gameDir) && updateStatus.stage === 'idle',
    [gameDir, updateStatus.stage]
  );

  const isBusy = useMemo(
    () => updateStatus.stage !== 'idle' && updateStatus.stage !== 'complete' && updateStatus.stage !== 'error',
    [updateStatus.stage]
  );

  const progressPercent = useMemo(() => {
    if (updateStatus.stage === 'scanning') {
      return scanProgress.total > 0 
        ? Math.round((scanProgress.current / scanProgress.total) * 100)
        : 0;
    }
    if (updateStatus.stage === 'syncing') {
      return syncProgress.percent;
    }
    if (updateStatus.stage === 'complete') {
      return 100;
    }
    return updateStatus.progress || 0;
  }, [updateStatus, scanProgress, syncProgress]);

  const statusMessage = useMemo(() => {
    switch (updateStatus.stage) {
      case 'scanning':
        return `Сканирование: ${scanProgress.current} / ${scanProgress.total}`;
      case 'comparing':
        return 'Сравнение файлов...';
      case 'syncing':
        return `Синхронизация: ${syncProgress.current} / ${syncProgress.total}`;
      case 'complete':
        return 'Завершено!';
      case 'error':
        return `Ошибка: ${updateStatus.message}`;
      default:
        return 'Готово к обновлению';
    }
  }, [updateStatus, scanProgress, syncProgress]);

  const renderDialogContent = useCallback(() => {
    if (updateStatus.stage === 'idle') {
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 mb-4">
            <h3 className="text-lg font-semibold">Обновление игры</h3>
            <p className="text-sm text-muted-foreground">
              Будут проверены и обновлены все файлы клиента, включая библиотеки и ресурсы Minecraft.
            </p>
            {localVersion && serverVersion && (
              <div className="text-sm space-y-1 flex justify-between w-full">
                <p>Ваща версия: <span className="font-mono">{localVersion}</span></p>
                <p>Текущая версия: <span className="font-mono">{serverVersion}</span></p>
              </div>
            )}
          </div>
          <Button 
            onClick={handleStartUpdate} 
            disabled={!canStart}
            className="w-full"
          >
            Начать обновление
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Обновление игры</h3>
          <div className="flex items-center gap-2">
            {isBusy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            <span className="text-sm text-muted-foreground">{statusMessage}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Прогресс</span>
            <span className="font-mono">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-secondary rounded-full overflow-hidden ">
          </Progress>
        </div>

        {updateStatus.stage === 'complete' && (
          <p className="text-sm text-green-600">
            Обновление успешно завершено!
          </p>
        )}

        {updateStatus.stage === 'error' && (
          <p className="text-sm text-red-600">
            {updateStatus.message}
          </p>
        )}
      </div>
    );
  }, [updateStatus, canStart, isBusy, statusMessage, progressPercent, handleStartUpdate, localVersion, serverVersion]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button 
        size="default" 
        onClick={handleOpenDialog} 
        disabled={isBusy || !gameDir}
      >
        Обновление
      </Button>
      
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl">
          <Suspense
            fallback={
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            }
          >
            {renderDialogContent()}
          </Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(UpdateButton);
