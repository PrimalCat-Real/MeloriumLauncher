'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const AutoUpdater = (): null => {
  const startedRef = useRef(false);

  const runAutoUpdate = useCallback(async (): Promise<void> => {
    try {
      const current = await getVersion();
      const update = await check();
      if (!update) return;

      let downloaded = 0;
      let contentLength = 0;

      const toastId = toast.info('Загрузка обновления', {
        description: (
          <div className="space-y-2">
            <div className="text-sm">
              {current} → {update.version}
            </div>
            <Progress value={0} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Загружено: 0%
            </div>
          </div>
        ),
        duration: Infinity,
      });

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            console.log(`Начало загрузки: ${formatBytes(contentLength)}`);
            break;

          case 'Progress':
            downloaded += event.data.chunkLength;
            
            if (contentLength > 0) {
              const progress = Math.round((downloaded / contentLength) * 100);

  
              toast.info('Загрузка обновления', {
                id: toastId,
                description: (
                  <div className="space-y-2">
                    <div className="text-sm">
                      {current} → {update.version}
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      Загружено: {progress}% ({formatBytes(downloaded)} из{' '}
                      {formatBytes(contentLength)})
                    </div>
                  </div>
                ),
                duration: Infinity,
              });
            }
            break;

          case 'Finished':
            toast.success('Обновление установлено', {
              id: toastId,
              description: 'Перезапуск приложения...',
              duration: 2000,
            });
            break;
        }
      });

      try {
        await relaunch();
      } catch {
        // no-op
      }
    } catch (err) {
      toast.error('Ошибка автообновления', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runAutoUpdate();
  }, [runAutoUpdate]);

  return null;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default AutoUpdater;
