'use client'

import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Sentry from "@sentry/browser"
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { SERVER_ENDPOINTS } from '@/lib/config'
import { getLocalVersion, getServerVersion } from '@/lib/utils'
import { invoke } from '@tauri-apps/api/core'
import { exists } from '@tauri-apps/plugin-fs'

import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useActionStore } from '@/store/useActionStore'
import { useModsStore } from '@/store/useModsStore'


interface ModsConfigResponse {
    version: string
    mods: any[]
    presets: any[]
    ignoredPaths?: string[]
}

interface GameConfigContextType {
    isLoading: boolean
    checkUpdates: () => Promise<void>
    updateLocalVersionFile: (newVersion: string) => Promise<void>
}

const GameConfigContext = createContext<GameConfigContextType | null>(null)

export const useGameConfig = () => {
    const context = useContext(GameConfigContext)
    if (!context) throw new Error('useGameConfig must be used within GameConfigProvider')
    return context
}

const GameConfigProvider = ({ children }: { children: React.ReactNode }) => {
    const activeEndPoint = useSettingsStore((state) => state.activeEndPoint)
    const authToken = useAuthStore((state) => state.authToken)

    // const gameDir = useSettingsStore((state) => state.)
    const gameDir = useActionStore((state) => state.gameDirection)
    const status = useActionStore((state) => state.actioneStatus)
    const localVersion = useActionStore((state) => state.localGameVersion)
    const serverVersion = useActionStore((state) => state.serverGameVersion)
    const setIgnoredPaths = useActionStore((state) => state.setIgnoredPaths)
    const setStatus = useActionStore((state) => state.setActionStatus)
    const setModsData = useModsStore((state) => state.setModsData)
    const resetMods = useModsStore((state) => state.resetMods)
    const setVersions = useActionStore((state) => state.setVersions)


    const configUrl = useMemo(() => {
        let base = String(activeEndPoint ?? SERVER_ENDPOINTS.main)
        if (!/^https?:\/\//i.test(base)) base = `http://${base}`
        return `${base}/launcher/config`
    }, [activeEndPoint])

    const versionUrl = useMemo(() => {
        let base = String(activeEndPoint ?? SERVER_ENDPOINTS.main)
        if (!/^https?:\/\//i.test(base)) base = `http://${base}`
        return `${base}/launcher/version`
    }, [activeEndPoint])

    const { data: modsConfig, isError, error } = useQuery({
        queryKey: ['mods-config', configUrl],
        queryFn: async () => {
            const { data } = await apiClient.get<ModsConfigResponse>(configUrl)
            return data
        },
        enabled: !!activeEndPoint && !!authToken,
        retry: 1,
        refetchOnWindowFocus: false
    })

    useEffect(() => {
        if (modsConfig) {
            console.log(`[Config] Loaded: v${modsConfig.version}`)
            setModsData(modsConfig.mods, modsConfig.presets)
            if (modsConfig.ignoredPaths?.length) {
                setIgnoredPaths(modsConfig.ignoredPaths)
            }
        }
    }, [modsConfig, setModsData, setIgnoredPaths])

    useEffect(() => {
        if (isError && error) {
            console.error('[Config] Error:', error)
            Sentry.captureException(error)
        }
    }, [isError, error])

    const checkVersions = useCallback(async () => {
        if (!gameDir || !gameDir.trim()) {
            resetMods()
            setStatus('not-installed')
            return
        }

        try {
            const dirExists = await exists(gameDir).catch(() => false)
            if (!dirExists) {
                resetMods()
                setStatus('not-installed')
                return
            }

            const [local, server] = await Promise.all([
                getLocalVersion(gameDir),
                getServerVersion(versionUrl, authToken)
            ])

            const serverVersion = server?.version || null
            setVersions(local, serverVersion)

            console.log(`[VerCheck] Local: ${local}, Server: ${serverVersion}`)

            if (local && serverVersion && local !== serverVersion) {
                setStatus('need-update')
            } else if (local && serverVersion) {
                setStatus('installed')
            }
        } catch (e) {
            console.error('[VerCheck] Failed:', e)
            Sentry.captureException(e)
        }
    }, [gameDir, versionUrl, authToken, resetMods, setStatus, setVersions])

    useEffect(() => {
        if (activeEndPoint && authToken) {
            checkVersions()
            const interval = setInterval(checkVersions, 60000)
            return () => clearInterval(interval)
        }
    }, [activeEndPoint, authToken, checkVersions])

    const updateLocalVersionFile = useCallback(async (newVersion: string) => {
        if (!gameDir) return
        try {
            const configPath = `${gameDir}/melorium.json`
            const content = await invoke<string>('get_local_version_json', { path: configPath })

            let json = {}
            try { json = JSON.parse(content) } catch { }

            // @ts-ignore
            json.version = newVersion

            const encoder = new TextEncoder()
            await invoke('write_file_bytes', {
                path: configPath,
                data: Array.from(encoder.encode(JSON.stringify(json, null, 2)))
            })

            console.log(`[Config] Updated local to v${newVersion}`)
            await checkVersions()
        } catch (e) {
            console.error('[Config] File update failed', e)
            toast.error("Failed to update version file")
            throw e
        }
    }, [gameDir, checkVersions])

    useEffect(() => {
        if (status === 'installed' && localVersion && serverVersion && localVersion !== serverVersion) {
            toast.info("Update available!", { description: `v${serverVersion} is out.` })
        }
    }, [status, localVersion, serverVersion])

    return (
        <GameConfigContext.Provider value={{
            isLoading: !modsConfig,
            checkUpdates: checkVersions,
            updateLocalVersionFile
        }}>
            {children}
        </GameConfigContext.Provider>
    )
}

export default GameConfigProvider
