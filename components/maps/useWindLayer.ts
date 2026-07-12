'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { WindParticleEngine } from './windParticles'
import { fetchWindFrame, fetchWindMeta, type WindFieldMeta } from './windData'

export interface UseWindLayerReturn {
  windEnabled: boolean
  toggleWind: () => void
  /** Frame index into meta.times (3-hourly steps). */
  bandIndex: number
  setBandIndex: (index: number) => void
  bandCount: number
  /** UTC ISO timestamp of the current frame ('' until meta loads). */
  bandTime: string
  isPlaying: boolean
  togglePlay: () => void
}

// Playback cadence. ~500 ms per 3h frame sweeps the 5-day timeline in ~20 s.
const PLAY_INTERVAL_MS = 500

/**
 * Owns the wind particle overlay: toggling creates/destroys the Canvas2D
 * engine (see windParticles.ts), scrubbing fetches + swaps frames. Frames are
 * memoized per session — each is ~130 KB once, from a public CDN-cacheable
 * endpoint — so scrubbing back and forth is instant after first touch.
 */
export function useWindLayer(
  map: mapboxgl.Map | null,
  isLoaded: boolean
): UseWindLayerReturn {
  const [windEnabled, setWindEnabled] = useState(false)
  const [bandIndex, setBandIndexState] = useState(0)
  const [meta, setMeta] = useState<WindFieldMeta | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const engineRef = useRef<WindParticleEngine | null>(null)
  const framesRef = useRef(new Map<number, Uint8Array>())
  // Guards against a slow frame fetch landing after the user scrubbed on.
  const wantedFrameRef = useRef(0)

  const loadFrame = useCallback(
    async (index: number): Promise<Uint8Array | null> => {
      const cached = framesRef.current.get(index)
      if (cached) return cached
      const frame = await fetchWindFrame(index)
      if (frame) framesRef.current.set(index, frame)
      return frame
    },
    []
  )

  useEffect(() => {
    if (!map || !isLoaded || !windEnabled) return
    let cancelled = false

    const engine = new WindParticleEngine(map)
    engineRef.current = engine

    void (async () => {
      const [m, frame] = await Promise.all([fetchWindMeta(), loadFrame(0)])
      if (cancelled || !m || !frame) return
      setMeta(m)
      wantedFrameRef.current = 0
      setBandIndexState(0)
      engine.setField(m, frame)
    })()

    return (): void => {
      cancelled = true
      engine.destroy()
      engineRef.current = null
      setIsPlaying(false)
    }
  }, [map, isLoaded, windEnabled, loadFrame])

  const toggleWind = useCallback((): void => {
    setWindEnabled((v) => !v)
  }, [])

  const togglePlay = useCallback((): void => {
    setIsPlaying((v) => !v)
  }, [])

  // Playback: advance one frame per tick, looping. Frames prefetch on first
  // pass via the same memoized loader the scrubber uses, so the second loop
  // is perfectly smooth even on slow networks.
  useEffect(() => {
    if (!isPlaying || !windEnabled || !meta) return
    const count = meta.times.length
    const timer = setInterval(() => {
      setBandIndexState((current) => {
        const next = (current + 1) % count
        wantedFrameRef.current = next
        void loadFrame(next).then((frame) => {
          if (frame && wantedFrameRef.current === next)
            engineRef.current?.setFrame(frame)
        })
        return next
      })
    }, PLAY_INTERVAL_MS)
    return (): void => clearInterval(timer)
  }, [isPlaying, windEnabled, meta, loadFrame])

  const setBandIndex = useCallback(
    (index: number): void => {
      // Manual scrub takes over from playback.
      setIsPlaying(false)
      const count = meta?.times.length ?? 40
      const clamped = Math.max(0, Math.min(count - 1, index))
      setBandIndexState(clamped)
      wantedFrameRef.current = clamped
      void loadFrame(clamped).then((frame) => {
        if (frame && wantedFrameRef.current === clamped)
          engineRef.current?.setFrame(frame)
      })
    },
    [meta, loadFrame]
  )

  return {
    windEnabled,
    toggleWind,
    bandIndex,
    setBandIndex,
    bandCount: meta?.times.length ?? 40,
    bandTime: meta?.times[bandIndex] ?? '',
    isPlaying,
    togglePlay,
  }
}
