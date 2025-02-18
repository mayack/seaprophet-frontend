'use client'
import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { webcamProviders } from '@/config/webcamProviders'
import { WebcamConfig } from '@/api/sargo/interfaces/spot'
import { Expand, Shrink } from 'lucide-react'
import { Button } from '../ui/button'

interface WebcamViewerProps {
  config: WebcamConfig
}

export function WebcamViewer({ config }: WebcamViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)

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
    <div
      className={`bg-foreground relative ${expanded ? 'aspect-video' : 'aspect-3/1'}`}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        autoPlay
        muted
      />
      <Button
        onClick={() => setExpanded(!expanded)}
        size="icon"
        variant="outline"
        className="absolute bottom-4 right-4"
        aria-label={expanded ? 'Collapse webcam' : 'Expand webcam'}
      >
        {expanded ? (
          <Shrink className="h-4 w-4" />
        ) : (
          <Expand className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
