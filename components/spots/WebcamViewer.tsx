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

    playerRef.current = videojs(
      videoRef.current,
      {
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
            debug: true, // Enable debug logging
          },
        },
      },
      function onPlayerReady(this: Player) {
        // Log when player is ready
        console.log('Player is ready')

        // Add error event listener
        this.on('error', function (error: any) {
          console.error('Video.js Error:', error)
          console.error('Error details:', this.error())
        })

        // Add success event listener
        this.on('loadedmetadata', function () {
          console.log('Stream metadata loaded successfully')
        })

        // Monitor stream status
        this.on('waiting', function () {
          console.log('Stream is buffering or waiting')
        })

        this.on('playing', function () {
          console.log('Stream is playing')
        })
      }
    )

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
            crossOrigin="anonymous" // Try adding this
          />
        </div>
      </CardContent>
    </Card>
  )
}
