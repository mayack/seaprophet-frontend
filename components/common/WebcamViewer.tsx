'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
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

const AFK_TIMEOUT_MS = 5 * 60 * 1000

interface WebcamConfig {
  url?: string
  website_url?: string
  cache?: number
  autoplay?: boolean
  container_id?: string
}

interface WebcamViewerProps {
  config: WebcamConfig
}

function getProxyUrl(url: string): string {
  return `/api/proxy?url=${encodeURIComponent(url)}`
}

export function WebcamViewer({ config }: WebcamViewerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAfk, setIsAfk] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const afkTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const streamIdRef = useRef(0)

  const clearAfkTimer = useCallback(() => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
      afkTimerRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    clearAfkTimer()
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [clearAfkTimer])

  const startAfkTimer = useCallback(() => {
    clearAfkTimer()
    afkTimerRef.current = setTimeout(() => {
      setIsAfk(true)
      cleanup()
    }, AFK_TIMEOUT_MS)
  }, [clearAfkTimer, cleanup])

  const initStream = useCallback(async () => {
    if (isAfk) return

    const currentStreamId = ++streamIdRef.current
    const isStale = () => streamIdRef.current !== currentStreamId || isAfk

    setIsLoading(true)
    setError(null)
    cleanup()

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
    const proxyUrl = getProxyUrl(streamUrl)

    const handleReady = async () => {
      if (isStale()) return
      try {
        await video.play()
        if (isStale()) return
        setIsLoading(false)
        startAfkTimer()
      } catch (e) {
        if (e instanceof Error && e.message.includes('interrupted')) return
        if (isStale()) return
        setError('Playback failed')
        setIsLoading(false)
      }
    }

    const handleError = (msg: string) => {
      if (isStale()) return
      setError(msg)
      setIsLoading(false)
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr, url) => {
          const finalUrl = url.startsWith('http') ? getProxyUrl(url) : url
          xhr.open('GET', finalUrl, true)
        },
      })

      hlsRef.current = hls
      hls.loadSource(proxyUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, handleReady)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (isStale()) return
        if (!data.fatal) return

        const code = data.response?.code
        if (code === 404 || data.details === 'manifestLoadError') {
          handleError('Camera is offline')
        } else {
          handleError('Stream error')
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxyUrl
      video.onloadedmetadata = handleReady
      video.onerror = () => handleError('Playback error')
    } else {
      handleError('HLS not supported')
    }
  }, [config, isAfk, cleanup, startAfkTimer])

  const handleRetry = useCallback(() => {
    initStream()
  }, [initStream])

  const handleKeepWatching = useCallback(() => {
    setIsAfk(false)
    initStream()
  }, [initStream])

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & { webkitFullscreenElement?: Element }
    const vid = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
      webkitExitFullscreen?: () => void
    }

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      doc.exitFullscreen?.() || vid.webkitExitFullscreen?.()
    } else {
      vid.webkitEnterFullscreen?.() || video.requestFullscreen?.()
    }
  }, [])

  // Initialize on mount and config change
  useEffect(() => {
    initStream()
    return cleanup
  }, [initStream, cleanup])

  // Reset AFK timer on interaction
  useEffect(() => {
    if (isLoading || error || isAfk) return

    const handler = () => startAfkTimer()
    window.addEventListener('mousemove', handler)
    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('mousemove', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [isLoading, error, isAfk, startAfkTimer])

  // Fullscreen hotkey
  useEffect(() => {
    if (isLoading || error || isAfk) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault()
          toggleFullscreen()
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isLoading, error, isAfk, toggleFullscreen])

  return (
    <div className="relative size-full bg-black">
      <video ref={videoRef} className="size-full" playsInline muted />

      {isLoading && !isAfk && (
        <Overlay>
          <Spinner size="lg" className="text-white" />
          {config.website_url && (
            <p className="mt-4 text-sm text-white/60">
              This camera takes longer to load
            </p>
          )}
        </Overlay>
      )}

      {error && !isAfk && (
        <Overlay>
          <p className="text-white">{error}</p>
          <Button onClick={handleRetry} variant="secondary" className="mt-4">
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        </Overlay>
      )}

      {isAfk && (
        <Overlay>
          <p className="text-white">Still watching?</p>
          <Button
            onClick={handleKeepWatching}
            variant="secondary"
            className="mt-4"
          >
            <Play className="mr-2 size-4" />
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
                variant="ghost"
                className="absolute bottom-4 right-4 bg-black/80 text-white"
              >
                {document.fullscreenElement ? <Shrink /> : <Expand />}
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

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
      {children}
    </div>
  )
}
