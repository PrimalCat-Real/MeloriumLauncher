'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

export function WaveDots({className}: {className?: string}) {
  const dotVariants = {
    up: { y: -5 },
    down: { y: 5 },
  }

  return (
    <div className={cn("flex gap-0.5 items-end h-2", className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 progressbar-load rounded-full"
          variants={dotVariants}
          animate={{
            y: [2, -2, 2],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}