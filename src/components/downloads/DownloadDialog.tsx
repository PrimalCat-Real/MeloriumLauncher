'use client'

import React from 'react'
import { Dialog, DialogContent } from '../ui/dialog'

import { useActionStore } from '@/store/useActionStore'
import { DownloadSetupPanel } from './DownloadSetupPanel'
import { DownloadProgressPanel } from './DownloadProgressPanel'

interface DownloadDialogProps {
    isOpen: boolean
    onClose: () => void
}

export const DownloadDialog = ({ isOpen, onClose }: DownloadDialogProps) => {
    const gameDirection = useActionStore((state) => state.gameDirection)
    const actionStatus = useActionStore((state) => state.actioneStatus)

    const isInstalling = actionStatus === 'verify' || actionStatus === 'installed'
    const canClose = !isInstalling

    const handleOpenChange = (open: boolean) => {
        if (!open && canClose) {
            onClose()
        }
    }

    const showSetup = !gameDirection || actionStatus === 'not-installed'

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[450px] rounded-2xl">
                {showSetup ? (
                    <DownloadSetupPanel />
                ) : (
                    <DownloadProgressPanel />
                )}
            </DialogContent>
        </Dialog>
    )
}
