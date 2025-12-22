'use client'

import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
// import { RootState } from '@/store/configureStore'
import { getVersion } from '@tauri-apps/api/app'
import { SERVER_ENDPOINTS } from '@/lib/config'
import * as Sentry from "@sentry/browser";
import { useSettingsStore } from '@/store/useSettingsStore'
import { useActionStore } from '@/store/useActionStore'

const Footer = () => {
  const activeEndPoint = useSettingsStore.getState().activeEndPoint
  const baseDir = useActionStore.getState().gameDirection
  const [currentVersion, setCurrentVersion] = useState<string>('')

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await getVersion()
        setCurrentVersion(version)
      } catch (error) {
        Sentry.captureException(error);
        console.error('Failed to get version:', error)
      }
    }

    fetchVersion()
  }, [])

  return (
    <div className='absolute bottom-0 left-0 w-full grid grid-cols-3 px-4 py-2 opacity-15 text-sm'>

      <span>{currentVersion && currentVersion}</span>
      <span className='text-center'>{activeEndPoint === SERVER_ENDPOINTS.main ? "main" : "proxy"}</span>
      <span className='text-right'>{baseDir && baseDir}</span>

    </div>
  )
}

export default Footer
