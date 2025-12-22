'use client'

import React, { JSX } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '../ui/skeleton'
import { UsersRound } from 'lucide-react'
import { AnimatedShinyText } from '../magicui/animated-shiny-text'
import * as Sentry from "@sentry/browser"
import { apiClient } from '@/lib/api-client'
import { useSettingsStore } from '@/store/useSettingsStore'

type StatusPayload = {
  status: 'online' | 'offline'
  players: { online: number; max: number }
}

const OFFLINE_FALLBACK: StatusPayload = {
  status: 'offline',
  players: { online: 0, max: 0 },
}

const fetchServerStatus = async (): Promise<StatusPayload> => {
  try {
    const { data } = await apiClient.get<StatusPayload>('/get-server-status')

    if (data && typeof data.status === 'string' && data.players) {
      return data
    }
    return OFFLINE_FALLBACK
  } catch (e) {
    Sentry.captureException(e)
    return OFFLINE_FALLBACK
  }
}

const PlayersCount = ({ data }: { data: StatusPayload }): JSX.Element => {
  const isOnline = data.status === 'online'
  const online = isOnline ? Number(data.players.online ?? 0) : 0
  const statusText = isOnline ? 'Онлайн' : 'Офлайн'

  return (
    <div className='flex gap-1 items-center px-4 py-1 border-[#E17EFF]/50 border w-min rounded-full text-sm secondary-bg-gradient text-nowrap'>
      <AnimatedShinyText className="inline-flex items-center justify-center px-2 py-0.5 transition ease-out text-sm hover:duration-300">
        <span>{statusText} {online}</span>
        <UsersRound className="ml-1 size-4 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
      </AnimatedShinyText>
    </div>
  )
}

const OnlinePlayersDisplay = (): JSX.Element => {
  const activeEndPoint = useSettingsStore((state) => state.activeEndPoint)

  const { data, isLoading } = useQuery({
    queryKey: ['server-status', activeEndPoint],
    queryFn: fetchServerStatus,
    refetchInterval: 300000,
    enabled: !!activeEndPoint,
  })

  if (isLoading || !activeEndPoint) {
    return <Skeleton className="h-8 min-w-32 rounded-full bg-secondary/50" />
  }

  return <PlayersCount data={data ?? OFFLINE_FALLBACK} />
}

export default OnlinePlayersDisplay
