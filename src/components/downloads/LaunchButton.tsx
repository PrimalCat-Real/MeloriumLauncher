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
import { getPublicIp, whitelistIp } from '@/lib/utils';
import { useModsAudit } from '@/hooks/useModsAudit';

interface LauncStatus {
  status: "verify" | "idle" | "launching", 
  message?: string
}

const LaunchButton = () => {
    const dispatch = useDispatch();
    const { activeEndPoint } = useSelector((s: RootState) => s.settingsState);

    const { runAudit, deleteExtras, downloadPlanned } = useModsAudit();
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
          const taskId = crypto.randomUUID();
          // await invoke("reset_repo", {
          //   args: {
          //     git_path: gitPath,
          //     repo_path: gameDir,
          //   },
          // });

          // await invoke("reset_repo_selective", {
          //   gitPath: gitPath,
          //   repoPath: gameDir,
          //   taskId: taskId,
          // });

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

          const modsDir = await join(gameDir, 'Melorium','mods');
          await runAudit(modsDir);
          await deleteExtras();
          await downloadPlanned();
          setLaunchStatus({status: "launching"})
          // setLaunching(true)

          // await useMinecraftLaunch(gameParams);
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
