'use client'
import React from 'react'
import { Button } from '../ui/button'
import { X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from '@/lib/utils';

const CloseButton = ({ className }: { className?: string }) => {
  const close = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };
  return (
    <Button className={cn(className, '')} onClick={close} size={'icon'} variant={'outline'}>
      <X />
    </Button>
  )
}

export default CloseButton