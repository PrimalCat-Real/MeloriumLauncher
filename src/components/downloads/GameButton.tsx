'use client'
import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import DownloadButton from './DownloadButton'
import UpdateButton from './UpdateButton'
import { resetMods, setModsData } from '@/store/slice/modsSlice'
import LaunchButton from './LaunchButtonOld'
import { listen } from '@tauri-apps/api/event'
import { SERVER_ENDPOINTS } from '@/lib/config'
import { toast } from 'sonner'
import { getLocalVersion, getPlayerSystemInfo, getServerVersion } from '@/lib/utils'
import { exists } from '@tauri-apps/plugin-fs'
import axios from 'axios'
import * as Sentry from "@sentry/browser";
import { apiClient } from '@/lib/api-client'

interface ModsConfigResponse {
    version: string
    mods: any[]
    presets: any[]
    ignoredPaths?: string[]
}

const GameButtons = () => {
    const status = useSelector((state: RootState) => state.downloadSlice.status)
    const baseDir = useSelector((state: RootState) => state.downloadSlice.gameDir)
    const authToken = useSelector((state: RootState) => state.authSlice.authToken)
    const localVersion = useSelector((state: RootState) => state.downloadSlice.localVersion)
    const serverVersion = useSelector((state: RootState) => state.downloadSlice.serverVersion)
    const activeEndPoint = useSelector((s: RootState) => s.settingsState.activeEndPoint)

    const dispatch = useDispatch()

    const configUrl = useMemo(() => {
        let base = String(activeEndPoint ?? SERVER_ENDPOINTS.main)
        if (!/^https?:\/\//i.test(base)) base = `http://${base}`
        base = base.replace(/\/+$/, '')
        return `${base}/launcher/config`
    }, [activeEndPoint])

    const versionUrl = useMemo(() => {
        let base = String(activeEndPoint ?? SERVER_ENDPOINTS.main)
        if (!/^https?:\/\//i.test(base)) base = `http://${base}`
        base = base.replace(/\/+$/, '')
        return `${base}/launcher/version`
    }, [activeEndPoint])

    const loadModsData = async () => {
        try {
            const { data } = await apiClient.get<ModsConfigResponse>(configUrl)

            console.log('[modsData] Loaded config:', {
                version: data.version,
                mods: data.mods.length,
                presets: data.presets.length,
                ignoredPaths: data.ignoredPaths?.length || 0
            })

            dispatch(setModsData({
                mods: data.mods,
                presets: data.presets
            }))

            if (data.ignoredPaths && data.ignoredPaths.length > 0) {
                console.log('[modsData] Setting ignored paths:', data.ignoredPaths)
                dispatch(setIgnoredPaths(data.ignoredPaths))
            }
        } catch (error) {
            Sentry.captureException(error);
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    console.error('[modsData] Unauthorized')
                    toast.error('Ошибка авторизации при загрузке конфигурации')
                    throw error
                }
                console.error('[modsData] Error:', error.response?.data || error.message)
                toast.error('Не удалось загрузить конфигурацию модов')
            } else {
                console.error('[modsData] Unexpected error:', error)
            }
        }
    }

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
            Sentry.captureException(error);
            console.error('[versions] Error fetching versions:', error)
            return { local: null, server: null }
        }
    }

    const checkBaseDirectoryPresence = async (): Promise<boolean> => {
        if (!baseDir || typeof baseDir !== 'string' || baseDir.trim() === '') {
            dispatch(resetMods())
            dispatch(changeDownloadStatus('needFisrtInstall'))
            return false
        }
        try {
            return await exists(baseDir)
        } catch (error) {
            Sentry.captureException(error);
            toast.error('Ошибка проверки директории')
            console.error('[checkDir] Error:', error)
            return false
        }
    }

    const checkVersion = async () => {
        const baseDirExists = await checkBaseDirectoryPresence()

        if (!baseDirExists) {
            dispatch(resetMods())
            dispatch(changeDownloadStatus('needFisrtInstall'))
            return
        }

        const versions = await fetchVersions()

        // Проверяем, нужно ли обновление
        if (versions.local && versions.server && versions.local !== versions.server) {
            console.log('[checkVersion] Update needed:', {
                local: versions.local,
                server: versions.server
            })
            dispatch(changeDownloadStatus('needUpdate'))
        } else {
            dispatch(changeDownloadStatus('downloaded'))
        }
    }

    const needsUpdate = useMemo(() => {
        if (status === 'needFisrtInstall') return false;
        return status === 'needUpdate' ||
            (localVersion && serverVersion && localVersion !== serverVersion)
    }, [status, localVersion, serverVersion])

    useEffect(() => {
        const initialize = async () => {
            await loadModsData()
            await checkVersion()
        }

        initialize()
        // return status if not work
    }, [baseDir])


    useEffect(() => {
        if (!baseDir) return

        getPlayerSystemInfo().then((info: any) => {
            console.log('[systemInfo]', info)
        })

        const unsubscribeMC = listen<string>('minecraft-launch-progress', (event) => {
            console.log('[MC]', event.payload)
        })

        // Интервал проверки версии каждые 30 секунд
        const versionCheckInterval = setInterval(async () => {
            console.log('[versionCheck] Running periodic check...')
            const baseDirExists = await checkBaseDirectoryPresence()

            if (baseDirExists) {
                const versions = await fetchVersions()

                // Проверяем, нужно ли обновление
                if (versions.local && versions.server && versions.local !== versions.server) {
                    console.log('[versionCheck] Update available:', {
                        local: versions.local,
                        server: versions.server
                    })
                    dispatch(changeDownloadStatus('needUpdate'))

                    // Показываем уведомление только один раз
                    if (status !== 'needUpdate') {
                        toast.info('Доступно обновление', {
                            description: `Версия ${versions.server}`
                        })
                    }
                }
            }
        }, 60000)

        return () => {
            unsubscribeMC.then(fn => fn())
            clearInterval(versionCheckInterval)
        }
    }, [baseDir, status])

    return (
        <div className="flex flex-col gap-2">
            {/* {status === 'needFisrtInstall' && <DownloadButton />}
            {needsUpdate ? (
                <UpdateButton />
            ) : (
                status === 'downloaded' && <LaunchButton />
            )} */}
        </div>
    )
}

export default GameButtons
