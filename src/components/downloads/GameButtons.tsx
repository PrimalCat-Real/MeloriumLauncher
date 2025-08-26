'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store/configureStore'
import DownloadButton from './DownloadButton'
import { invoke } from '@tauri-apps/api/core'
import { changeDownloadStatus } from '@/store/slice/downloadSlice'
import UpdateButton from './UpdateButton'
import { Mod, setModsData } from '@/store/slice/modsSlice'
import LaunchButton from './LaunchButton'
import { listen } from '@tauri-apps/api/event'
import path from 'path'
import { resolveResource } from '@tauri-apps/api/path'
import { repo_path, SERVER_ENDPOINTS } from '@/lib/config'
import { toast } from 'sonner'
import { getPlayerSystemInfo, handleIgnoreClientSettings } from '@/lib/utils'
import { WaveDots } from './WaveDots'

const GameButtons = () => {
    const status = useSelector((state: RootState) => state.downloadSlice.status)
    const baseDir = useSelector((state: RootState) => state.downloadSlice.gameDir)
    const activeEndPoint = useSelector(
        (s: RootState) => s.settingsState.activeEndPoint
      )
    const configUrl = useMemo(() => {
    // fallback
    let base = String(activeEndPoint ?? SERVER_ENDPOINTS.main)

    // ensure scheme present
    if (!/^https?:\/\//i.test(base)) base = `http://${base}`

    // remove trailing slashes
    base = base.replace(/\/+$/, '')

    return `${base}/config`
    }, [activeEndPoint])

    const loadModsData = async () => {
        const modsData = await fetch(configUrl)
            .then(response => response.json());
        console.log("modsData", modsData)
        dispatch(setModsData({ mods: modsData.mods, presets: modsData.presets }));
       
    };

    useEffect(()=>{
        const ignoreFiles = async () => {
            if(status == "downloaded"){
                await handleIgnoreClientSettings(baseDir, toast)
            }
        }
        ignoreFiles()
    }, [
        status
    ])

    const checkVersion = async () => {
        // TODO hide mods button if  not downloaded
        try {
            const gitPath = await resolveResource("portable-git/bin/git.exe");
            const args = {
                git_path: gitPath,
                repo_path: baseDir,
            }
            // console.log("Checking git update with args:", args);
            const hasUpdate = await invoke<boolean>('check_git_update', {
                args
            });

            // console.log("Has update:", hasUpdate, localVersion, remoteVersion);
            if (hasUpdate) {
                dispatch(changeDownloadStatus('needUpdate'));
            } else if(baseDir){
                dispatch(changeDownloadStatus('downloaded'));
            }
        } catch (error) {
            dispatch(changeDownloadStatus('needFisrtInstall'));
            console.log("Ошибка проверки версии:", String(error))
            // toast.error("Ошибка проверки версии:", {
            //     description: String(error),
            // });
        }
    }
    const dispatch = useDispatch();
    useEffect(() => {
        loadModsData();
        
        // checkVersion();
    }, [baseDir, status])
    useEffect(() => {
        let interval: NodeJS.Timeout;

        const runCheck = async () => {
            await checkVersion();
        };

        // первый запуск сразу
        runCheck();

        getPlayerSystemInfo().then((info: any) => {
            console.log("Системная информация:", info);
        });


        

        // повторять каждые 30 сек
        interval = setInterval(runCheck, 30000);

        return () => {
            clearInterval(interval);
        };
    }, [baseDir]);

    

    listen<string>('minecraft-launch-progress', (event) => {
        console.log("MC:", event.payload);
    });

    
    
    
    return (
        <div>
            {status === 'needFisrtInstall' && <DownloadButton />}
            {status === 'needUpdate' && <UpdateButton />}
            {status === 'downloaded' && <LaunchButton/>}
        </div>
    )
}

export default GameButtons