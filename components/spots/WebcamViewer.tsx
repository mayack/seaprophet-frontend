'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import Player from 'video.js/dist/types/player'

interface WebcamViewerProps {
  url: string
  title: string
}

export function WebcamViewer({ url, title }: WebcamViewerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    playerRef.current = videojs(videoRef.current, {
      controls: true,
      fluid: true,
      sources: [
        {
          src: url,
          type: 'application/x-mpegURL',
        },
      ],
      html5: {
        hls: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: true,
        },
      },
    })

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [url])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div data-vjs-player>
          <video
            ref={videoRef}
            className="video-js vjs-default-skin vjs-big-play-centered"
          />
        </div>
      </CardContent>
    </Card>
  )
}
