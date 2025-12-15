'use client'
import React, { ReactNode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupAxiosInterceptors } from '@/lib/axiosConfig';

const QueryProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient();
  useEffect(() => {
    // setupAxiosInterceptors();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

export default QueryProvider