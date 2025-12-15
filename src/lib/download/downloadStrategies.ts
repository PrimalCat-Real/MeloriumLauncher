// src/lib/downloadStrategies.ts
import { invoke } from '@tauri-apps/api/core';

import { writeFile } from '@tauri-apps/plugin-fs';
import { apiClient } from '../api-client';

export type DownloadMethod = 'axios_blob' | 'tauri_simple' | 'tauri_stream';

export interface DownloadContext {
  url: string;
  destination: string;
  token?: string | null;
  onProgress?: (loaded: number, total: number) => void;
}

export const downloadViaAxios = async ({ url, destination, onProgress }: DownloadContext) => {

  const response = await apiClient.get(url, {
    baseURL: undefined, 
    responseType: "arraybuffer",
    onDownloadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        onProgress(progressEvent.loaded, progressEvent.total);
      }
    },
  });

  const uint8Array = new Uint8Array(response.data);
  await writeFile(destination, uint8Array);
};

export const downloadViaTauriSimple = async ({ url, destination, token }: DownloadContext) => {
  await invoke('download_file_simple', { url, path: destination, token });
};

export const downloadViaTauriStream = async ({ url, destination, token }: DownloadContext) => {
  await invoke('download_file_stream', { url, path: destination, token });
};
