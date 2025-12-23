'use client'

import React, { memo, useState } from 'react'
import { Button } from '../ui/button'
import { Download } from 'lucide-react'
import { DownloadDialog } from './DownloadDialog'


const DownloadButton = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    return (
        <>
            <Button
                size="main"
                onClick={() => setIsDialogOpen(true)}
                className="w-48"
            >
                <Download className="mr-2 h-2 w-2 " />
                Скачать
            </Button>

            <DownloadDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
            />
        </>
    )
}

export default memo(DownloadButton)
