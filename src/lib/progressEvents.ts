import { z } from "zod";

export const StageEvent = z.object({
  label: z.string(),
  taskId: z.string(),
});
export type StageEvent = z.infer<typeof StageEvent>;

export const DownloadStart = z.object({
  name: z.string(),
  totalBytes: z.number().int().nonnegative(),
  taskId: z.string(),
});
export type DownloadStart = z.infer<typeof DownloadStart>;

export const DownloadProgress = z.object({
  downloadedBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  speedBps: z.number().nonnegative(),
  etaSec: z.number().int().nonnegative(),
  taskId: z.string(),
});
export type DownloadProgress = z.infer<typeof DownloadProgress>;

export const DownloadDone = z.object({
  path: z.string(),
  taskId: z.string(),
});
export type DownloadDone = z.infer<typeof DownloadDone>;

export const UnzipStart = z.object({
  totalEntries: z.number().int().nonnegative(),
  taskId: z.string(),
});
export type UnzipStart = z.infer<typeof UnzipStart>;

export const UnzipProgress = z.object({
  entriesDone: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
  taskId: z.string(),
});
export type UnzipProgress = z.infer<typeof UnzipProgress>;

export const UnzipDone = z.object({
  destination: z.string(),
  taskId: z.string(),
});
export type UnzipDone = z.infer<typeof UnzipDone>;

export const TaskError = z.object({
  message: z.string(),
  taskId: z.string(),
});
export type TaskError = z.infer<typeof TaskError>;
