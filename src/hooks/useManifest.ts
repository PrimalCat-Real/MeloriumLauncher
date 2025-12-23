import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
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
    const mutation = useMutation({
        mutationFn: async ({ 
            serverUrl, 
            authToken 
        }: { 
            serverUrl: string; 
            authToken?: string | null 
        }): Promise<LauncherManifest> => {
            
            const config = {
                timeout: 0, 
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
            };

            const { data } = await apiClient.get<LauncherManifest>(
                '/launcher/manifest', 
                { 
                   ...config,
                   baseURL: serverUrl
                }
            );
            
            return data;
        },
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });

    return {
        fetchManifest: async (serverUrl: string, authToken?: string | null) => {
            return mutation.mutateAsync({ serverUrl, authToken });
        },
        isLoading: mutation.isPending,
        error: mutation.error
    };
}
