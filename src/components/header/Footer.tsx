'use client'

import React from 'react'
import ActiveEndpointSelector from '@/components/shared/ActiveEndpointSelector'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/configureStore'
const Footer = () => {
  const activeEndPoint = useSelector((state: RootState) => state.settingsState.activeEndPoint)
    
  return (
    <div className='absolute bottom-0 left-0 w-full flex justify-center opacity-20'>{activeEndPoint === "http://148.251.176.5:8000" ? "main" : "proxy"}</div>
  )
}

export default Footer