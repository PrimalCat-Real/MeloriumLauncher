'use client'
import React from 'react'
import { Button } from '../ui/button'
import { X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from '@/lib/utils';

const CloseButton = ({className }: {className?: string}) => {
  const appWindow = getCurrentWindow();
  return (
    <Button className={cn(className, '')} onClick={async () => {await appWindow.close()}} size={'icon'} variant={'outline'}>
        <X />
    </Button>
  )
}

export default CloseButton