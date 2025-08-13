'use client'
import React, { useEffect, useState } from 'react'
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
import { repo_path } from '@/lib/config'
import { toast } from 'sonner'
import { getPlayerSystemInfo, handleIgnoreClientSettings } from '@/lib/utils'
import { WaveDots } from './WaveDots'

const GameButtons = () => {
    const status = useSelector((state: RootState) => state.downloadSlice.status)
    const baseDir = useSelector((state: RootState) => state.downloadSlice.gameDir)

    const gitUrl = 'https://raw.githubusercontent.com/PrimalCat-Real/MeloriumMods/refs/heads/main/melorium.json'

    // const [globalVersion, setGlobalVersion] = useState()
    const [localVersion, setLocalVersion] = useState()


    const loadModsData = async () => {
        try {
            const localVersionStr = await invoke('get_local_version_json', { path: path.join(baseDir, "melorium.json") }) as string;
            const localJson = JSON.parse(localVersionStr);
            dispatch(setModsData({ mods: localJson.mods, presets: localJson.presets }));
        } catch (error) {
            console.error("Ошибка загрузки модов:", error);
            if ((error instanceof Error) && error.message.includes('Указанный путь не существует')) {
                dispatch(changeDownloadStatus('needFisrtInstall'));
            }
        }

        await handleIgnoreClientSettings(baseDir, toast)
       
    };

    const checkVersion = async () => {
        
        try {
            const localVersionStr = await invoke('get_local_version_json', { path: path.join(baseDir, "melorium.json") }) as string;
            
            const localJson = JSON.parse(localVersionStr);
            
            const localVersion = localJson.version;

            // const mods = localJson.mods.map((mod: Mod) => {
            //     return mod.file
            // })

            // await invoke('assume_unchanged_mods', {
            //     args: {
            //         base_dir: baseDir,
            //         files: mods
            //     }
            // });

            // dispatch(setModsData({ mods: localJson.mods, presets: localJson.presets }))
            // TODO make it in config
            const resp = await fetch(gitUrl);
            const remoteJson = await resp.json();
            const remoteVersion = remoteJson.version;
            

            
            setLocalVersion(localVersion)
            

            
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
            if (localVersion !== remoteVersion || hasUpdate) {
                dispatch(changeDownloadStatus('needUpdate'));
            } else if(baseDir){
                dispatch(changeDownloadStatus('downloaded'));
            }

            // if (hasUpdate) {
            //     dispatch(changeDownloadStatus('needUpdate'));
            // } else {
            //     dispatch(changeDownloadStatus('downloaded'));
            // }
        } catch (error) {
            dispatch(changeDownloadStatus('needFisrtInstall'));
            toast.error("Ошибка проверки версии:", {
                description: String(error),
            });
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