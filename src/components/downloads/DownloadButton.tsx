'use client';

import React, { lazy, memo, Suspense, useCallback, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { invoke } from "@tauri-apps/api/core";
// Импорт функции удаления из плагина FS Tauri v2
import { remove, exists } from "@tauri-apps/plugin-fs"; 
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/configureStore";
import { setGameDir, changeDownloadStatus } from "@/store/slice/downloadSlice";
import { useTaskProgress } from "@/hooks/useTaskProgress";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { GDRIVE_API_KEY, GDRIVE_FILE_ID } from "@/lib/config";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const ProgressPanel = lazy(() => import("../shared/ProgressPanel"));

const DownloadButton: React.FC = () => {
  const dispatch = useDispatch();
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [taskId, setTaskId] = useState<string>("");
  const { state, ui } = useTaskProgress(taskId);

  const handleOpenDialog = useCallback(() => setDialogOpen(true), []);
  
  const handlePickPath = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false, title: "Выберите папку для установки игры" });
    if (selected && typeof selected === "string") {
      let pathToUse = selected;
      // Используем invoke, так как проверка "пустая ли папка" специфична, 
      // но можно переписать на plugin-fs (readDir), если нужно. Оставляю как было.
      const isEmpty = await invoke<boolean>("is_dir_empty", { path: selected }).catch(() => false);
      if (!isEmpty) {
        pathToUse = selected.endsWith("melorium") ? selected : `${selected}/melorium`;
        const meloriumExists = await invoke<boolean>("is_dir_empty", { path: pathToUse }).catch(() => null);
        if (meloriumExists === false) {
          toast.error("Ошибка", { description: "Папка melorium внутри выбранной директории уже существует и не пуста." });
          return;
        }
      }
      dispatch(setGameDir(pathToUse));
    }
  }, [dispatch]);

  const handleStart = useCallback(async () => {
    if (!gameDir) {
      toast.error("Ошибка", { description: "Сначала выберите путь установки." });
      return;
    }
    const id = crypto.randomUUID();
    setTaskId(id);
    setStarted(true);

    const zipPath = `${gameDir}/package.zip`;
    const extractTo = gameDir;

    try {
      await invoke("download_and_unzip_drive", {
        fileId: GDRIVE_FILE_ID,
        apiKey: GDRIVE_API_KEY,
        tempZipPath: zipPath,
        extractTo,
        displayName: "Игра",
        removeZip: true,
        taskId: id,
      });
      // Успех: ставим статус только здесь
      dispatch(changeDownloadStatus("downloaded"));
    } catch (e) {
      console.error("Download error:", e);
      toast.error("Ошибка загрузки", { description: String(e) });

      // --- ЛОГИКА УДАЛЕНИЯ (Tauri v2 API) ---
      try {
        // Проверяем существование перед удалением, чтобы не ловить ошибку "file not found"
        const fileExists = await exists(zipPath);
        if (fileExists) {
           await remove(zipPath);
           console.log("Битый архив успешно удален:", zipPath);
        }
      } catch (cleanupError) {
        console.warn("Не удалось удалить файл через FS плагин:", cleanupError);
      }
      // ---------------------------------------

      // Сбрасываем UI, чтобы юзер мог нажать "Скачать" снова
      setStarted(false); 
    }
  }, [dispatch, gameDir]);

  const canClose = useMemo(() => state.stage === "Готово" || !!state.error, [state.error, state.stage]);
  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open && started && !canClose) return;
    setDialogOpen(open);
  }, [started, canClose]);

  const title = useMemo(() => {
    if (!started) return "Установка";
    if (state.error) return "Ошибка";
    if (state.stage === "Готово") return "Готово";
    return "Загрузка и распаковка";
  }, [started, state.error, state.stage]);

  const renderPanel = useCallback(() => {
    if (!started) {
      return (
        <ProgressPanel
          mode="setup"
          title={title}
          setup={{
            selectedPath: gameDir,
            onPickPath: handlePickPath,
            onStart: handleStart,
            canStart: Boolean(gameDir),
            startLabel: "Скачать",
          }}
        />
      );
    }
    return (
      <ProgressPanel
        mode="progress"
        title={title}
        stage={state.stage}
        percent={state.percent}
        downloaded={ui.downloaded}
        total={ui.total}
        speed={ui.speed}
        eta={ui.eta}
        canClose={canClose}
        onClose={() => handleDialogOpenChange(false)}
      />
    );
  }, [canClose, gameDir, handleDialogOpenChange, handlePickPath, handleStart, started, state.percent, state.stage, title, ui.downloaded, ui.eta, ui.speed, ui.total]);

  return (
    <div className="flex flex-col gap-3">
      <Button size="main" onClick={handleOpenDialog}>
        Скачать
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl" showCloseButton={canClose || !started}>
          {/* Фикс ошибки из консоли (Warning: Missing Description/Title) */}
          <VisuallyHidden>
             <DialogTitle>Меню установки</DialogTitle>
             <DialogDescription>Прогресс загрузки и установки игры</DialogDescription>
          </VisuallyHidden>

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

export default memo(DownloadButton);
