'use client'

import { MinecraftLaunchParams, useMinecraftLaunch } from '@/hooks/useMinecraftLaunch'
import { RootState } from '@/store/configureStore';
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../ui/button';
import { join, resolveResource } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { LoaderCircle } from 'lucide-react';
import { deleteFiles, getPublicIp, whitelistIp } from '@/lib/utils';
import { useModsAudit } from '@/hooks/useModsAudit';

interface LauncStatus {
  status: "verify" | "idle" | "launching", 
  message?: string
}

const LaunchButton = () => {
    const dispatch = useDispatch();
    const { activeEndPoint } = useSelector((s: RootState) => s.settingsState);

    const { runAudit, resolveAndDownload } = useModsAudit();
    const [launchStatus, setLaunchStatus]  = useState<LauncStatus>({status: "idle"})
    const { userLogin, userUuid, userPassword } = useSelector(
      (state: RootState) => state.authSlice
    );
    const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir)
    console.log("Game Directory:", gameDir);
    const javaMemory = useSelector((state: RootState) => state.settingsState.javaMemory)
    const gameParams: MinecraftLaunchParams = {
        baseDir: gameDir,
        username: userLogin,
        uuid: userUuid,
        token: userPassword,
        memoryMb: javaMemory
    }

     const fireAndForget = (p: Promise<any>) => {
      p.catch((e) => console.warn("[whitelist] failed:", e));
    };
    const handleLaunch = async () => {
        try {
          
          setLaunchStatus({status: "verify"})
          const gitPath = await resolveResource("portable-git/bin/git.exe");
          // const taskId = crypto.randomUUID();
          // await invoke("reset_repo", {
          //   args: {
          //     git_path: gitPath,
          //     repo_path: gameDir,
          //   },
          // });

          await invoke("reset_repository_hard", {
            args: {
              git_path: gitPath,
              repository_path: gameDir,
              hard_target: "HEAD",
            },
          });

          await invoke("clean_repository", {
              args: {
                git_path: gitPath,
                repository_path: gameDir,
                include_ignored: false,
                pathspecs: null,
              },
          });

          const modsDir = await join(gameDir, 'Melorium', 'mods');
          const audit = await runAudit(modsDir);
          console.log('[launch] audit:', audit);

          if (audit.toDelete.length > 0) {
            // baseDir должен соответствовать корню, относительно которого лежит modsDir
            const deleted = await deleteFiles(modsDir, audit.toDelete);
            console.log('[launch] deleted:', deleted);
          }
          const planned = Array.from(new Set([...audit.toDownload, ...audit.mismatched]));
          console.log('[launch] planned to download:', planned);

          const { downloaded, missingOnServer: unavailableOnServer } =
            await resolveAndDownload(modsDir, planned);

          console.log('[launch] downloaded:', downloaded);
          if (unavailableOnServer.length > 0) {
            console.warn('[launch] unavailable on server:', unavailableOnServer);
          }
          // await deleteExtras();
          // const wanted = [...audit.toDownload, ...audit.mismatched];

          // console.log('[launch] wanted total:', wanted.length);
          // if (wanted.length > 0) {
          //   const { downloadedCount, missingOnServer } = await downloadSelected(wanted);
          //   console.log('[launch] downloadedCount:', downloadedCount, 'missing:', missingOnServer);
          // }
          setLaunchStatus({status: "launching"})
          // // setLaunching(true)
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
        } catch (err) {
          toast.error("Не удалось проверить файлы", {
            description: String(err),
          });
        }
        setLaunchStatus({status: "idle"})
        // setLaunching(false)

    }
  return (
    <Button disabled={launchStatus.status == "verify" || launchStatus.status == "launching"} onClick={handleLaunch}>
      {launchStatus.status == "launching" && (<>
        <LoaderCircle className="h-4 w-4 animate-spin"  /> <span>Запуск</span>
      </>)}
      {launchStatus.status == "verify" && (
        <>
        <LoaderCircle className="h-4 w-4 animate-spin" />
        <span>Проверка</span>
        </>
        )}
      {launchStatus.status == "idle" && (<span>Играть</span>)}
    </Button>
  )
  
}

export default LaunchButton
