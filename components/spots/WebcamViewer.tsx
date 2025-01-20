'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import type Player from 'video.js/dist/types/player'

interface WebcamViewerProps {
  url: string
  title: string
}

export function WebcamViewer({ url, title }: WebcamViewerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    const player = videojs(videoRef.current, {
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
          debug: true,
        },
      },
    })

    player.ready(function (this: Player) {
      console.log('Player is ready')

      this.on('error', () => {
        const error = this.error()
        console.error('Video.js Error:', error)
      })

      this.on('loadedmetadata', () => {
        console.log('Stream metadata loaded successfully')
      })

      this.on('waiting', () => {
        console.log('Stream is buffering or waiting')
      })

      this.on('playing', () => {
        console.log('Stream is playing')
      })
    })

    playerRef.current = player

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
            playsInline
            crossOrigin="anonymous"
          />
        </div>
      </CardContent>
    </Card>
  )
}
