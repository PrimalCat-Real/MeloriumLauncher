'use client'
import { SERVER_ENDPOINTS } from '@/lib/config'
import { setActiveEndPoint } from '@/store/slice/settingsSlice'
import React, { useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'

const ping = async (url: string, timeoutMs = 2000): Promise<Response> => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal })
    if (!res.ok) throw new Error(`Status ${res.status}`)
    return res
  } finally {
    clearTimeout(id)
  }
}

type EndpointKey = keyof typeof SERVER_ENDPOINTS

const endpoint = 'launcher/check-connect'
const ActiveEndpointSelector = () => {
  const dispatch = useDispatch()

  const checkAndPick = useCallback(async () => {
    const endpoints: { key: EndpointKey; url: string }[] = [
      { key: 'main', url: `${SERVER_ENDPOINTS.main}/${endpoint}` },
      { key: 'proxy', url: `http://188.225.24.31:8081/check-connect` },
    ]

    // create controllers so we can abort remaining requests after first success
    const controllers = endpoints.map(() => new AbortController())

    const wrapped = endpoints.map((ep, idx) =>
      // wrap so Promise.any receives a rejection on failure
      (async () => {
        try {
          const controller = controllers[idx]
          // use a custom timeout slightly larger than fetch's internal abort if needed
          const timeoutMs = 3000
          const timer = setTimeout(() => controller.abort(), timeoutMs)
          try {
            const res = await fetch(ep.url, { method: 'GET', signal: controller.signal })
            clearTimeout(timer)
            if (!res.ok) throw new Error(`non-OK ${res.status}`)
            return { key: ep.key, base: ep.url.replace(/\/check-connect\/?$/, '') }
          } catch (err) {
            clearTimeout(timer)
            throw err
          }
        } catch (err) {
          throw err
        }
      })()
    )

    try {
      // Promise.any resolves with first fulfilled promise
      const winner = await Promise.any(wrapped)
      // abort others
      controllers.forEach((c) => {
        try { c.abort() } catch { /* noop */ }
      })

      
      const chosenKey = (winner as { key: EndpointKey; base: string }).key
      let chosenBase = SERVER_ENDPOINTS[chosenKey]
      // log if proxy won
      console.log("chosenKey", chosenKey, SERVER_ENDPOINTS.main)
      if (chosenKey === 'proxy') {
        chosenBase = SERVER_ENDPOINTS.proxy;
        console.log('Proxy responded first. Winner endpoint:', chosenBase)
      }

      // dispatch to store (slice expects object { activeEndPoint: string })
      dispatch(setActiveEndPoint({ activeEndPoint: chosenBase }))
    } catch (err) {
      // no endpoint succeeded first -> fallback to main
      console.warn('No endpoint responded in time. Falling back to main.', err)
      dispatch(setActiveEndPoint({ activeEndPoint: SERVER_ENDPOINTS.main }))
    }
  }, [dispatch])

  useEffect(() => {
    // This effect runs on mount and selects the active endpoint.
    // We need useEffect because we're performing IO (network).
    checkAndPick()
  }, [checkAndPick])
   return null
}

export default ActiveEndpointSelector