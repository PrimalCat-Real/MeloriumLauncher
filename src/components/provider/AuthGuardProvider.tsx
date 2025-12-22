'use client'

import { useAuthStore } from '@/store/useAuthStore';
import { usePathname, useRouter } from 'next/navigation';
import React, { ReactNode, useEffect, useState } from 'react'


const AuthGuardProvider = ({ children }: { children: ReactNode }) => {
    const router = useRouter()
    const pathname = usePathname()
    const { authToken, username, password, authStatus } = useAuthStore()

    // useEffect(() => {
    //     const isProtectedRoute = pathname !== '/login'
    //     const isLoginPage = pathname === '/login'

    //     if (isProtectedRoute && (!authToken || !username || !password || authStatus === 'need-authentication')) {
    //         router.replace('/login')
    //         return
    //     }

    //     if (isLoginPage && authToken && username && password && authStatus === 'authenticated') {
    //         router.replace('/')
    //     }
    // }, [authToken, username, password, authStatus])

    return <>{children}</>
}

export default AuthGuardProvider;
