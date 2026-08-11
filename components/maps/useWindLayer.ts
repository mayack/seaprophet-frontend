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
  /** Left edge of the usable timeline — the "Now" frame index. */
  minBandIndex: number
  /** UTC ISO timestamp of the current frame ('' until meta loads). */
  bandTime: string
  /** All frame timestamps (UTC ISO), for the timeline axis labels. */
  bandTimes: string[]
  isPlaying: boolean
  togglePlay: () => void
}

// Playback cadence: 1.5 s per 3h frame sweeps the 7-day timeline in ~85 s.
// The cross-fade spans the ENTIRE interval, so during playback the field is
// continuously morphing — one frame finishes blending exactly as the next
// begins, and direction changes never snap.
const PLAY_INTERVAL_MS = 1500
const PLAY_TRANSITION_MS = 1500
const SCRUB_TRANSITION_MS = 350
// Timeline length assumed before /api/wind meta arrives (7 days of 3h bands).
// Only affects the scrubber's initial extent; the real count replaces it.
const FALLBACK_BAND_COUNT = 56

/**
 * Index of the frame at or just before the real clock — the timeline's "Now".
 * Frames begin at the model run's start (up to ~a day in the past), so we
 * start the scrubber here rather than at frame 0, and treat this as the left
 * edge (past frames aren't shown).
 */
function nowFrameIndex(times: string[]): number {
  const now = Date.now()
  let idx = 0
  for (let i = 0; i < times.length; i++) {
    if (new Date(`${times[i]}:00Z`).getTime() <= now) idx = i
    else break
  }
  return idx
}

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
  // Left edge of the usable timeline (the "Now" frame). Frames before it are
  // in the past and hidden from the scrubber.
  const [minBandIndex, setMinBandIndex] = useState(0)
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
      const m = await fetchWindMeta()
      if (cancelled || !m) return
      const start = nowFrameIndex(m.times)
      const frame = await loadFrame(start)
      if (cancelled || !frame) return
      setMeta(m)
      setMinBandIndex(start)
      wantedFrameRef.current = start
      setBandIndexState(start)
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
        // Loop within the visible window: past the end, jump back to "Now".
        const next = current + 1 > count - 1 ? minBandIndex : current + 1
        wantedFrameRef.current = next
        void loadFrame(next).then((frame) => {
          if (frame && wantedFrameRef.current === next)
            engineRef.current?.setFrame(frame, PLAY_TRANSITION_MS)
        })
        return next
      })
    }, PLAY_INTERVAL_MS)
    return (): void => clearInterval(timer)
  }, [isPlaying, windEnabled, meta, minBandIndex, loadFrame])

  const setBandIndex = useCallback(
    (index: number): void => {
      // Manual scrub takes over from playback.
      setIsPlaying(false)
      const count = meta?.times.length ?? FALLBACK_BAND_COUNT
      const clamped = Math.max(minBandIndex, Math.min(count - 1, index))
      setBandIndexState(clamped)
      wantedFrameRef.current = clamped
      void loadFrame(clamped).then((frame) => {
        if (frame && wantedFrameRef.current === clamped)
          engineRef.current?.setFrame(frame, SCRUB_TRANSITION_MS)
      })
    },
    [meta, minBandIndex, loadFrame]
  )

  return {
    windEnabled,
    toggleWind,
    bandIndex,
    setBandIndex,
    bandCount: meta?.times.length ?? FALLBACK_BAND_COUNT,
    minBandIndex,
    bandTime: meta?.times[bandIndex] ?? '',
    bandTimes: meta?.times ?? [],
    isPlaying,
    togglePlay,
  }
}
