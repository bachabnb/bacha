'use client'

import { useEffect, useRef, useState } from 'react'
import type { SpinFeedResponse } from './spin/types'

/**
 * A very small polling fetcher for the spin feed.
 *
 * Deliberately not a data-fetching library: this is one endpoint with one
 * shape, and react-query is already in the bundle for wallet state. Polling
 * pauses while the tab is hidden so a backgrounded tab costs nothing.
 */
export default function useFeed(url: string, intervalMs = 15_000) {
  const [data, setData] = useState<SpinFeedResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function load() {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`feed ${res.status}`)
        const body = (await res.json()) as SpinFeedResponse
        if (mounted.current) {
          setData(body)
          setError(null)
        }
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e : new Error('feed failed'))
      } finally {
        if (mounted.current) {
          timer = setTimeout(() => {
            if (document.visibilityState === 'visible') void load()
            else timer = setTimeout(load, intervalMs)
          }, intervalMs)
        }
      }
    }

    void load()
    return () => {
      mounted.current = false
      if (timer) clearTimeout(timer)
    }
  }, [url, intervalMs])

  return { data, error }
}
