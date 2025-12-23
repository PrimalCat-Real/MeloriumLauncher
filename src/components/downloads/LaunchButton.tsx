'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { LoaderCircle } from 'lucide-react'

import { getPublicIp, whitelistIp } from '@/lib/utils'
import { useLocalFileHashes } from '@/hooks/useLocalFileHashes'
import { useManifest } from '@/hooks/useManifest'
import { useFileSync } from '@/hooks/useFileSync'
import { useMinecraftLaunch, MinecraftLaunchParams } from '@/hooks/useMinecraftLaunch'

import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useActionStore } from '@/store/useActionStore'
import { LOGGER } from '@/lib/loger'

interface LaunchStatus {
    status: 'idle' | 'verify' | 'syncing' | 'launching'
    message?: string
}

const LaunchButton = () => {
    const activeEndPoint = useSettingsStore((state) => state.activeEndPoint)
    const selectedJavaMemory = useSettingsStore((state) => state.selectedJavaMemory)

    const userLogin = useAuthStore((state) => state.username)
    const userPassword = useAuthStore((state) => state.password)
    const authToken = useAuthStore((state) => state.authToken)

    const gameDir = useActionStore((state) => state.gameDirection)
    const localGameVersion = useActionStore((state) => state.localGameVersion)
    const serverGameVersion = useActionStore((state) => state.serverGameVersion)
    const ignoredPaths = useActionStore((state) => state.ignoredPaths)
    const setActionStatus = useActionStore((state) => state.setActionStatus)

    const [launchStatus, setLaunchStatus] = useState<LaunchStatus>({ status: 'idle' })

    const { scanDirectory, isScanning } = useLocalFileHashes()
    const { fetchManifest } = useManifest()
    const { compareFiles, syncFiles, isSyncingFiles, syncProgress } = useFileSync()

    const userUuid = useMemo(() => crypto.randomUUID(), [])

    const gameDirection = gameDir ?? "";
    const javaMemory = selectedJavaMemory ?? 4096;


    const gameParams: MinecraftLaunchParams = useMemo(() => ({
        baseDir: gameDirection,
        username: userLogin || 'Player',
        uuid: userUuid,
        token: userPassword || '',
        memoryMb: javaMemory
    }), [gameDirection, userLogin, userUuid, userPassword, javaMemory])



    const executeAsyncTask = useCallback((promise: Promise<any>) => {
        promise.catch(error => LOGGER.log('Background task failed:', error))
    }, [])

    const handleLaunch = useCallback(async () => {
        console.log("launch started", {
            activeEndPoint,
            gameDirection,
            authToken: !!authToken,
            localGameVersion,
            serverGameVersion
        });
        if (!activeEndPoint) {
            LOGGER.error("Endpoint configuration error")
            return
        }

        try {
            setActionStatus("verify")
            setLaunchStatus({ status: 'verify' })

            const localFileHashes = await scanDirectory(gameDirection)

            const serverManifest = await fetchManifest(activeEndPoint, authToken)

            const synchronizationResult = compareFiles(
                localFileHashes,
                serverManifest,
                ignoredPaths,
                localGameVersion ?? undefined,
                serverGameVersion ?? undefined
            )

            const hasChanges =
                synchronizationResult.toDownload.length > 0 ||
                synchronizationResult.toUpdate.length > 0 ||
                synchronizationResult.toDelete.length > 0

            if (hasChanges) {
                setLaunchStatus({ status: 'syncing' })
                // await syncFiles(synchronizationResult, activeEndPoint, gameDirection, authToken)
            }

            setLaunchStatus({ status: 'launching' })

            // if (userLogin && authToken) {
            //     executeAsyncTask((async () => {
            //         const publicIpAddress = await getPublicIp()
            //         await whitelistIp(activeEndPoint, {
            //             login: userLogin,
            //             accessToken: authToken,
            //             address: publicIpAddress
            //         })
            //     })())
            // }

            setActionStatus("idll")

            // await useMinecraftLaunch(gameParams)

        } catch (error) {
            LOGGER.error('[Launch] Error:', error)
            setLaunchStatus({ status: 'idle' })
        } finally {
            setLaunchStatus({ status: 'idle' })
        }
    }, [
        activeEndPoint, authToken, gameDirection,
        ignoredPaths, localGameVersion, serverGameVersion,
        userLogin, userPassword,
    ])

    const isButtonDisabled = launchStatus.status !== 'idle' || isScanning || isSyncingFiles

    const buttonContent = useMemo(() => {
        switch (launchStatus.status) {
            case 'launching':
                return (
                    <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>Запуск</span>
                    </>
                )
            case 'syncing':
                return (
                    <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{syncProgress.percent}%</span>
                    </>
                )
            case 'verify':
                return (
                    <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>Проверка</span>
                    </>
                )
            default:
                return <span>Играть</span>
        }
    }, [launchStatus.status, syncProgress.percent])

    return (
        <Button
            disabled={isButtonDisabled}
            onClick={handleLaunch}
            className="w-48"
        >
            {buttonContent}
        </Button>
    )
}

export default LaunchButton
