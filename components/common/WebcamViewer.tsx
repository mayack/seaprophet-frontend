'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Expand, Shrink, RefreshCw, Play } from 'lucide-react'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { extractWebcamUrl } from '@/api/polvo/actions/webcam'

const AFK_TIMEOUT_MS = 5 * 60 * 1000
const PROXY_PREFIX = '/api/proxy?url='

type Status = 'loading' | 'playing' | 'error' | 'afk'

interface WebcamViewerProps {
  config: WebcamConfig
}

export function WebcamViewer({ config }: WebcamViewerProps) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const afkTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const cleanup = () => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
      afkTimerRef.current = null
    }
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }

  const resetAfkTimer = () => {
    if (afkTimerRef.current) clearTimeout(afkTimerRef.current)
    afkTimerRef.current = setTimeout(() => {
      cleanup()
      setStatus('afk')
    }, AFK_TIMEOUT_MS)
  }

  useEffect(() => {
    let cancelled = false

    async function resolveUrl() {
      setStatus('loading')
      setError(null)
      setStreamUrl(null)
      cleanup()

      if (config.url) {
        setStreamUrl(config.url)
        return
      }

      if (config.website_url) {
        try {
          const result = await extractWebcamUrl({
            websiteUrl: config.website_url,
            containerId: config.container_id,
            autoPlay: config.autoplay ?? true,
            cacheExpiration: config.cache ?? 300,
          })

          if (cancelled) return

          if (result.error || !result.data?.m3u8Url) {
            setError(
              result.error?.includes('404')
                ? 'Camera is offline'
                : 'Failed to load stream'
            )
            setStatus('error')
            return
          }

          setStreamUrl(result.data.m3u8Url)
        } catch {
          if (!cancelled) {
            setError('Failed to load stream')
            setStatus('error')
          }
        }
        return
      }

      setError('No stream URL configured')
      setStatus('error')
    }

    resolveUrl()
    return () => {
      cancelled = true
    }
  }, [
    config.url,
    config.website_url,
    config.container_id,
    config.autoplay,
    config.cache,
  ])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    cleanup()
    setStatus('loading')

    const proxyUrl = `${PROXY_PREFIX}${encodeURIComponent(streamUrl)}`

    const handleReady = async () => {
      try {
        await video.play()
        setStatus('playing')
        resetAfkTimer()
      } catch (e) {
        if (e instanceof Error && e.message.includes('interrupted')) return
        setError('Playback failed')
        setStatus('error')
      }
    }

    const handleError = (msg: string) => {
      setError(msg)
      setStatus('error')
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr, url) => {
          const finalUrl = url.startsWith('http')
            ? `${PROXY_PREFIX}${encodeURIComponent(url)}`
            : url
          xhr.open('GET', finalUrl, true)
        },
      })

      hlsRef.current = hls
      hls.loadSource(proxyUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, handleReady)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return
        const is404 =
          data.response?.code === 404 || data.details === 'manifestLoadError'
        handleError(is404 ? 'Camera is offline' : 'Stream error')
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxyUrl
      video.onloadedmetadata = handleReady
      video.onerror = () => handleError('Playback error')
    } else {
      handleError('HLS not supported')
    }

    return cleanup
  }, [streamUrl])

  useEffect(() => {
    if (status !== 'playing') return

    const handler = () => resetAfkTimer()
    window.addEventListener('mousemove', handler)
    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('mousemove', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [status])

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & { webkitFullscreenElement?: Element }
    const vid = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
      webkitExitFullscreen?: () => void
    }

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen()
      } else if (vid.webkitExitFullscreen) {
        vid.webkitExitFullscreen()
      }
    } else {
      if (vid.webkitEnterFullscreen) {
        vid.webkitEnterFullscreen()
      } else if (video.requestFullscreen) {
        video.requestFullscreen()
      }
    }
  }

  const retry = () => {
    setStreamUrl(null)
    setStatus('loading')
  }

  return (
    <div className="relative size-full bg-black">
      <video ref={videoRef} className="size-full" playsInline muted />

      {status === 'loading' && (
        <Overlay>
          <Spinner size="lg" className="text-white" />
          {config.website_url && !streamUrl && (
            <p className="mt-4 text-sm text-white/60">
              This camera takes longer to load
            </p>
          )}
        </Overlay>
      )}

      {status === 'error' && (
        <Overlay>
          <p className="text-white">{error}</p>
          <Button onClick={retry} variant="secondary" className="mt-4">
            <RefreshCw className="mr-2 size-4" /> Retry
          </Button>
        </Overlay>
      )}

      {status === 'afk' && (
        <Overlay>
          <p className="text-white">Still watching?</p>
          <Button onClick={retry} variant="secondary" className="mt-4">
            <Play className="mr-2 size-4" /> Continue
          </Button>
        </Overlay>
      )}

      {status === 'playing' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleFullscreen}
                size="icon"
                variant="ghost"
                className="absolute bottom-4 right-4 bg-black/80 text-white"
              >
                {document.fullscreenElement ? <Shrink /> : <Expand />}
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="left"
              className="text-xs leading-none"
              sideOffset={10}
            >
              Fullscreen
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
      {children}
    </div>
  )
}
