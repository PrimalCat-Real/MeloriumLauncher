'use client'

import axios from 'axios'
import React, { JSX, Suspense, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Skeleton } from '../ui/skeleton'
import { UsersRound } from 'lucide-react'
import { AnimatedShinyText } from '../magicui/animated-shiny-text'


type StatusPayload = {
  status: 'online' | 'offline'
  players: { online: number; max: number }
}

type RootState = { settingsState: { activeEndPoint: string } }

const fetchStatus = async (endpoint: string): Promise<StatusPayload> => {
  const url = `${endpoint}/get-server-status`
  const { data } = await axios.get<StatusPayload>(url, { timeout: 5000 })
  return data
}

const suspenseify = <T,>(promise: Promise<T>) => {
  let status: 'pending' | 'success' | 'error' = 'pending'
  let response: T
  let error: unknown

  const suspender = promise
    .then((res) => {
      status = 'success'
      response = res
    })
    .catch((err) => {
      status = 'error'
      error = err
    })

  const read = (): T => {
    if (status === 'pending') throw suspender
    if (status === 'error') throw error
    return response!
  }

  return { read }
}


const PlayersCount = ({ resource }: { resource: { read: () => StatusPayload } }): JSX.Element => {
  const data = resource.read()
  const online = data.status === 'online' ? Number(data.players.online ?? 0) : 0
  return <div className='flex gap-1 items-center px-4 py-1 border-[#E17EFF]/50 border w-min rounded-full text-sm secondary-bg-gradient text-nowrap'>
        {/* <span className="text-[#E17EFF]">
        
      </span> */}
      
      {/* <AnimatedShinyText>{data.status === 'online' ? 'Онлайн' : 'Офлайн'} {online}</AnimatedShinyText>
    <UsersRound className='h-4 text-[#E17EFF]' /> */}
    <AnimatedShinyText className="inline-flex items-center justify-center px-2 py-0.5 transition ease-out text-sm  hover:duration-300 ">
        <span>{data.status === 'online' ? 'Онлайн' : 'Офлайн'} {online}</span>
        <UsersRound className="ml-1 size-4 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
    </AnimatedShinyText>
  </div>
}

const OnlinePlayersDisplay = (): JSX.Element => {
  const endpoint = useSelector((state: RootState) => state.settingsState?.activeEndPoint)

  console.log(endpoint)
  const resource = useMemo(() => {
    if (!endpoint) return null
    return suspenseify(fetchStatus(endpoint))
  }, [endpoint])

  if (!endpoint || !resource) {
    return <Skeleton className="h-6 w-12 rounded-full bg-secondary" />
  }

  return (
    <Suspense fallback={<Skeleton className="h-6 w-12 rounded-xl" />}>
      <PlayersCount resource={resource} />
    </Suspense>
  )
}

export default OnlinePlayersDisplay
