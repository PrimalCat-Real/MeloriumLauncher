'use client'

import { usePathname, useRouter } from 'next/navigation';
import React, { ReactNode, useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { RootState } from '@/store/configureStore';

const AuthGuardProvider = ({ children }: { children: ReactNode }) => {
    const token = useSelector((state: RootState) => state.authSlice.authToken);

    const [isMounted, setIsMounted] = useState(false);

    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const isLoginPage = pathname === '/login';
        const hasToken = !!token && token !== "";

        if (!hasToken && !isLoginPage) {
            router.replace('/login');
        }

        if (hasToken && isLoginPage) {
            router.replace('/');
        }
    }, [isMounted, token, pathname, router]);

    if (!isMounted) {
        return null;
    }

    return (
        <>{children}</>
    );
}

export default AuthGuardProvider;
