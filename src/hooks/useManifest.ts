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

    const maxRetries = 4; 
    let attempt = 0;
    let lastError: any;

    // Время ожидания МЕЖДУ пакетами данных (30 секунд)
    // Если интернет пропал на 30 сек - тогда отбой. Если качает медленно но верно - ждем вечно.
    const IDLE_TIMEOUT_MS = 30000; 

    while (attempt < maxRetries) {
      attempt++;
      
      // Создаем контроллер отмены для текущей попытки
      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout;

      // Функция "Убить запрос, если нет активности"
      const refreshTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          console.warn(`[manifest] No data received for ${IDLE_TIMEOUT_MS}ms. Aborting...`);
          abortController.abort(); // Отменяем запрос
        }, IDLE_TIMEOUT_MS);
      };

      try {
        const currentBaseUrl = attempt < maxRetries ? serverUrl : SERVER_ENDPOINTS.proxy;
        console.log(`[manifest] Attempt ${attempt}/${maxRetries} fetching from ${currentBaseUrl}...`);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        };

        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        // Запускаем таймер смерти перед запросом
        refreshTimeout();

        const response = await axios.get<LauncherManifest>(
          `${currentBaseUrl}/launcher/manifest`,
          {
            headers,
            signal: abortController.signal, // Подключаем наш контроллер
            timeout: 0, // ОТКЛЮЧАЕМ встроенный таймаут axios (0 = бесконечно)
            adapter: 'fetch',
            validateStatus: (status) => status >= 200 && status < 300,
            
            // Самое важное: слушаем прогресс
            onDownloadProgress: (progressEvent) => {
              // Если пришли данные — сбрасываем таймер смерти
              if (progressEvent.loaded > 0) {
                refreshTimeout();
              }
            }
          }
        );
        
        // Очищаем таймер при успехе
        clearTimeout(timeoutId!); 

        console.log(`[manifest] Success on attempt ${attempt}. Ver: ${response.data.version}`);
        setIsLoading(false);
        return response.data;

      } catch (err: any) {
        // Очищаем таймер при ошибке
        clearTimeout(timeoutId!);

        lastError = err;
        // Проверяем, была ли отмена вызвана нашим таймаутом
        const isAbort = axios.isCancel(err) || err.name === 'CanceledError' || abortController.signal.aborted;
        const isNetwork = err.message === "Network Error";

        console.error(
          `[manifest] Attempt ${attempt} failed. Idle Timeout: ${isAbort}, Network: ${isNetwork}, Msg: ${err.message}`
        );

        if (attempt === maxRetries) break;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    const finalError = lastError instanceof Error ? lastError : new Error("Manifest fetch failed after retries");
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
