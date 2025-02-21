'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { ChevronRight, Expand, Shrink } from 'lucide-react'
import { Button } from '../ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '../ui/spinner'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { webcamProviders } from '@/constants/webcamProviders'
import { CONFIG } from '@/constants/config'

interface WebcamViewerProps {
  config: WebcamConfig
}

export function WebcamViewer({ config }: WebcamViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(
    document.visibilityState === 'visible'
  )
  const [isWindowFocused, setIsWindowFocused] = useState(true)
  const [isAfk, setIsAfk] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const afkTimerRef = useRef<NodeJS.Timeout | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const isUserActive = isTabVisible && isWindowFocused

  const stopStream = useCallback(() => {
    if (videoRef.current && hlsRef.current) {
      videoRef.current.pause()
      hlsRef.current.stopLoad()
    }
  }, [])

  const startStream = useCallback(() => {
    if (videoRef.current && hlsRef.current) {
      hlsRef.current.startLoad()
      videoRef.current.play().catch((err) => {
        console.error('Error playing video:', err)
        setHasError(true)
      })
    }
  }, [])

  const resetAfkTimer = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      if (afkTimerRef.current) {
        clearTimeout(afkTimerRef.current)
      }

      if (isUserActive && !isAfk) {
        startStream()
        afkTimerRef.current = setTimeout(() => {
          setIsAfk(true)
          stopStream()
        }, CONFIG.webcam.afk_timer)
      } else {
        stopStream()
      }
    }, 200) // Debounce delay of 200ms
  }, [isUserActive, isAfk, startStream, stopStream])

  const handleKeepWatching = useCallback(() => {
    setIsAfk(false)
    resetAfkTimer()
  }, [resetAfkTimer])

  const handleVisibilityChange = useCallback(() => {
    setIsTabVisible(document.visibilityState === 'visible')
    resetAfkTimer()
  }, [resetAfkTimer])

  const handleWindowFocus = useCallback(() => {
    setIsWindowFocused(true)
    resetAfkTimer()
  }, [resetAfkTimer])

  const handleWindowBlur = useCallback(() => {
    setIsWindowFocused(false)
    resetAfkTimer()
  }, [resetAfkTimer])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !config.url) return

    setIsLoading(true)
    setHasError(false)

    const providerConfig =
      webcamProviders[config.provider as keyof typeof webcamProviders] ||
      webcamProviders.generic
    const baseUrl = config.url.substring(0, config.url.lastIndexOf('/') + 1)

    const handleVideoPlay = () => {
      setIsLoading(false)
      setHasError(false)
    }
    const handleVideoError = () => {
      setIsLoading(false)
      setHasError(true)
    }

    video.addEventListener('playing', handleVideoPlay)
    video.addEventListener('error', handleVideoError)

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr, requestUrl) => {
          let finalUrl = requestUrl
          if (providerConfig.transformUrl) {
            finalUrl = providerConfig.transformUrl(baseUrl)(requestUrl)
          }
          const proxyUrl = providerConfig.requiresProxy
            ? `/api/proxy?url=${encodeURIComponent(finalUrl)}&provider=${config.provider}`
            : finalUrl
          if (!requestUrl.startsWith('/api/proxy')) {
            xhr.open('GET', proxyUrl, true)
          }
        },
        maxBufferHole: 2,
        maxMaxBufferLength: 10,
      })
      hlsRef.current = hls

      const streamUrl = providerConfig.requiresProxy
        ? `/api/proxy?url=${encodeURIComponent(config.url)}&provider=${config.provider}`
        : config.url
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('Fatal HLS error:', data)
          setHasError(true)
          setIsLoading(false)
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => hls.startLoad(), 2000) // Retry after 2s
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
          } else {
            hls.destroy()
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = providerConfig.requiresProxy
        ? `/api/proxy?url=${encodeURIComponent(config.url)}&provider=${config.provider}`
        : config.url
    }

    resetAfkTimer()

    return () => {
      video.removeEventListener('playing', handleVideoPlay)
      video.removeEventListener('error', handleVideoError)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (afkTimerRef.current) {
        clearTimeout(afkTimerRef.current)
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [config, resetAfkTimer])

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [handleVisibilityChange, handleWindowFocus, handleWindowBlur])

  return (
    <div ref={containerRef} className="relative h-[60vh] bg-foreground">
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        autoPlay
        muted
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" className="text-background" />
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center text-background">
          Failed to load webcam stream. Please try again later.
        </div>
      )}

      {!isUserActive && !isAfk && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
          Stream Paused
        </div>
      )}

      <Button
        onClick={toggleFullscreen}
        size="icon"
        variant="outline"
        className="absolute bottom-4 right-4"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <Shrink className="h-4 w-4" />
        ) : (
          <Expand className="h-4 w-4" />
        )}
      </Button>

      {isUserActive && isAfk && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Alert className="w-auto">
            <AlertDescription className="flex items-center gap-4">
              <div className="font-medium">Are you still there?</div>
              <Button size="sm" onClick={handleKeepWatching} className="gap-1">
                Keep watching
                <ChevronRight className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
