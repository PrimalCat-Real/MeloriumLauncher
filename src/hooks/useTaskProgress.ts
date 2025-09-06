import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import prettyBytes from "pretty-bytes";
import dayjs from "dayjs";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  StageEvent,
  DownloadStart,
  DownloadProgress,
  DownloadDone,
  UnzipStart,
  UnzipProgress,
  UnzipDone,
  TaskError,
} from "@/lib/progressEvents";

type StageLabel = "Инициализация" | "Загрузка" | "Распаковка" | "Проверка" | "Готово";

export type TaskState = {
  stage: StageLabel;
  percent: number;
  name?: string;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  etaSec: number;
  entriesDone: number;
  totalEntries: number;
  error?: string;
};

export const useTaskProgress = (taskId: string) => {
  const [state, setState] = useState<TaskState>({
    stage: "Инициализация",
    percent: 0,
    name: undefined,
    downloadedBytes: 0,
    totalBytes: 0,
    speedBps: 0,
    etaSec: 0,
    entriesDone: 0,
    totalEntries: 0,
    error: undefined,
  });

  const unsubs = useRef<UnlistenFn[]>([]);

  const handleStage = useCallback((payload: StageEvent) => {
    if (payload.taskId !== taskId) return;
    setState((prev) => ({ ...prev, stage: payload.label as StageLabel }));
  }, [taskId]);

  const handleDownloadStart = useCallback((payload: DownloadStart) => {
    if (payload.taskId !== taskId) return;
    setState((prev) => ({
      ...prev,
      name: payload.name,
      totalBytes: payload.totalBytes,
      downloadedBytes: 0,
      percent: 0,
      stage: "Загрузка",
    }));
  }, [taskId]);

  const handleDownloadProgress = useCallback((payload: DownloadProgress) => {
    if (payload.taskId !== taskId) return;
    const percent = payload.totalBytes > 0
      ? Math.min(100, (payload.downloadedBytes / payload.totalBytes) * 100)
      : 0;
    setState((prev) => ({
      ...prev,
      downloadedBytes: payload.downloadedBytes,
      totalBytes: payload.totalBytes,
      speedBps: payload.speedBps,
      etaSec: payload.etaSec,
      percent,
      stage: "Загрузка",
    }));
  }, [taskId]);

  const handleDownloadDone = useCallback((payload: DownloadDone) => {
    if (payload.taskId !== taskId) return;
    setState((prev) => ({ ...prev, percent: 100 }));
  }, [taskId]);

  const handleUnzipStart = useCallback((payload: UnzipStart) => {
    if (payload.taskId !== taskId) return;
    setState((prev) => ({
      ...prev,
      stage: "Распаковка",
      entriesDone: 0,
      totalEntries: payload.totalEntries,
      percent: 0,
    }));
  }, [taskId]);

  const handleUnzipProgress = useCallback((payload: UnzipProgress) => {
    if (payload.taskId !== taskId) return;
    setState((prev) => ({
      ...prev,
      stage: "Распаковка",
      entriesDone: payload.entriesDone,
      totalEntries: prev.totalEntries,
      percent: payload.percent,
    }));
  }, [taskId]);

  const handleUnzipDone = useCallback((payload: UnzipDone) => {
    if (payload.taskId !== taskId) return;
    setState((prev) => ({
      ...prev,
      stage: "Готово",
      percent: 100,
    }));
  }, [taskId]);

  const handleError = useCallback((payload: TaskError) => {
    if (payload.taskId !== taskId) return;
    setState((prev) => ({ ...prev, error: payload.message }));
  }, [taskId]);

  useEffect(() => {
    const setup = async () => {
      const u1 = await listen<StageEvent>("stage", (e) => handleStage(e.payload));
      const u2 = await listen<DownloadStart>("download:start", (e) => handleDownloadStart(e.payload));
      const u3 = await listen<DownloadProgress>("download:progress", (e) => handleDownloadProgress(e.payload));
      const u4 = await listen<DownloadDone>("download:done", (e) => handleDownloadDone(e.payload));
      const u5 = await listen<UnzipStart>("unzip:start", (e) => handleUnzipStart(e.payload));
      const u6 = await listen<UnzipProgress>("unzip:progress", (e) => handleUnzipProgress(e.payload));
      const u7 = await listen<UnzipDone>("unzip:done", (e) => handleUnzipDone(e.payload));
      const u8 = await listen<TaskError>("task:error", (e) => handleError(e.payload));
      unsubs.current = [u1, u2, u3, u4, u5, u6, u7, u8];
    };
    setup();
    return () => {
      for (const unsubscribe of unsubs.current) unsubscribe();
      unsubs.current = [];
    };
  }, [handleDownloadDone, handleDownloadProgress, handleDownloadStart, handleError, handleStage, handleUnzipDone, handleUnzipProgress, handleUnzipStart]);

  const formatBytes = useCallback((n: number) => prettyBytes(n), []);
  const formatSpeed = useCallback((bps: number) => `${prettyBytes(bps)}/s`, []);
  const formatEta = useCallback((sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${mm}:${ss}`;
  }, []);

  const ui = useMemo(() => {
    const downloaded = formatBytes(state.downloadedBytes);
    const total = state.totalBytes > 0 ? formatBytes(state.totalBytes) : "";
    const speed = state.speedBps > 0 ? formatSpeed(state.speedBps) : "";
    const eta = state.etaSec > 0 ? formatEta(state.etaSec) : "";
    return { downloaded, total, speed, eta };
  }, [formatBytes, formatEta, formatSpeed, state.downloadedBytes, state.etaSec, state.speedBps, state.totalBytes]);

  return { state, ui, setState };
};
