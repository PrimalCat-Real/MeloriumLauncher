// components/update/UpdateButton.tsx
'use client';

import React, { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/configureStore';
import { resolveResource } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { STAGES } from '@/lib/utils';

const ProgressPanel = lazy(() => import('@/components/shared/ProgressPanel'));

const UpdateButton: React.FC = () => {
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState('Ожидание');

  const lastStageRef = useRef<string>('');
  const lastProgressLogTsRef = useRef<number>(0);

  const log = useCallback((label: string, data?: unknown) => {
    const ts = new Date().toISOString();
    if (typeof data === 'undefined') {
      // eslint-disable-next-line no-console
      console.log(`[update] ${ts} ${label}`);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[update] ${ts} ${label}`, data);
  }, []);

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
    log('dialog open');
  }, [log]);

  const resetState = useCallback(() => {
    setStarted(false);
    setBusy(false);
    setPercent(0);
    setStage('Ожидание');
    lastStageRef.current = '';
    log('state reset');
  }, [log]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      log('dialog change', { open });
      if (!open) resetState();
      setDialogOpen(open);
    },
    [log, resetState]
  );

  useEffect(() => {
    const unsubs: UnlistenFn[] = [];

    const wire = async (): Promise<void> => {
      unsubs.push(
        await listen<string>('git-start', () => {
          setStarted(true);
          setBusy(true);
          setPercent(0);
          setStage('Инициализация');
          lastStageRef.current = 'Инициализация';
          log('event git-start');
        })
      );

      unsubs.push(
        await listen<string>('git-progress', (e) => {
          const line = String(e.payload || '');
          const now = performance.now();
          // throttle console noise
          if (now - lastProgressLogTsRef.current > 300) {
            log('event git-progress', { line });
            lastProgressLogTsRef.current = now;
          }

          let matched = false;
          for (const s of STAGES as Array<{ key: string; rx: RegExp }>) {
            const m = line.match(s.rx);
            if (m) {
              const v = Number(m[1]);
              if (!Number.isNaN(v)) {
                setPercent(Math.max(0, Math.min(100, v)));
              }
              if (lastStageRef.current !== s.key) {
                setStage(s.key);
                lastStageRef.current = s.key;
                log('stage set', { stage: s.key });
              }
              matched = true;
              break;
            }
          }
          if (!matched) {
            for (const s of STAGES as Array<{ key: string; rx: RegExp }>) {
              if (line.includes(s.key)) {
                if (lastStageRef.current !== s.key) {
                  setStage(s.key);
                  lastStageRef.current = s.key;
                  log('stage inferred', { stage: s.key });
                }
                matched = true;
                break;
              }
            }
          }
          if (!matched && lastStageRef.current !== 'Проверка целостности') {
            setStage('Проверка целостности');
            lastStageRef.current = 'Проверка целостности';
            log('stage fallback', { stage: 'Проверка целостности' });
          }
        })
      );

      unsubs.push(
        await listen<string>('git-error', (e) => {
          const payload = e?.payload ?? '';
          setBusy(false);
          setStage('Ошибка');
          log('event git-error', { payload });
        })
      );

      unsubs.push(
        await listen<string>('git-complete', () => {
          setPercent(100);
          setStage('Завершение');
          setBusy(false);
          log('event git-complete');
        })
      );
    };

    void wire();
    return () => {
      for (const u of unsubs) u();
      log('events unbound');
    };
  }, [log]);

  const handleStartUpdate = useCallback(async () => {
    if (!gameDir) {
      log('start aborted: no gameDir');
      return;
    }
    setDialogOpen(true);
    setStarted(true);
    setBusy(true);
    setPercent(0);
    setStage('Инициализация');
    lastStageRef.current = 'Инициализация';

    try {
      log('resolve git path...');
      const gitPath = await resolveResource('portable-git/bin/git.exe');
      log('git path', { gitPath });
      log('invoke pull_repo', { repo_path: gameDir });
      await invoke('pull_repo', { args: { git_path: gitPath, repo_path: gameDir } });
      // завершение придёт через git-complete
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBusy(false);
      setStage('Ошибка');
      log('invoke error', { message });
    }
  }, [gameDir, log]);

  const renderPanel = useCallback(() => {
    if (!started) {
      return (
        <ProgressPanel
          mode="setup"
          title="Обновление"
          setup={{
            selectedPath: undefined,
            onPickPath: undefined,
            onStart: handleStartUpdate,
            canStart: Boolean(gameDir) && !busy,
            startLabel: 'Обновить',
            hidePathPicker: true,
          }}
        />
      );
    }
    return (
      <ProgressPanel
        mode="progress"
        title="Обновление"
        stage={stage}
        percent={percent}
        eta={stage}
        leftLabel="Статус"
        showLeftPercent={false}
        speed={`${percent}%`}
        rightLabel=""
        hideRightSlot={false}
        hideTransferStats={false}
      />
    );
  }, [busy, gameDir, handleStartUpdate, percent, stage, started]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button size="default" onClick={handleOpenDialog} disabled={busy || !gameDir}>
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
            {renderPanel()}
          </Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(UpdateButton);
