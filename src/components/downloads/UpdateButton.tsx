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

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const resetState = useCallback((): void => {
    setStarted(false);
    setBusy(false);
    setPercent(0);
    setStage('Ожидание');
    lastStageRef.current = '';
  }, []);

  const handleDialogOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) resetState();
      setDialogOpen(open);
    },
    [resetState]
  );

  useEffect(() => {
    const unsubscribers: UnlistenFn[] = [];

    const wire = async (): Promise<void> => {
      unsubscribers.push(
        await listen<string>('git-start', () => {
          console.log('[pull] start');
          setStarted(true);
          setBusy(true);
          setPercent(0);
          setStage('Инициализация');
          lastStageRef.current = 'Инициализация';
        })
      );

      unsubscribers.push(
        await listen<string>('git-progress', (event) => {
          const progressLine = String(event.payload || '');
          const nowTs = performance.now();

          console.log('[pull]', progressLine);

          if (nowTs - lastProgressLogTsRef.current > 300) {
            lastProgressLogTsRef.current = nowTs;
          }

          let matchedStage = false;

          for (const stageRule of STAGES as Array<{ key: string; rx: RegExp }>) {
            const match = progressLine.match(stageRule.rx);
            if (match) {
              const value = Number(match[1]);
              if (!Number.isNaN(value)) {
                setPercent(Math.max(0, Math.min(100, value)));
              }
              if (lastStageRef.current !== stageRule.key) {
                setStage(stageRule.key);
                lastStageRef.current = stageRule.key;
              }
              matchedStage = true;
              break;
            }
          }

          if (!matchedStage) {
            for (const stageRule of STAGES as Array<{ key: string; rx: RegExp }>) {
              if (progressLine.includes(stageRule.key)) {
                if (lastStageRef.current !== stageRule.key) {
                  setStage(stageRule.key);
                  lastStageRef.current = stageRule.key;
                }
                matchedStage = true;
                break;
              }
            }
          }

          if (!matchedStage && lastStageRef.current !== 'Проверка целостности') {
            setStage('Проверка целостности');
            lastStageRef.current = 'Проверка целостности';
          }
        })
      );

      unsubscribers.push(
        await listen<string>('git-error', (event) => {
          console.error('[pull] error:', event?.payload ?? '');
          setBusy(false);
          setStage('Ошибка');
        })
      );

      unsubscribers.push(
        await listen<string>('git-complete', () => {
          console.log('[pull] complete');
          setPercent(100);
          setStage('Завершение');
          setBusy(false);
        })
      );
    };

    void wire();
    return () => {
      for (const unlisten of unsubscribers) unlisten();
    };
  }, []);

  const handleStartUpdate = useCallback(async (): Promise<void> => {
    if (!gameDir) return;

    setDialogOpen(true);
    setStarted(true);
    setBusy(true);
    setPercent(0);
    setStage('Инициализация');
    lastStageRef.current = 'Инициализация';

    try {
      const gitPath = await resolveResource('portable-git/bin/git.exe');

      // reset + clean before pull
      await invoke('reset_repository_hard', {
        args: {
          git_path: gitPath,
          repository_path: gameDir,
          hard_target: 'HEAD',
        },
      });

      await invoke('clean_repository', {
        args: {
          git_path: gitPath,
          repository_path: gameDir,
          include_ignored: false,
          pathspecs: null,
        },
      });

      // pull with progress
      await invoke('pull_repo_with_fallback', {
        args: {
          git_path: gitPath,
          repo_path: gameDir,
        },
      });
    } catch {
      setBusy(false);
      setStage('Ошибка');
    }
  }, [gameDir]);

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
