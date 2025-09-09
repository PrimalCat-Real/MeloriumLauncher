'use client';

import React, {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/configureStore";
import { changeDownloadStatus } from "@/store/slice/downloadSlice";
import { listen } from "@tauri-apps/api/event";
import { resolveResource } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { STAGES } from "@/lib/utils";
import { WaveDots } from "./WaveDots";
import { Progress } from "../ui/progress";

const ProgressPanel = lazy(() => import("@/components/shared/ProgressPanel"));

const MAX_LOG_LINES = 1000;

const UpdateButton: React.FC = () => {
  const dispatch = useDispatch();
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const outputRef = useRef<string[]>([]);
  const [logVersion, setLogVersion] = useState(0);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const lastStage = useRef<string>("");

  const canClose = useMemo(
    () => started && (stage === "Готово" || Boolean(error)),
    [error, stage, started]
  );

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && started && !canClose) return;
      setDialogOpen(open);
    },
    [canClose, started]
  );

  const bumpLogs = useCallback(() => {
    if (outputRef.current.length > MAX_LOG_LINES) {
      const start = outputRef.current.length - Math.floor(MAX_LOG_LINES * 0.9);
      outputRef.current = outputRef.current.slice(start);
    }
    setLogVersion((v) => v + 1);
  }, []);

  const parseProgressText = useCallback(
    (text: string) => {
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
    },
    [stage]
  );

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [logVersion]);

  useEffect(() => {
    if (!started) return undefined;
    let unlisten: (() => void) | undefined;

    listen<string>("git-progress", (event) => {
      const text = event.payload ?? "";
      if (!text) return;
      outputRef.current.push(text);
      bumpLogs();
      parseProgressText(text);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [bumpLogs, parseProgressText, started]);

  const clearLogs = useCallback(() => {
    outputRef.current = [];
    setLogVersion((v) => v + 1);
  }, []);

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
    setLogVersion((v) => v + 1);

    try {
      const gitPath = await resolveResource("portable-git/bin/git.exe");

      // reset с фильтрами игнорирования модов .jar и .jar.disabled
      await invoke("reset_with_ignore", {
        args: {
          git_path: gitPath,
          repo_path: gameDir,
          ignore_patterns: [
            "Melorium/mods/*.jar",
            "Melorium/mods/*.jar.disabled",
          ],
        },
      });

      // вызов pull с rebase
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
    return "Обновление";
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

          {error && <div className="mt-2 text-xs text-red-500">{error}</div>}

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Логи обновления (тест)</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={clearLogs}
              >
                Очистить
              </button>
            </div>
            <div
              className="h-40 w-full overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px] leading-4"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {outputRef.current.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(UpdateButton);
