// components/update/UpdateButton.tsx
'use client';

import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/configureStore";
import { changeDownloadStatus } from "@/store/slice/downloadSlice";
import { listen } from "@tauri-apps/api/event";
import { resolveResource } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { STAGES } from "@/lib/utils";
import { WaveDots } from "./WaveDots";

const ProgressPanel = lazy(() => import("@/components/shared/ProgressPanel"));

const UpdateButton: React.FC = () => {
  const dispatch = useDispatch();
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const outputRef = useRef<string[]>([]);
  const lastStage = useRef<string>("");

  const canClose = useMemo(() => started && (stage === "Готово" || Boolean(error)), [error, stage, started]);

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open && started && !canClose) return;
    setDialogOpen(open);
  }, [canClose, started]);

  const parseProgressText = useCallback((text: string) => {
    let matched = false;

    for (const stageDef of STAGES) {
      const match = text.match(stageDef.rx);
      if (match) {
        if (lastStage.current !== stageDef.key) {
          setPercent(0);
          setStage(stageDef.key);
          lastStage.current = stageDef.key;
        }
        setPercent(Number(match[1]));
        matched = true;
        break;
      }
    }

    if (!matched) {
      for (const stageDef of STAGES) {
        if (text.includes(stageDef.key)) {
          if (lastStage.current !== stageDef.key) {
            setPercent(0);
            setStage(stageDef.key);
            lastStage.current = stageDef.key;
          }
          matched = true;
          break;
        }
      }
    }

    if (!matched && stage !== "Проверка целостности") {
      setStage("Проверка целостности");
      lastStage.current = "Проверка целостности";
    }
  }, [stage]);

  useEffect(() => {
    if (!started) return undefined;

    let unlisten: (() => void) | undefined;
    listen<string>("git-progress", (event) => {
      const text = event.payload || "";
      outputRef.current.push(text);
      parseProgressText(text);
    }).then((dispose) => { unlisten = dispose; });

    return () => {
      if (unlisten) unlisten();
    };
  }, [parseProgressText, started]);

  const handleStartUpdate = useCallback(async () => {
    if (!gameDir) {
      setError("Не задан путь установки");
      return;
    }

    setStarted(true);
    setError(null);
    setPercent(0);
    setStage("");
    outputRef.current = [];
    lastStage.current = "";

    try {
      const gitPath = await resolveResource("portable-git/bin/git.exe");
      await invoke("pull_repo", {
        args: {
          git_path: gitPath,
          repo_path: gameDir,
        },
      });
      setStage("Готово");
      setPercent(100);
      dispatch(changeDownloadStatus("downloaded"));
    } catch (e) {
      setError(String(e));
      setStage("Error");
    }
  }, [dispatch, gameDir]);

  const title = useMemo(() => {
    if (!started) return "Обновление";
    if (error) return "Ошибка";
    if (stage === "Готово") return "Готово";
    return "Обновление репозитория";
  }, [error, stage, started]);

  const renderPanel = useCallback(() => {
    if (!started) {
      return (
        <ProgressPanel
          mode="setup"
          title={title}
          setup={{
            onStart: handleStartUpdate,
            canStart: Boolean(gameDir),
            startLabel: "Обновить",
            hidePathPicker: true,
          }}
        />
      );
    }

    return (
      <ProgressPanel
        mode="progress"
        title={title}
        stage={stage || "Запуск"}
        percent={percent}
        canClose={canClose}
        onClose={() => handleDialogOpenChange(false)}
        hideTransferStats
      />
    );
  }, [canClose, gameDir, handleDialogOpenChange, handleStartUpdate, percent, stage, started, title]);

  const handlePrimaryClick = useCallback(() => {
    handleOpenDialog();
  }, [handleOpenDialog]);

  return (
    <div className="flex flex-col gap-3 items-center">
      <Button size="main" onClick={handlePrimaryClick} disabled={!gameDir}>
        Обновить
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl">
          <Suspense
            fallback={
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex items-center justify-between">
                  <span className="text-sm">Подготовка</span>
                  <span className="text-sm">0%</span>
                </div>
                <Progress className="h-3 w-full" value={0} max={100} />
              </div>
            }
          >
            {renderPanel()}
          </Suspense>

          {started && !error && stage && stage !== "Готово" && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center">
              <span className="flex items-center gap-1">
                {stage}
                <WaveDots />
              </span>
            </div>
          )}


          {error && (
            <div className="mt-2 text-xs text-red-500">
              {error}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(UpdateButton);
