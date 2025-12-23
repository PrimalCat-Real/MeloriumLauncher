'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Progress } from '../ui/progress'
import { useActionStore } from '@/store/useActionStore'
import { useFileSync } from '@/hooks/useFileSync'

export const DownloadProgressPanel = () => {
    const actionStatus = useActionStore((state) => state.actioneStatus)
    const { syncProgress } = useFileSync()

    const [driveProgress, setDriveProgress] = useState(0)

    const isDownloading = actionStatus === 'installed'
    const isVerifying = actionStatus === 'verify'

    const totalProgress = useMemo(
        () => (isVerifying ? syncProgress.percent : driveProgress),
        [isVerifying, syncProgress.percent, driveProgress]
    )

    useEffect(() => {
        if (!isDownloading) return

        const interval = setInterval(() => {
            setDriveProgress(prev => Math.min(prev + 2, 95))
        }, 500)

        return () => clearInterval(interval)
    }, [isDownloading])

    return (
        <div className="space-y-4">
            <div className="text-md font-medium">
                {isDownloading ? 'Загрузка и распаковка' : 'Проверка файлов'}
            </div>

            <div className="space-y-3">
                <Progress className="h-3 w-full" value={totalProgress} max={100} />

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex gap-2 items-center">
                        <div className="truncate outline-btn-text-gradient">
                            ETA --:--
                        </div>
                        <div className="truncate outline-btn-text-gradient">
                            {Math.floor(totalProgress)}%
                        </div>
                    </div>

                    <div className="text-right outline-btn-text-gradient">
                        {Math.floor(totalProgress)}%
                    </div>

                    <div />
                </div>
            </div>
        </div>
    )
}
