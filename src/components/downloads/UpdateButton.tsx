// components/update/UpdateButton.tsx
'use client';

import React, { lazy, memo, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/configureStore';

const ProgressPanel = lazy(() => import('@/components/shared/ProgressPanel'));

const UpdateButton: React.FC = () => {
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);

  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState('Ожидание');
  const simTimerRef = useRef<number | null>(null);

  const handleOpenDialog = useCallback(() => { setDialogOpen(true); }, []);

  const stopSimulation = useCallback(() => {
    if (simTimerRef.current !== null) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      stopSimulation();
      setStarted(false);
      setBusy(false);
      setPercent(0);
      setStage('Ожидание');
    }
    setDialogOpen(open);
  }, [stopSimulation]);

  const tickStage = useCallback((p: number): string => {
    if (p < 5) return 'Инициализация';
    if (p < 25) return 'Подготовка LFS';
    if (p < 55) return 'Получение объектов';
    if (p < 80) return 'Слияние изменений';
    if (p < 95) return 'Чекаут файлов';
    return 'Завершение';
  }, []);

  const startSimulation = useCallback(() => {
    setStarted(true);
    setBusy(true);
    setPercent(0);
    setStage('Инициализация');

    stopSimulation();
    let p = 0;
    simTimerRef.current = window.setInterval(() => {
      const step = Math.random() * 6 + 2;
      p = Math.min(100, p + step);
      setPercent(Math.floor(p));
      setStage(tickStage(p));
      if (p >= 100) {
        setBusy(false);
        stopSimulation();
      }
    }, 350);
  }, [stopSimulation, tickStage]);

  const handleStartUpdate = useCallback(async () => {
      if (!gameDir) return;
      // TODO: replace with real git events via tauri
      startSimulation();
    }, [gameDir, startSimulation]);

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
        eta={stage}                 // слева: статус
        leftLabel="Статус"
        showLeftPercent={false}     // не рисовать % слева
        speed={`${percent}%`}       // справа: процент
        rightLabel=""               // подпись справа опциональна
        hideRightSlot={false}
        hideTransferStats={false}
      />
    );
  }, [busy, gameDir, handleStartUpdate, percent, stage, started]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button size="main" onClick={handleOpenDialog}>Обновление</Button>
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
