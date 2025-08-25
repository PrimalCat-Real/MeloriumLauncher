'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';

const AutoUpdater = (): null => {
  const startedRef = useRef(false);

  const runAutoUpdate = useCallback(async (): Promise<void> => {
    try {
      const current = await getVersion();
      const update = await check();
      if (!update) return;

      toast.info('Доступна новая версия', {
        description: `${current} → ${update.version}`,
      });

      await update.downloadAndInstall();

      // On Windows the app exits during install.
      try {
        toast.success('Обновление установлено. Перезапуск...');
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

export default AutoUpdater;
