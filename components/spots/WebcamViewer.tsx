'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Hls from 'hls.js'

interface WebcamViewerProps {
  url: string
  title: string
}

export function WebcamViewer({ url, title }: WebcamViewerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        debug: true,
        enableWorker: true,
        fragLoadingMaxRetry: 5,
        manifestLoadingMaxRetry: 5,
        levelLoadingMaxRetry: 5,
        // Extract the base path from the m3u8 URL
        baseUrl: 'https://flus.spotfav.com/palmar-south-coast/tracks-v1/',
        xhrSetup: function (xhr, requestUrl) {
          // Log each request
          console.log('Loading:', requestUrl)
        },
      })

      hlsRef.current.loadSource(url)
      hlsRef.current.attachMedia(videoRef.current)

      hlsRef.current.on(Hls.Events.MANIFEST_LOADED, (event, data) => {
        console.log('Manifest loaded:', data)
      })

      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('Manifest parsed:', data)
        videoRef.current?.play().catch((e) => console.error('Play failed:', e))
      })

      hlsRef.current.on(Hls.Events.FRAG_LOADING, (event, data) => {
        console.log('Fragment loading:', {
          url: data.frag.url,
          level: data.frag.level,
          sn: data.frag.sn,
        })
      })

      hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          url: data.url,
          response: data.response,
        })

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...')
              hlsRef.current?.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...')
              hlsRef.current?.recoverMediaError()
              break
            default:
              console.error('Unrecoverable error')
              hlsRef.current?.destroy()
              break
          }
        }
      })
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari
      videoRef.current.src = url
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play().catch((e) => console.error('Play failed:', e))
      })
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [url])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="aspect-video relative">
          <video
            ref={videoRef}
            className="w-full h-full"
            controls
            playsInline
            crossOrigin="anonymous"
            autoPlay
            muted
          />
        </div>
      </CardContent>
    </Card>
  )
}
