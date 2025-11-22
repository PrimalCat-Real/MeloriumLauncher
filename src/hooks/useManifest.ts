import { useState, useCallback } from 'react';
import axios from 'axios';
import { SERVER_ENDPOINTS } from '@/lib/config';

interface FileEntry {
  path: string;
  hash: string;
  size: number;
  url: string;
  optional: boolean;
  dependencies?: string[];
}

interface LauncherManifest {
  version: string;
  timestamp: number;
  totalSize: number;
  files: FileEntry[];
}

export function useManifest() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchManifest = useCallback(async (
    serverUrl: string,
    authToken?: string | null
  ): Promise<LauncherManifest> => {
    setIsLoading(true);
    setError(null);

    const maxRetries = 4; // 1-3 main, 4-я через proxy [web:1]
    let attempt = 0;
    let lastError: any;

    while (attempt < maxRetries) {
      try {
        attempt++;

        // Для 1–3 попытки используем основной URL, на 4-й — прокси [web:1]
        const currentBaseUrl =
          attempt < maxRetries
            ? serverUrl
            : SERVER_ENDPOINTS.proxy;

        console.log(
          `[manifest] Attempt ${attempt}/${maxRetries} fetching from ${currentBaseUrl}...`
        );

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        };

        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await axios.get<LauncherManifest>(
          `${currentBaseUrl}/launcher/manifest`,
          {
            headers,
            timeout: 15000,
            validateStatus: (status) => status >= 200 && status < 300
          }
        );

        console.log(
          `[manifest] Success on attempt ${attempt}. Ver: ${response.data.version}`
        );

        setIsLoading(false);
        return response.data;
      } catch (err: any) {
        lastError = err;
        const isTimeout = err.code === "ECONNABORTED";
        const isNetwork = err.message === "Network Error";

        console.error(
          `[manifest] Attempt ${attempt} failed. Timeout: ${isTimeout}, Network: ${isNetwork}, Msg: ${err.message}`
        );

        if (attempt === maxRetries) break;

        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempt)
        );
      }
    }

    const finalError =
      lastError instanceof Error
        ? lastError
        : new Error("Manifest fetch failed after retries");
    setIsLoading(false);
    setError(finalError);
    throw finalError;
  }, []);

  return {
    fetchManifest,
    isLoading,
    error
  };
}
