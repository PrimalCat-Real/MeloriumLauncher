'use client'

import axios from 'axios'
import React, { JSX, Suspense, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Skeleton } from '../ui/skeleton'
import { UsersRound } from 'lucide-react'
import { AnimatedShinyText } from '../magicui/animated-shiny-text'
import * as Sentry from "@sentry/browser";
import { apiClient } from '@/lib/api-client'

type StatusPayload = {
  status: 'online' | 'offline'
  players: { online: number; max: number }
}

type RootState = { settingsState: { activeEndPoint: string } }

const OFFLINE_FALLBACK: StatusPayload = {
  status: 'offline',
  players: { online: 0, max: 0 },
}

const buildUrl = (endpoint: string): string => {
  // корректно склеивает без двойных слешей
  return new URL('/get-server-status', endpoint).toString()
}

const fetchStatus = async (endpoint: string): Promise<StatusPayload> => {
  try {
    const url = buildUrl(endpoint)
    const { data } = await apiClient.get<StatusPayload>(url, { timeout: 0 })

    if (!data || typeof data.status !== 'string' || !data.players) {
      return OFFLINE_FALLBACK
    }
    return data
  } catch (error) {
    Sentry.captureException(error);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw error; // Interceptor обработает
    }

    return OFFLINE_FALLBACK
  }
}


const suspenseify = <T,>(promise: Promise<T>) => {
  let status: 'pending' | 'success' = 'pending'
  let response: T

  const suspender = promise.then((res) => {
    status = 'success'
    response = res
  })

  const read = (): T => {
    if (status === 'pending') throw suspender
    return response!
  }

  return { read }
}

const PlayersCount = ({ resource }: { resource: { read: () => StatusPayload } }): JSX.Element => {
  const data = resource.read()
  const online = data.status === 'online' ? Number(data.players.online ?? 0) : 0
  return (
    <div className='flex gap-1 items-center px-4 py-1 border-[#E17EFF]/50 border w-min rounded-full text-sm secondary-bg-gradient text-nowrap'>
      <AnimatedShinyText className="inline-flex items-center justify-center px-2 py-0.5 transition ease-out text-sm hover:duration-300">
        <span>{data.status === 'online' ? 'Онлайн' : 'Офлайн'} {online}</span>
        <UsersRound className="ml-1 size-4 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
      </AnimatedShinyText>
    </div>
  )
}

const OnlinePlayersDisplay = (): JSX.Element => {
  const endpoint = useSelector((state: RootState) => state.settingsState?.activeEndPoint)

  const resource = useMemo(() => {
    if (!endpoint) return null
    return suspenseify(fetchStatus(endpoint))
  }, [endpoint])

  if (!endpoint || !resource) {
    return <Skeleton className="h-8 min-w-32 rounded-full bg-border" />
  }

  return (
    <Suspense fallback={<Skeleton className="h-8.5 min-w-32 rounded-full bg-secondary/50" />}>
      <PlayersCount resource={resource} />
    </Suspense>
  )
}

export default OnlinePlayersDisplay
