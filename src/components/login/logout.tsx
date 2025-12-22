'use client'
import React, { useMemo } from 'react'
import { Button } from '../ui/button'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'

const Logout = () => {
  const router = useRouter()
  const pathname = usePathname()
  const clearAuthData = useAuthStore((state) => state.clearAuthCredits)
  const authStatus = useAuthStore((state) => state.authStatus)
  const hadleLogout = () => {
    clearAuthData()
    router.push('/login')
  }
  const isLoginPage = useMemo(() => {
    return pathname === "/login"
  }, [pathname])
  return (
    <Button className={cn('h-8 w-8', (!authStatus || isLoginPage) && "hidden")} onClick={hadleLogout} variant={'outline'}>
      <LogOut />
    </Button>
  )
}

export default Logout