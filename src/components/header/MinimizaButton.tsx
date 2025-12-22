'use client'
import React from 'react'
import { Button } from '../ui/button'
import { Minus } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from '@/lib/utils';

const MinimizaButton = ({ className }: { className?: string }) => {
  // if (typeof window !== 'undefined') return
  const minimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };
  return (
    <Button className={cn(className, '')} onClick={minimize} size={'icon'} variant={'outline'}>
      <Minus />
    </Button>
  )
}

export default MinimizaButton