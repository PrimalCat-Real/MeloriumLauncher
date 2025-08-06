'use client'
import { RootState } from '@/store/configureStore'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'

const LoginRedirect = () => {

    const authStatus = useSelector((state: RootState) => state.authSlice.authStatus)
  const router = useRouter()
  useEffect(() => {
      console.log("Auth status:", authStatus)
      if(!authStatus){
          router.push('/login')
          return;
      }
  }, [])
  return (
    <div className='hidden'></div>
  )
}

export default LoginRedirect