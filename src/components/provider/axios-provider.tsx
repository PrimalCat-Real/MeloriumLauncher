'use client'

import { useEffect } from 'react';
import { setupAxiosInterceptors } from '@/lib/axiosConfig';

export function AxiosProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setupAxiosInterceptors();
  }, []);

  return <>{children}</>;
}
