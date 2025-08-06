'use client'
import React from 'react'
import { Button } from '../ui/button'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/configureStore'
import { useDispatch } from 'react-redux'
import { clearAuthData } from '@/store/slice/authSlice'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const Logout = () => {
    const router = useRouter()
    const authStatus = useSelector((state: RootState) => state.authSlice.authStatus)
    const dispatch = useDispatch()
    const hadleLogout = () => {
        dispatch(clearAuthData())
        router.push('/login') 
    }
  return (
    <Button className={cn('h-8 w-8',  !authStatus && "hidden")} onClick={hadleLogout} variant={'outline'}>
        <LogOut />
    </Button>
  )
}

export default Logout