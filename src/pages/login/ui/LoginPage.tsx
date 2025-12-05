'use client'
import LoginFormWidget from '@/widgets/auth/login-form/LoginFormWidget'
import React from 'react'

const LoginPage = () => {
  return (
    <div className="relative min-h-full">
      <div className="relative w-[300px] h-[450px] flex items-center justify-center flex-col top-1/2 left-1/2 -translate-x-1/2 translate-y-[15%]">
        <LoginFormWidget />
      </div>
    </div>
  )
}

export default LoginPage