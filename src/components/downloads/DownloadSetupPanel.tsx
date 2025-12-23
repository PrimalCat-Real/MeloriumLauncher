'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { FolderSearch } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { resourceDir } from '@tauri-apps/api/path'
import { useActionStore } from '@/store/useActionStore'
import { LOGGER } from '@/lib/loger'

const DownloadSetupPanel = () => {
    const [selectedPath, setSelectedPath] = useState('')
    const [isVerifyingPath, setIsVerifyingPath] = useState(false)

    const gameDirection = useActionStore((state) => state.gameDirection)
    const setGameDirectionAction = useActionStore((state) => state.setGameDirection)
    const setActionStatus = useActionStore((state) => state.setActionStatus)

    const effectivePath = useMemo(() => {
        if (selectedPath) return selectedPath
        if (gameDirection) return gameDirection
        return ''
    }, [selectedPath, gameDirection])

    const isPathValid = useMemo(() => {
        if (!effectivePath) return false
        const normalizedPath = effectivePath.toLowerCase().replace(/\\/g, '/')
        const isLauncherPath =
            normalizedPath.includes('melorium') && normalizedPath.includes('launcher')
        return !isLauncherPath
    }, [effectivePath])

    const handleSelectPath = useCallback(async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Установка',
            })

            if (typeof selected !== 'string') return

            LOGGER.log('raw path selected', selected)

            const appPath = await resourceDir()
            const normalizedSelectedPath = selected.replace(/\\/g, '/').toLowerCase()
            const normalizedAppPath = appPath.replace(/\\/g, '/').toLowerCase()

            if (normalizedSelectedPath.includes(normalizedAppPath)) {
                LOGGER.error('Selected path is inside launcher directory', {
                    selected,
                    appPath,
                })
                return
            }

            let pathToUse = selected
            const isEmpty = await invoke<boolean>('is_dir_empty', {
                path: selected,
            }).catch(() => false)

            if (!isEmpty) {
                const meloriumPath = selected.endsWith('melorium')
                    ? selected
                    : `${selected}/melorium`

                const isMeloriumEmpty = await invoke<boolean>('is_dir_empty', {
                    path: meloriumPath,
                }).catch(() => null)

                if (isMeloriumEmpty === false) {
                    LOGGER.error('Melorium folder already exists and is not empty', {
                        meloriumPath,
                    })
                    return
                }

                pathToUse = meloriumPath
            }

            LOGGER.log('path selected normalized', pathToUse)
            setSelectedPath(pathToUse)
        } catch (error) {
            LOGGER.error('Path selection failed', error)
        }
    }, [])

    const verifyAndSetupPath = useCallback(async () => {
        if (!effectivePath) {
            LOGGER.error('Verify path called without effectivePath')
            return
        }

        if (!isPathValid) {
            LOGGER.error('Verify path called with invalid path', { effectivePath })
            return
        }

        setIsVerifyingPath(true)

        try {
            LOGGER.log('verify path start', { effectivePath })

            const appPath = await resourceDir()
            const normalizedSelectedPath = effectivePath.replace(/\\/g, '/').toLowerCase()
            const normalizedAppPath = appPath.replace(/\\/g, '/').toLowerCase()

            if (normalizedSelectedPath.includes(normalizedAppPath)) {
                LOGGER.error('Final path is inside launcher directory', {
                    effectivePath,
                    appPath,
                })
                return
            }

            const meloriumPath = effectivePath

            const isMeloriumEmpty = await invoke<boolean>('is_dir_empty', {
                path: meloriumPath,
            }).catch(() => null)

            if (isMeloriumEmpty === false) {
                LOGGER.error('Final melorium folder is not empty', { meloriumPath })
                return
            }

            LOGGER.log('path verified', { meloriumPath })
            setGameDirectionAction(meloriumPath)
            setActionStatus('installed')
        } catch (error) {
            LOGGER.error('Path verification failed', error)
        } finally {
            setIsVerifyingPath(false)
        }
    }, [effectivePath, isPathValid, setGameDirectionAction, setActionStatus])

    return (
        <div className="space-y-4">
            <div className="text-md font-medium">Установка</div>

            <Button
                variant="outline"
                className="w-full text-start justify-between px-4 flex rounded-2xl input-shadow"
                onClick={handleSelectPath}
                disabled={isVerifyingPath}
            >
                <span className="cn text-ellipsis whitespace-nowrap min-w-0 direction-rtl text-left overflow-hidden">
                    {effectivePath
                        ? effectivePath.replace(/\\/g, '/')
                        : 'Выберите директорию установки'}
                </span>
                <span className="direction-ltr flex items-center">
                    <FolderSearch className="h-4 w-4" />
                </span>
            </Button>

            <div className="flex">
                <Button
                    className="w-full h-10 rounded-2xl main-btn-bg main-btn-shadow text-base font-semibold"
                    onClick={verifyAndSetupPath}
                    disabled={isVerifyingPath || !effectivePath}
                >
                    {isVerifyingPath ? 'Проверка...' : 'Скачать'}
                </Button>
            </div>
        </div>
    )
}

export { DownloadSetupPanel }
