'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { Expand, Shrink, RefreshCw, Play } from 'lucide-react'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { webcamProviders } from '@/constants/webcamProviders'
import { CONFIG } from '@/constants/config'

const AFK_TIMEOUT = CONFIG.webcam.afk_timer

interface WebcamViewerProps {
  config: WebcamConfig
}

// Custom hook for AFK timer management
function useAfkTimer(onAfk: () => void) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onAfk, AFK_TIMEOUT)
  }, [onAfk])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return clearTimer
  }, [clearTimer])

  return { resetTimer, clearTimer }
}

// Custom hook for fullscreen management
function useFullscreen(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & {
      webkitFullscreenElement?: Element
      webkitExitFullscreen?: () => void
    }

    const videoEl = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
    }

    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        // Exit fullscreen
        const exitFn =
          doc.exitFullscreen?.bind(doc) || doc.webkitExitFullscreen?.bind(doc)
        exitFn?.()
        setIsFullscreen(false)
      } else {
        // Enter fullscreen
        if (video.paused) {
          try {
            await video.play()
          } catch (err) {
            // Silently handle play error
          }
        }

        const enterFn =
          videoEl.requestFullscreen?.bind(videoEl) ||
          videoEl.webkitEnterFullscreen?.bind(videoEl)
        enterFn?.()
        setIsFullscreen(true)
      }
    } catch (err) {
      // Silently handle fullscreen error
    }
  }, [videoRef])

  return { isFullscreen, toggleFullscreen }
}

export function WebcamViewer({ config }: WebcamViewerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState<string | null>(null)
  const [isAfk, setIsAfk] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  // Prepare callbacks for AFK hook
  const handleAfk = useCallback(() => {
    setIsAfk(true)
    destroyStream()
  }, [])

  // Use our custom hooks
  const { resetTimer, clearTimer } = useAfkTimer(handleAfk)
  const { isFullscreen, toggleFullscreen } = useFullscreen(videoRef)

  // Handle stream destruction
  const destroyStream = useCallback(() => {
    clearTimer()

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const video = videoRef.current
    if (video) {
      video.removeAttribute('src')
      video.load()
    }
  }, [clearTimer])

  // Initialize the stream
  const initStream = useCallback(() => {
    if (!config.url || isAfk) return

    setIsLoading(true)
    setHasError(null)
    destroyStream()

    const video = videoRef.current
    if (!video) return

    // Get provider and prepare URLs
    const provider =
      webcamProviders[config.provider as keyof typeof webcamProviders] ||
      webcamProviders.generic
    const baseUrl = config.url.substring(0, config.url.lastIndexOf('/') + 1)
    const streamUrl = provider.requiresProxy
      ? `/api/proxy?url=${encodeURIComponent(config.url)}&provider=${config.provider}`
      : config.url

    // Function to handle playback errors
    const handlePlaybackError = (message: string) => {
      setHasError(message)
      setIsLoading(false)
    }

    // Function to handle successful playback start
    const handlePlaybackStart = async () => {
      if (isAfk) {
        destroyStream()
        return
      }

      try {
        await video.play()
        if (!isAfk) {
          setIsLoading(false)
          resetTimer()
        } else {
          destroyStream()
        }
      } catch (err: any) {
        handlePlaybackError(
          `Playback failed: ${err?.message || 'unknown error'}`
        )
      }
    }

    // Setup HLS.js if supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr, url) => {
          if (url.startsWith('/api/proxy')) return

          const finalUrl = provider.transformUrl
            ? provider.transformUrl(baseUrl)(url)
            : url
          const proxyUrl = provider.requiresProxy
            ? `/api/proxy?url=${encodeURIComponent(finalUrl)}&provider=${config.provider}`
            : finalUrl
          xhr.open('GET', proxyUrl, true)
        },
        autoStartLoad: true,
        lowLatencyMode: true,
      })

      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      // Handle HLS events
      hls.on(Hls.Events.MANIFEST_PARSED, handlePlaybackStart)

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (isAfk) {
          destroyStream()
          return
        }

        if (data.fatal) {
          const errorMessage = `Stream error: ${data.type} - ${data.details}`

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
            handlePlaybackError(errorMessage)
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            handlePlaybackError(errorMessage)
            setTimeout(() => hls.startLoad(), 2000)
          } else {
            handlePlaybackError(errorMessage)
            setTimeout(initStream, 2000)
          }
        }
      })
    }
    // Use native HLS support for Safari
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl
      video.load()
      handlePlaybackStart()
    }
    // No HLS support available
    else {
      handlePlaybackError('HLS playback not supported in this browser')
    }
  }, [config.url, config.provider, destroyStream, isAfk, resetTimer])

  // Handle keeping watching after AFK
  const handleKeepWatching = useCallback(() => {
    setIsAfk(false)
    initStream()
  }, [initStream])

  // Handle mouse movement
  const handleMouseMove = useCallback(() => {
    if (!isAfk) {
      resetTimer()
    }
  }, [isAfk, resetTimer])

  // Initialize stream and set up event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const abortController = new AbortController()
    const signal = abortController.signal

    const handlePlay = () => {
      if (isAfk) {
        destroyStream()
        return
      }
      setIsLoading(false)
      resetTimer()
    }

    const handleError = () => {
      if (isAfk) return
      setHasError('Video error occurred')
      setIsLoading(false)
    }

    video.addEventListener('playing', handlePlay, { signal })
    video.addEventListener('error', handleError, { signal })

    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove, { signal })
    }

    // Initialize stream if not AFK
    if (!isAfk) {
      initStream()
      resetTimer()
    }

    // Clean up
    return () => {
      abortController.abort()
      destroyStream()
    }
  }, [initStream, handleMouseMove, destroyStream, isAfk, resetTimer])

  // Render video UI components
  const renderOverlay = () => {
    if (isAfk) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 text-white">
          <div className="font-medium">Are you still there?</div>
          <Button
            onClick={handleKeepWatching}
            variant="white"
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" /> Keep watching
          </Button>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" className="text-background" />
        </div>
      )
    }

    if (hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-background">
          <div>{hasError || 'Failed to load webcam stream'}</div>
          <Button
            onClick={initStream}
            variant="white"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      )
    }

    return null
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-foreground">
      <video ref={videoRef} className="h-full w-full" playsInline muted />

      {renderOverlay()}

      <Button
        onClick={toggleFullscreen}
        size="icon"
        variant="white"
        className="absolute bottom-4 right-4"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <Shrink className="h-6 w-6" />
        ) : (
          <Expand className="h-6 w-6" />
        )}
      </Button>
    </div>
  )
}
