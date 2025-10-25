import { useState, useCallback } from 'react';
import axios from 'axios';

interface FileEntry {
  path: string;
  hash: string;
  size: number;
  url: string;
  optional: boolean;
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

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await axios.get<LauncherManifest>(
        `${serverUrl}/launcher/manifest`,
        { headers }
      );

      console.log('Fetched:', {
        version: response.data.version,
        filesCount: response.data.files.length,
        totalSize: response.data.totalSize,
      });

      return response.data;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch manifest');
      setError(error);
      console.error('Error:', error);
      throw error;

    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    fetchManifest,
    isLoading,
    error,
  };
}
