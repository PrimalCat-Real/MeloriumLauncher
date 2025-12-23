'use client'

import { MinecraftLaunchParams, useMinecraftLaunch } from '@/hooks/useMinecraftLaunch'
import { RootState } from '@/store/configureStore';
import React, { useCallback, useMemo, useState } from 'react'
import { useSelector } from 'react-redux';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { LoaderCircle } from 'lucide-react';
import { getPublicIp, whitelistIp } from '@/lib/utils';
import { useLocalFileHashes } from '@/hooks/useLocalFileHashes';
import { useManifest } from '@/hooks/useManifest';
import { useFileSync } from '@/hooks/useFileSync';
import * as Sentry from "@sentry/browser";

interface LauncStatus {
  status: "verify" | "idle" | "launching" | "syncing", 
  message?: string
}

const LaunchButton = () => {
    const { scanDirectory, isScanning } = useLocalFileHashes();
    const { fetchManifest, isLoading: isLoadingManifest } = useManifest();
    const { compareFiles, syncFiles, isSyncing, progress } = useFileSync();
    
    const [launchStatus, setLaunchStatus] = useState<LauncStatus>({status: "idle"})
    
    const activeEndPoint = useSelector((s: RootState) => s.settingsState.activeEndPoint);
    const userLogin = useSelector((state: RootState) => state.authSlice.userLogin);
    const userPassword = useSelector((state: RootState) => state.authSlice.userPassword);
    const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir);
    const javaMemory = useSelector((state: RootState) => state.settingsState.javaMemory);
    const authToken = useSelector((state: RootState) => state.authSlice.authToken);
    const localVersion = useSelector((state: RootState) => state.downloadSlice.localVersion);
    const serverVersion = useSelector((state: RootState) => state.downloadSlice.serverVersion);
    const ignoredPaths = useSelector((state: RootState) => state.downloadSlice.ignoredPaths);
    
    const userUuid = useMemo(() => crypto.randomUUID(), []);

    const gameParams: MinecraftLaunchParams = useMemo(() => ({
        baseDir: gameDir,
        username: userLogin,
        uuid: userUuid,
        token: userPassword,
        memoryMb: javaMemory
    }), [gameDir, userLogin, userUuid, userPassword, javaMemory]);

    const fireAndForget = useCallback((p: Promise<any>) => {
      p.catch((e) => console.warn("[whitelist] failed:", e));
    }, []);

    const handleLaunch = useCallback(async () => {
        try {
          setLaunchStatus({status: "verify"})
          
          // Діагностика ignoredPaths
          console.log('[launch] ignoredPaths from store:', {
            value: ignoredPaths,
            type: typeof ignoredPaths,
            isArray: Array.isArray(ignoredPaths),
            length: Array.isArray(ignoredPaths) ? ignoredPaths.length : 'N/A'
          });
          
          const localHashes = await scanDirectory(gameDir);
          console.log('[launch] Local files scanned');
          console.log(`[launch] Target Endpoint: "${activeEndPoint}"`);
          if (!activeEndPoint) {
              throw new Error("Active Endpoint is missing in settings!");
          }
          
          const serverManifest = await fetchManifest(activeEndPoint, authToken);
          console.log('[launch] Server manifest received');
          
          // Переконуємось що ignoredPaths це масив
          const safeIgnoredPaths = Array.isArray(ignoredPaths) ? ignoredPaths : [];
          
          if (!Array.isArray(ignoredPaths)) {
            console.warn('[launch] ignoredPaths is not an array, using empty array as fallback');
          }
          
          console.log('[launch] Using ignoredPaths:', safeIgnoredPaths);
          
          const syncResult = compareFiles(
              localHashes,
              serverManifest,
              safeIgnoredPaths,
              localVersion || undefined,
              serverVersion || undefined
          );

          const hasChanges = 
            syncResult.toDownload.length > 0 ||
            syncResult.toUpdate.length > 0 ||
            syncResult.toDelete.length > 0 ||
            syncResult.toDisable.length > 0;

          if (hasChanges) {
            console.log('[launch] Changes detected:', {
              toDownload: syncResult.toDownload.length,
              toUpdate: syncResult.toUpdate.length,
              toDelete: syncResult.toDelete.length,
              toDisable: syncResult.toDisable.length
            });
            
            setLaunchStatus({status: "syncing"});
            await syncFiles(syncResult, activeEndPoint, gameDir, authToken);
            console.log('[launch] Files synchronized');
          } else {
            console.log('[launch] No changes, all files up to date');
          }
          
          setLaunchStatus({status: "launching"});
          
          if (activeEndPoint && userLogin && userPassword) {
            fireAndForget(
              (async () => {
                const address = await getPublicIp(10);
                await whitelistIp(activeEndPoint, {
                  address,
                  login: userLogin,
                  accessToken: userPassword,
                }, 15);
              })()
            );
          }

          await useMinecraftLaunch(gameParams);
          
          toast.success("Игра запущена");
          
        } catch (err) {
          console.error('[launch] Error:', err);

          Sentry.withScope((scope) => {
            scope.setTag("section", "game_launch");
            scope.setContext("game_params", {
              memory: gameParams.memoryMb,
              username: gameParams.username
            });
            
            const errString = String(err);
            if (errString.includes("exited with code")) {
              scope.setLevel("fatal"); 
            }
            
            Sentry.captureException(err);
          });

          toast.error("Ошибка при запуске", {
            description: String(err),
          });
        } finally {
          setLaunchStatus({status: "idle"});
        }
    }, [
      scanDirectory, 
      gameDir, 
      fetchManifest,
      activeEndPoint, 
      authToken,
      compareFiles,
      syncFiles,
      localVersion,
      serverVersion,
      ignoredPaths,
      userLogin, 
      userPassword, 
      gameParams, 
      fireAndForget
    ]);

    const isDisabled = useMemo(() => 
      launchStatus.status !== "idle" || isScanning || isSyncing,
      [launchStatus.status, isScanning, isSyncing]
    );

    const buttonContent = useMemo(() => {
      if (launchStatus.status === "launching") {
        return (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Запуск</span>
          </>
        );
      }
      
      if (launchStatus.status === "syncing") {
        return (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span className='text-sm'>{progress.percent}%</span>
          </>
        );
      }
      
      if (launchStatus.status === "verify") {
        return (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Проверка</span>
          </>
        );
      }
      
      return <span>Играть</span>;
    }, [launchStatus.status, progress.percent]);

    return (
      <Button disabled={isDisabled} onClick={handleLaunch}>
        {buttonContent}
      </Button>
    );
}

export default LaunchButton
