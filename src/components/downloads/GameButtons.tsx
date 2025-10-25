'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store/configureStore'
import DownloadButton from './DownloadButton'
import { invoke } from '@tauri-apps/api/core'
import { changeDownloadStatus, setIgnoredPaths, setLocalVersion, setServerVersion, setVersions } from '@/store/slice/downloadSlice'
import UpdateButton from './UpdateButton'
import { Mod, setModsData } from '@/store/slice/modsSlice'
import LaunchButton from './LaunchButton'
import { listen } from '@tauri-apps/api/event'
import path from 'path'
import { resolveResource } from '@tauri-apps/api/path'
import { SERVER_ENDPOINTS } from '@/lib/config'
import { toast } from 'sonner'
import { getLocalVersion, getPlayerSystemInfo, getServerVersion, handleIgnoreClientSettings } from '@/lib/utils'
import { WaveDots } from './WaveDots'
import { exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import axios from 'axios'



interface ModsConfig {
    mods: any[];
    presets: any[];
    ignoredPaths?: string[];
}
const GameButtons = () => {
    const status = useSelector((state: RootState) => state.downloadSlice.status)
    const baseDir = useSelector((state: RootState) => state.downloadSlice.gameDir)
    const authToken = useSelector((state: RootState) => state.authSlice.authToken)
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

    const versionUrl = useMemo(() => {
        let base = String(activeEndPoint ?? SERVER_ENDPOINTS.main)
        if (!/^https?:\/\//i.test(base)) base = `http://${base}`
        base = base.replace(/\/+$/, '')
        return `${base}/launcher/version`
    }, [activeEndPoint])

    
    

    const loadModsData = async () => {
        try {
            const { data } = await axios.get<ModsConfig>(configUrl);
            console.log("modsData", data);
            
            dispatch(setModsData({ 
                mods: data.mods, 
                presets: data.presets
            }));
            
            if (data.ignoredPaths) {
                dispatch(setIgnoredPaths(data.ignoredPaths));
            }
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                throw error; 
            }
            console.error('loadModsData Error:', error);
        }
    };

    const fetchVersions = async () => {
        try {
            const [local, server] = await Promise.all([
                getLocalVersion(baseDir),
                getServerVersion(versionUrl, authToken)
            ])

            dispatch(setVersions({
                local,
                server: server?.version || null
            }))

            console.log('[versions] Local:', local, 'Server:', server?.version)

            return { local, server: server?.version || null }
        } catch (error) {
            console.error('[versions] Error fetching versions:', error)
            return { local: null, server: null }
        }
    }

    // useEffect(()=>{
    //     const ignoreFiles = async () => {
    //         if(status == "downloaded"){
    //             await handleIgnoreClientSettings(baseDir, toast)
    //         }
    //     }
    //     ignoreFiles()
    // }, [
    //     status
    // ])
    const checkBaseDirectoryPresence = async (): Promise<boolean> => {
        if (!baseDir || typeof baseDir !== 'string' || baseDir.trim() === '') {
            
            return false
        }
        try {
            
            return await exists(baseDir)
        } catch (error) {
            toast.error("Ошибка проверки директории:", {})
            console.error("Ошибка проверки директории:", error)
            return false
        }
    }

    const checkVersion = async () => {
        const baseDirExists = await checkBaseDirectoryPresence()
       
        if (!baseDirExists) {
            dispatch(changeDownloadStatus('needFisrtInstall'))
            return
        }
        const versions = await fetchVersions()

        // if (!versions.local || !versions.server) {
        //     console.log('Missing version data')
        // }
        dispatch(changeDownloadStatus('downloaded'))
    }
    // const checkVersion = async () => {
    //     const baseDirExists = await checkBaseDirectoryPresence()
    //     if (!baseDirExists) {
    //         dispatch(changeDownloadStatus('needFisrtInstall'))
    //     return
    //     }
    //     // TODO hide mods button if  not downloaded
    //     try {
    //         const gitPath = await resolveResource("portable-git/bin/git.exe");
    //         const args = {
    //             git_path: gitPath,
    //             repo_path: baseDir,
    //         }
    //         // console.log("Checking git update with args:", args);
    //         const hasUpdate = await invoke<boolean>('check_git_update', {
    //             args
    //         });

    
    //         console.log("Has update:", hasUpdate);
    //         if (hasUpdate) {
    //             dispatch(changeDownloadStatus('needUpdate'));
    //             // dispatch(changeDownloadStatus('downloaded'));
    //         } else if(baseDir){
    //             dispatch(changeDownloadStatus('downloaded'));
    //         }else if(!baseDir){
    //             dispatch(changeDownloadStatus('needFisrtInstall'));
    //         }
    //     } catch (error) {
    //         if(!baseDir){
    //             dispatch(changeDownloadStatus('needFisrtInstall'));
    //         }
            
    //         console.log("Ошибка проверки версии:", String(error))
    //         // dispatch(changeDownloadStatus('downloaded'));
    //         // toast.error("Ошибка проверки версии:", {
    //         //     description: String(error),
    //         // });
    //     }
    // }
    const dispatch = useDispatch();
    useEffect(() => {
        
        loadModsData();
        
        checkVersion();
    }, [baseDir, status])
    useEffect(() => {
        let interval: NodeJS.Timeout;
        
        // const runCheck = async () => {
        //     await checkVersion();
        // };

        // первый запуск сразу
        // runCheck();

        getPlayerSystemInfo().then((info: any) => {
            console.log("Системная информация:", info);
        });


        

        // повторять каждые 30 сек
        // interval = setInterval(runCheck, 30000);

        // return () => {
        //     clearInterval(interval);
        // };
    }, [baseDir]);

    

    listen<string>('minecraft-launch-progress', (event) => {
        console.log("MC:", event.payload);
    });

    
    
    
    return (
        <div>
            {status === 'needFisrtInstall' && <DownloadButton />}
            {/* {status === 'needUpdate' && <UpdateButton />} */}
            {(status === 'downloaded') && <LaunchButton/>}
        </div>
    )
}

export default GameButtons