'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Hls from 'hls.js'
import { webcamProviders } from '@/config/webcamProviders'
import { WebcamConfig } from '@/api/sargo/interfaces/spot'

interface WebcamViewerProps {
  config: WebcamConfig
  title: string
}

export function WebcamViewer({ config }: WebcamViewerProps) {
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
            ? `/api/proxy?url=${encodeURIComponent(finalUrl)}`
            : finalUrl

          if (!requestUrl.startsWith('/api/proxy')) {
            xhr.open('GET', proxyUrl, true)
          }

          // Apply provider headers
          if (providerConfig.headers) {
            Object.entries(providerConfig.headers).forEach(([key, value]) => {
              xhr.setRequestHeader(key, value)
            })
          }
        },
      })
      hlsRef.current = hls

      const streamUrl = providerConfig.requiresProxy
        ? `/api/proxy?url=${encodeURIComponent(config.url)}`
        : config.url

      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.ERROR, function (event, data) {
        console.error('HLS error:', data)
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari - it has built in HLS support
      video.src = providerConfig.requiresProxy
        ? `/api/proxy?url=${encodeURIComponent(config.url)}`
        : config.url
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
    }
  }, [config])

  return (
    <Card className="w-full mb-6">
      <CardHeader>
        <CardTitle className="font-semibold">Live Webcam</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="aspect-video relative">
          <video
            ref={videoRef}
            className="w-full h-full"
            controls
            playsInline
            autoPlay
            muted
          />
        </div>
      </CardContent>
    </Card>
  )
}
