import { useState, useCallback } from 'react';
import axios from 'axios';

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

    const maxRetries = 3; // Количество попыток
    let attempt = 0;
    let lastError: any;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`[manifest] Attempt ${attempt}/${maxRetries} fetching from ${serverUrl}...`);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          // Добавляем заголовок, чтобы сервер не кэшировал ответ (для надежности)
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };

        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Добавляем timestamp, чтобы обойти кэширование на уровне провайдеров/прокси
        const response = await axios.get<LauncherManifest>(
          `${serverUrl}/launcher/manifest?t=${Date.now()}`,
          { 
            headers,
            timeout: 15000, // 15 секунд таймаут (ОБЯЗАТЕЛЬНО)
            
            // Валидация статуса: считаем ошибкой всё, что не 200-299
            validateStatus: (status) => status >= 200 && status < 300,
          }
        );

        console.log(`[manifest] Success on attempt ${attempt}. Ver: ${response.data.version}`);

        return response.data;

      } catch (err: any) {
        lastError = err;
        const isTimeout = err.code === 'ECONNABORTED';
        const isNetwork = err.message === 'Network Error';
        
        console.error(`[manifest] Attempt ${attempt} failed. Timeout: ${isTimeout}, Msg: ${err.message}`);

        // Если это последняя попытка — выбрасываем ошибку
        if (attempt === maxRetries) break;

        // Пауза перед следующей попыткой (1с, 2с...)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    // Если вышли из цикла, значит все попытки провалились
    const finalError = lastError instanceof Error ? lastError : new Error('Manifest fetch failed after retries');
    setError(finalError);
    throw finalError;

  }, []);

  return {
    fetchManifest,
    isLoading,
    error,
  };
}
