'use client'
import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { webcamProviders } from '@/config/webcamProviders'
import { WebcamConfig } from '@/api/sargo/interfaces/spot'
import { ChevronRight, Expand, Shrink } from 'lucide-react'
import { Button } from '../ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface WebcamViewerProps {
  config: WebcamConfig
}

export function WebcamViewer({ config }: WebcamViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAfkAlert, setShowAfkAlert] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const afkTimerRef = useRef<NodeJS.Timeout | null>(null)

  const startAfkTimer = () => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
    }

    afkTimerRef.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.pause()
        if (hlsRef.current) {
          hlsRef.current.stopLoad()
        }
      }
      setShowAfkAlert(true)
    }, 120000)
  }

  const handleActivity = () => {
    if (!showAfkAlert) {
      startAfkTimer()
    }
  }

  const handleKeepWatching = () => {
    if (videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.startLoad()
      }
      videoRef.current.play()
    }
    setShowAfkAlert(false)
    startAfkTimer()
  }

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

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleActivity)
    document.addEventListener('keypress', handleActivity)
    document.addEventListener('scroll', handleActivity, true) // true for capture phase to catch all scroll events
    startAfkTimer()

    return () => {
      if (afkTimerRef.current) {
        clearTimeout(afkTimerRef.current)
      }
      document.removeEventListener('mousemove', handleActivity)
      document.removeEventListener('keypress', handleActivity)
      document.removeEventListener('scroll', handleActivity, true)
    }
  }, [])

  useEffect(() => {
    if (!videoRef.current || !config.url) return
    const video = videoRef.current
    const providerConfig =
      webcamProviders[config.provider as keyof typeof webcamProviders] ||
      webcamProviders.generic
    const baseUrl = config.url.substring(0, config.url.lastIndexOf('/') + 1)

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
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
    }
  }, [config])

  return (
    <div ref={containerRef} className="relative bg-foreground h-50vh">
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        autoPlay
        muted
      />
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
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
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
