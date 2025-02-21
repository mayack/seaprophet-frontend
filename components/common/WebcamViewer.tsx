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
  const [showAfkAlert, setShowAfkAlert] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isTabActive, setIsTabActive] = useState(true)
  const [isWindowActive, setIsWindowActive] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const afkTimerRef = useRef<NodeJS.Timeout | null>(null)

  const stopStream = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause()
      if (hlsRef.current) {
        hlsRef.current.stopLoad()
      }
    }
  }, [])

  const startStream = useCallback(() => {
    if (videoRef.current && hlsRef.current) {
      hlsRef.current.startLoad()
      videoRef.current.play().catch((err) => {
        console.error('Error playing video:', err)
      })
    }
  }, [])

  const startAfkTimer = useCallback(() => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
    }

    afkTimerRef.current = setTimeout(() => {
      setShowAfkAlert(true)
      stopStream()
    }, CONFIG.webcam.afk_timer)
  }, [stopStream])

  const handleKeepWatching = () => {
    setShowAfkAlert(false)
    startStream()
    startAfkTimer()
  }

  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible'
    setIsTabActive(isVisible)

    if (!isVisible) {
      stopStream()
      if (afkTimerRef.current) {
        clearTimeout(afkTimerRef.current)
      }
    } else if (!showAfkAlert && isWindowActive) {
      startStream()
      startAfkTimer()
    }
  }, [showAfkAlert, isWindowActive, stopStream, startStream, startAfkTimer])

  const handleWindowFocus = useCallback(() => {
    setIsWindowActive(true)
    if (!showAfkAlert && isTabActive) {
      startStream()
      startAfkTimer()
    }
  }, [showAfkAlert, isTabActive, startStream, startAfkTimer])

  const handleWindowBlur = useCallback(() => {
    setIsWindowActive(false)
    stopStream()
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
    }
  }, [stopStream])

  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement)
  }

  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err)
    }
  }

  const handleVideoPlay = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleVideoError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('blur', handleWindowBlur)

    // Start AFK timer on initial mount if tab and window are active
    if (isTabActive && isWindowActive && !showAfkAlert) {
      startAfkTimer()
    }

    return () => {
      if (afkTimerRef.current) {
        clearTimeout(afkTimerRef.current)
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [
    handleVisibilityChange,
    handleWindowFocus,
    handleWindowBlur,
    startAfkTimer,
    isTabActive,
    isWindowActive,
    showAfkAlert,
  ])

  useEffect(() => {
    if (!videoRef.current || !config.url) return

    setIsLoading(true)
    setHasError(false)

    const video = videoRef.current
    const providerConfig =
      webcamProviders[config.provider as keyof typeof webcamProviders] ||
      webcamProviders.generic
    const baseUrl = config.url.substring(0, config.url.lastIndexOf('/') + 1)

    video.addEventListener('playing', handleVideoPlay)
    video.addEventListener('error', handleVideoError)

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: function (xhr, requestUrl) {
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
      })
      hlsRef.current = hls
      const streamUrl = providerConfig.requiresProxy
        ? `/api/proxy?url=${encodeURIComponent(config.url)}&provider=${config.provider}`
        : config.url
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.error('Fatal HLS error:', data)
          setHasError(true)
          setIsLoading(false)
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Trying to recover from network error...')
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Trying to recover from media error...')
              hls.recoverMediaError()
              break
            default:
              hls.destroy()
              break
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = providerConfig.requiresProxy
        ? `/api/proxy?url=${encodeURIComponent(config.url)}&provider=${config.provider}`
        : config.url
    }

    return () => {
      video.removeEventListener('playing', handleVideoPlay)
      video.removeEventListener('error', handleVideoError)
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
    }
  }, [config])

  return (
    <div ref={containerRef} className="relative h-60vh bg-foreground">
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

      {showAfkAlert && (
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
