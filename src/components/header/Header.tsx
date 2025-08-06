

import React from 'react'
import ModsDrawer from '../mods/ModsDrawer'
import ModsTable from '../mods/ModsTable'
import Logo from './Logo'
import MinimizaButton from './MinimizaButton'
import CloseButton from './CloseButton'

const Header = () => {
  return (
    <header data-tauri-drag-region className='w-full h-12 flex justify-between items-center px-4 bg-header-bg border-b border-border/20 relative z-10'>
        <Logo></Logo>
        <div className='flex gap-4 items-center'>
          <MinimizaButton className='h-8 w-8'></MinimizaButton>
          <CloseButton className='h-8 w-8'></CloseButton>
            <ModsDrawer>
              <ModsTable></ModsTable>
          </ModsDrawer>
        </div>
    </header>
  )
}

export default Header