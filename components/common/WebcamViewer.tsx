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

export function WebcamViewer({ config }: WebcamViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState<string | null>(null)
  const [isAfk, setIsAfk] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const afkTimerRef = useRef<NodeJS.Timeout | null>(null)

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current
    if (!container) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        setIsFullscreen(false)
      } else {
        await container.requestFullscreen()
        setIsFullscreen(true)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [])

  const destroyStream = useCallback(() => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
      afkTimerRef.current = null
    }

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const video = videoRef.current
    if (video) {
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  const initStream = useCallback(() => {
    if (!config.url || isAfk) return

    setIsLoading(true)
    setHasError(null)
    destroyStream()

    const video = videoRef.current
    if (!video) return

    const provider =
      webcamProviders[config.provider as keyof typeof webcamProviders] ||
      webcamProviders.generic
    const baseUrl = config.url.substring(0, config.url.lastIndexOf('/') + 1)
    const streamUrl = provider.requiresProxy
      ? `/api/proxy?url=${encodeURIComponent(config.url)}&provider=${config.provider}`
      : config.url

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr, url) => {
          const finalUrl = provider.transformUrl
            ? provider.transformUrl(baseUrl)(url)
            : url
          const proxyUrl = provider.requiresProxy
            ? `/api/proxy?url=${encodeURIComponent(finalUrl)}&provider=${config.provider}`
            : finalUrl
          if (!url.startsWith('/api/proxy')) xhr.open('GET', proxyUrl, true)
        },
        autoStartLoad: true,
        lowLatencyMode: true,
      })

      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isAfk) {
          destroyStream()
          return
        }

        video
          .play()
          .then(() => {
            if (!isAfk) {
              setIsLoading(false)
              startAfkTimer()
            } else {
              destroyStream()
            }
          })
          .catch((err) => {
            setHasError(`Playback failed: ${err.message}`)
            setIsLoading(false)
          })
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (isAfk) {
          destroyStream()
          return
        }

        if (data.fatal) {
          setHasError(`Stream error: ${data.type} - ${data.details}`)
          setIsLoading(false)

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => hls.startLoad(), 2000)
          } else {
            destroyStream()
            setTimeout(initStream, 2000)
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl
      video.load()
      video
        .play()
        .then(() => {
          if (!isAfk) {
            setIsLoading(false)
            startAfkTimer()
          } else {
            destroyStream()
          }
        })
        .catch((err) => {
          setHasError(`Native playback failed: ${err.message}`)
          setIsLoading(false)
        })
    }
  }, [config.url, config.provider, destroyStream, isAfk])

  const startAfkTimer = useCallback(() => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
    }
    if (!isAfk) {
      afkTimerRef.current = setTimeout(() => {
        setIsAfk(true)
        destroyStream()
      }, AFK_TIMEOUT)
    }
  }, [isAfk, destroyStream])

  const handleMouseMove = useCallback(() => {
    if (!isAfk) {
      startAfkTimer()
    }
  }, [isAfk, startAfkTimer])

  const handleKeepWatching = useCallback(() => {
    setIsAfk(false)
    initStream()
  }, [initStream])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      if (isAfk) {
        destroyStream()
        return
      }
      setIsLoading(false)
      startAfkTimer()
    }

    const handleError = () => {
      if (isAfk) return
      setIsLoading(false)
      setHasError('Video error occurred')
    }

    video.addEventListener('playing', handlePlay)
    video.addEventListener('error', handleError)

    if (!isAfk) {
      initStream()
      startAfkTimer()
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove)
    }

    return () => {
      video.removeEventListener('playing', handlePlay)
      video.removeEventListener('error', handleError)
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove)
      }
      destroyStream()
    }
  }, [initStream, handleMouseMove, startAfkTimer, destroyStream, isAfk])

  return (
    <div ref={containerRef} className="relative h-60vh bg-foreground">
      <video ref={videoRef} className="h-full w-full" playsInline muted />
      {isLoading && !isAfk && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" className="text-background" />
        </div>
      )}
      {hasError && !isAfk && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-background">
          <div>{hasError || 'Failed to load webcam stream'}</div>
          <Button
            onClick={initStream}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      )}
      {isAfk && (
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
    </div>
  )
}
