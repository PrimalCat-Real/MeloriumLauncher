'use client'
import React, { ReactNode, Suspense, useEffect, useState, useTransition } from 'react'
import { Button } from '../ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import bg from '@/assets/images/background.png'
import { ArrowLeftToLine, Settings } from 'lucide-react'
import RamSelector from './RamSelector'
import MinimizaButton from '../header/MinimizaButton'
import CloseButton from '../header/CloseButton'
import Logout from '../login/logout'
import { cn } from '@/lib/utils'
import { RootState } from '@/store/configureStore'
import { useSelector } from 'react-redux'
import { WaveDots } from '../downloads/WaveDots'

const LazyModsTable = React.lazy(() => import('./ModsTable'))

const ModsDrawer: React.FC = () => {
  const [open, setOpen] = useState(false)
  // showContent controls whether heavy children (table) are mounted.
  const [showContent, setShowContent] = useState(false)
  // useTransition to avoid blocking the UI thread when we mount heavy content.
  const [isPending, startTransition] = useTransition()

  const authStatus = useSelector((state: RootState) => state.authSlice.authStatus)

  // When drawer closes, immediately unmount heavy content to free memory.
  useEffect(() => {
    if (!open) {
      setShowContent(false)
    }
  }, [open])

  return (
    <div className={cn(!authStatus && 'hidden')}>
      <Button className="h-8 w-8" variant={'outline'} onClick={() => setOpen(true)}>
        <Settings />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-background z-30 flex flex-col px-8 pb-4 gap-4"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 220, damping: 28 }}
            // onAnimationComplete is called when the entering animation finishes.
            // We mount heavy content only after the animation finished to avoid jank.
            onAnimationComplete={() => {
              // guard: only mount when we're opening (not when exit finished)
              if (!showContent) {
                startTransition(() => {
                  setShowContent(true)
                })
              }
            }}
          >
            <div data-tauri-drag-region className="w-full flex z-10 justify-between items-center py-4">
              <Button
                variant={'outline'}
                className="rounded-full border-border/60 border hover:border-border transition-colors duration-200 cursor-pointer flex justify-center items-center w-8 h-8"
                onClick={() => setOpen(false)}
              >
                <ArrowLeftToLine />
              </Button>

              <div className="flex gap-2 items-center">
                <MinimizaButton className="h-8 w-8" />
                <CloseButton className="h-8 w-8" />
                <Logout />
              </div>
            </div>

            <RamSelector />

            <div className="separator w-full h-[2px] bg-card opacity-15 rounded-full" />

            {/* mount the table only after animation completes */}
            <div className="w-full z-10">
              {showContent ? (
                <Suspense fallback={<div className="py-8 text-center flex items-center gap-2">Loading mods <WaveDots></WaveDots> </div>}>
                  <LazyModsTable />
                </Suspense>
              ) : (
                // lightweight placeholder that doesn't cause layout thrash
                <div aria-hidden className="h-6" />
              )}
            </div>

            <Image className="fixed top-0 left-0 w-full h-full z-0" src={bg} alt="bg" width={988} height={629} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ModsDrawer