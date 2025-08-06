'use client'
import React, { ReactNode, useState } from 'react'
import { Button } from '../ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import bg from '@/assets/images/background.png'
import { ArrowLeftToLine } from 'lucide-react'
import RamSelector from './RamSelector'
import MinimizaButton from '../header/MinimizaButton'
import CloseButton from '../header/CloseButton'

const ModsDrawer = ({children}: {children: ReactNode}) => {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <Button className='h-8' variant={"outline"} onClick={() => setOpen(true)}>Mods</Button>
      <AnimatePresence>
        {open && (

            <motion.div
              className="fixed inset-0 bg-background z-30 flex flex-col px-8 py-4 gap-4"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
            >
                
                <div  data-tauri-drag-region className='w-full flex z-10 justify-between items-center'>
                  <Button variant={"outline"} className='rounded-full border-border/60 border hover:border-border transition-colors duration-200 cursor-pointer flex justify-center items-center w-8 h-8'  onClick={() => setOpen(false)}>
                      <ArrowLeftToLine></ArrowLeftToLine>
                  </Button>
                  <div className='flex gap-2 items-center'>
                    <MinimizaButton className='h-8 w-8'></MinimizaButton>
                    <CloseButton className='h-8 w-8'></CloseButton>
                  </div>
                  
                </div>
                <RamSelector></RamSelector>
                <div className='separator w-full h-[2px] bg-card opacity-15 rounded-full'></div>
                {children}
                <Image className="fixed top-0 left-0 w-full h-full z-0" src={bg} alt="bg" width={988} height={629}  />
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ModsDrawer
