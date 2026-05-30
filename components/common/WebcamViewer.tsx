'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Hls, { type ErrorData, type Events } from 'hls.js'
import { Expand, Shrink, RefreshCw, Play } from 'lucide-react'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { extractWebcamUrl } from '@/api/polvo/actions/webcam'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { CONFIG } from '@/constants/config'

const AFK_TIMEOUT_MS = CONFIG.webcam.afk_timer

interface WebcamViewerProps {
  config: WebcamConfig
}

function getStreamUrl(url: string, referer?: string): string {
  if (!referer) return url
  return `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`
}

export function WebcamViewer({ config }: WebcamViewerProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAfk, setIsAfk] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const afkTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const streamIdRef = useRef(0)
  // iOS native video fullscreen (webkitEnterFullscreen) does not update
  // document.fullscreenElement — track it separately for toggle + icon sync.
  const isVideoFullscreenRef = useRef(false)
  // Mirror `isAfk` into a ref so callbacks captured by the effect (e.g.
  // `isStale`) always see the latest value instead of the stale closure
  // value from when the effect first ran.
  const isAfkRef = useRef(isAfk)
  useEffect(() => {
    isAfkRef.current = isAfk
  }, [isAfk])

  // Track HLS event handlers and video listeners so cleanup can fully
  // detach them — `hls.destroy()` alone leaves listeners and the <video>
  // element with a lingering `src`/onerror.
  const hlsHandlersRef = useRef<{
    manifestParsed?: (event: Events.MANIFEST_PARSED) => void
    error?: (event: Events.ERROR, data: ErrorData) => void
  }>({})
  const videoHandlersRef = useRef<{
    playing?: () => void
    loadedmetadata?: () => void
    error?: () => void
  }>({})

  const clearAfkTimer = useCallback(() => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
      afkTimerRef.current = null
    }
  }, [])

  const cleanupStream = useCallback(() => {
    clearAfkTimer()

    const hls = hlsRef.current
    if (hls) {
      const handlers = hlsHandlersRef.current
      if (handlers.manifestParsed) {
        hls.off(Hls.Events.MANIFEST_PARSED, handlers.manifestParsed)
      }
      if (handlers.error) {
        hls.off(Hls.Events.ERROR, handlers.error)
      }
      hls.destroy()
      hlsRef.current = null
    }
    hlsHandlersRef.current = {}

    const video = videoRef.current
    if (video) {
      const vh = videoHandlersRef.current
      if (vh.playing) video.removeEventListener('playing', vh.playing)
      if (vh.loadedmetadata) {
        video.onloadedmetadata = null
      }
      if (vh.error) {
        video.onerror = null
      }
      // Reset the <video> element so a previous src/MediaSource doesn't
      // keep buffering or fire late events on retry/unmount.
      video.removeAttribute('src')
      try {
        video.load()
      } catch {
        // Some browsers throw if load() is called during teardown — safe to ignore.
      }
    }
    videoHandlersRef.current = {}
  }, [clearAfkTimer])

  const startAfkTimer = useCallback(() => {
    clearAfkTimer()
    afkTimerRef.current = setTimeout(() => {
      setIsAfk(true)
      cleanupStream()
    }, AFK_TIMEOUT_MS)
  }, [clearAfkTimer, cleanupStream])

  const initStream = useCallback(async () => {
    if (isAfkRef.current) return

    const currentStreamId = ++streamIdRef.current
    const isStale = (): boolean =>
      streamIdRef.current !== currentStreamId || isAfkRef.current

    setIsLoading(true)
    setError(null)
    cleanupStream()

    const video = videoRef.current
    if (!video) return

    // Step 1: Resolve stream URL
    let streamUrl = config.url

    if (!streamUrl && config.website_url) {
      try {
        const result = await extractWebcamUrl({
          websiteUrl: config.website_url,
          containerId: config.container_id,
          autoPlay: config.autoplay ?? true,
          cacheExpiration: config.cache ?? 300,
        })

        if (isStale()) return

        if (result.error || !result.data?.m3u8Url) {
          setError(
            result.error?.includes('404')
              ? 'Camera is offline'
              : 'Failed to load stream'
          )
          setIsLoading(false)
          return
        }

        streamUrl = result.data.m3u8Url
      } catch {
        if (isStale()) return
        setError('Failed to load stream')
        setIsLoading(false)
        return
      }
    }

    if (!streamUrl) {
      setError('No stream URL configured')
      setIsLoading(false)
      return
    }

    // Step 2: Initialize HLS
    const finalUrl = getStreamUrl(streamUrl, config.referer)

    const onPlaybackStarted = (): void => {
      if (isStale()) return
      setIsLoading(false)
      startAfkTimer()
    }

    video.addEventListener('playing', onPlaybackStarted, { once: true })
    videoHandlersRef.current.playing = onPlaybackStarted

    const handleReady = async (): Promise<void> => {
      if (isStale()) return
      try {
        await video.play()
      } catch (e) {
        if (e instanceof Error && e.message.includes('interrupted')) return
        if (isStale()) return
        video.removeEventListener('playing', onPlaybackStarted)
        videoHandlersRef.current.playing = undefined
        setError('Playback failed')
        setIsLoading(false)
      }
    }

    const handleError = (msg: string): void => {
      if (isStale()) return
      video.removeEventListener('playing', onPlaybackStarted)
      videoHandlersRef.current.playing = undefined
      setError(msg)
      setIsLoading(false)
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: config.referer
          ? (xhr, url): void => {
              // Don't double-proxy: segments rewritten by the proxy already
              // route through /api/proxy, but hls.js resolves them to absolute
              // URLs (e.g. https://seaprophet.com/api/proxy?...).
              if (
                url.startsWith('/api/proxy') ||
                url.startsWith(`${window.location.origin}/api/proxy`)
              ) {
                xhr.open('GET', url, true)
                return
              }
              const proxyUrl = getStreamUrl(url, config.referer)
              xhr.open('GET', proxyUrl, true)
            }
          : undefined,
      })

      hlsRef.current = hls
      hls.loadSource(finalUrl)
      hls.attachMedia(video)

      const onManifestParsed = (): void => {
        void handleReady()
      }
      const onHlsError = (_event: Events.ERROR, data: ErrorData): void => {
        if (isStale()) return
        if (!data.fatal) return

        const code = data.response?.code
        if (code === 404) {
          handleError('Camera is offline')
        } else if (data.details === 'manifestLoadError') {
          handleError('Failed to load stream')
        } else {
          handleError('Stream error')
        }
      }

      hlsHandlersRef.current.manifestParsed = onManifestParsed
      hlsHandlersRef.current.error = onHlsError
      hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed)
      hls.on(Hls.Events.ERROR, onHlsError)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = finalUrl
      const onLoadedMetadata = (): void => {
        void handleReady()
      }
      const onVideoError = (): void => handleError('Playback error')
      video.onloadedmetadata = onLoadedMetadata
      video.onerror = onVideoError
      videoHandlersRef.current.loadedmetadata = onLoadedMetadata
      videoHandlersRef.current.error = onVideoError
    } else {
      handleError('HLS not supported')
    }
  }, [config, cleanupStream, startAfkTimer])

  const handleRetry = useCallback(() => {
    initStream()
  }, [initStream])

  const handleKeepWatching = useCallback(() => {
    // Update the ref synchronously so the guard at the top of `initStream`
    // (which reads `isAfkRef.current`) doesn't bail before the state update
    // from `setIsAfk(false)` is flushed on the next render.
    isAfkRef.current = false
    setIsAfk(false)
    initStream()
  }, [initStream])

  // Keep the icon in sync with fullscreen state. Standard Fullscreen API events
  // cover desktop; iOS uses webkitEnterFullscreen on the <video>, which fires
  // webkitbeginfullscreen / webkitendfullscreen instead.
  useEffect(() => {
    const video = videoRef.current
    const doc = document as Document & { webkitFullscreenElement?: Element }

    const syncDocumentFullscreen = (): void => {
      setIsFullscreen(
        !!(doc.fullscreenElement || doc.webkitFullscreenElement) ||
          isVideoFullscreenRef.current
      )
    }

    const onWebkitBeginFullscreen = (): void => {
      isVideoFullscreenRef.current = true
      syncDocumentFullscreen()
    }

    const onWebkitEndFullscreen = (): void => {
      isVideoFullscreenRef.current = false
      syncDocumentFullscreen()

      // iOS Safari pauses on exit — resume if needed.
      if (!video?.paused) return
      void video.play().catch(() => {
        // Ignore — user may have paused intentionally or autoplay was blocked.
      })
    }

    syncDocumentFullscreen()
    document.addEventListener('fullscreenchange', syncDocumentFullscreen)
    document.addEventListener('webkitfullscreenchange', syncDocumentFullscreen)

    video?.addEventListener('webkitbeginfullscreen', onWebkitBeginFullscreen)
    video?.addEventListener('webkitendfullscreen', onWebkitEndFullscreen)

    return (): void => {
      document.removeEventListener('fullscreenchange', syncDocumentFullscreen)
      document.removeEventListener(
        'webkitfullscreenchange',
        syncDocumentFullscreen
      )
      video?.removeEventListener(
        'webkitbeginfullscreen',
        onWebkitBeginFullscreen
      )
      video?.removeEventListener('webkitendfullscreen', onWebkitEndFullscreen)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & { webkitFullscreenElement?: Element }
    const vid = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
      webkitExitFullscreen?: () => void
    }

    if (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      isVideoFullscreenRef.current
    ) {
      doc.exitFullscreen?.() || vid.webkitExitFullscreen?.()
    } else {
      vid.webkitEnterFullscreen?.() || video.requestFullscreen?.()
    }
  }, [])

  // Initialize on mount and config change
  useEffect(() => {
    initStream()
    return cleanupStream
  }, [initStream, cleanupStream])

  // Reset AFK timer on interaction
  useEffect(() => {
    if (isLoading || error || isAfk) return

    const handler = (): void => startAfkTimer()
    window.addEventListener('mousemove', handler)
    window.addEventListener('keydown', handler)
    window.addEventListener('touchstart', handler, { passive: true })

    return (): void => {
      window.removeEventListener('mousemove', handler)
      window.removeEventListener('keydown', handler)
      window.removeEventListener('touchstart', handler)
    }
  }, [isLoading, error, isAfk, startAfkTimer])

  // Fullscreen hotkey
  useEffect(() => {
    if (isLoading || error || isAfk) return

    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'f' || e.key === 'F') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault()
          toggleFullscreen()
        }
      }
    }

    window.addEventListener('keydown', handler)
    return (): void => window.removeEventListener('keydown', handler)
  }, [isLoading, error, isAfk, toggleFullscreen])

  return (
    <div className="relative size-full bg-black dark:bg-white/5">
      <video ref={videoRef} className="size-full" playsInline muted />

      {isLoading && !isAfk && (
        <Overlay>
          <Spinner size="lg" className="text-white" />
          {config.website_url && (
            <p className="mt-4 text-sm text-white">
              This camera takes longer to load
            </p>
          )}
        </Overlay>
      )}

      {error && !isAfk && (
        <Overlay>
          <p className="text-white">{error}</p>
          <Button onClick={handleRetry} variant="overlay" className="mt-4">
            <RefreshCw />
            Retry
          </Button>
        </Overlay>
      )}

      {isAfk && (
        <Overlay>
          <p className="text-white">Still watching?</p>
          <Button
            onClick={handleKeepWatching}
            variant="overlay"
            className="mt-4"
          >
            <Play />
            Continue
          </Button>
        </Overlay>
      )}

      {!isLoading && !error && !isAfk && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleFullscreen}
                size="icon"
                variant="overlay"
                className="absolute bottom-4 right-4"
              >
                {isFullscreen ? <Shrink /> : <Expand />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={10}>
              Fullscreen
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

function Overlay({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {children}
    </div>
  )
}
