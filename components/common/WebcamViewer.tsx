'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { Expand, Shrink, RefreshCw, Play } from 'lucide-react'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { CONFIG } from '@/constants/config'
import { extractWebcamUrl } from '@/api/polvo/actions/webcam'
import React from 'react'

const AFK_TIMEOUT = CONFIG.webcam.afk_timer

interface WebcamViewerProps {
  config: WebcamConfig
}

export function WebcamViewer({ config }: WebcamViewerProps): React.JSX.Element {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState<string | null>(null)
  const [isAfk, setIsAfk] = useState(false)
  const [m3u8Url, setM3u8Url] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const afkTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializingRef = useRef<boolean>(false)

  // Simple function to stop any timer
  const clearAfkTimer = useCallback((): void => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
      afkTimerRef.current = null
    }
  }, [])

  // Start the AFK timer
  const startAfkTimer = useCallback((): void => {
    clearAfkTimer()

    afkTimerRef.current = setTimeout(() => {
      setIsAfk(true)
      // Destroy stream directly instead of calling destroyStream
      clearAfkTimer()

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      const video = videoRef.current
      if (video) {
        video.pause()
        video.removeAttribute('src')
        // Use setTimeout to avoid interrupting pending play() promises
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.load()
          }
        }, 100)
      }
    }, AFK_TIMEOUT)
  }, [clearAfkTimer])

  // Stream destruction with proper cleanup
  const destroyStream = useCallback(async (): Promise<void> => {
    clearAfkTimer()

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const video = videoRef.current
    if (video) {
      // Pause and wait for any pending play() promises to complete
      video.pause()
      try {
        // Wait a bit to ensure any pending play() operations complete
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch {
        // Ignore errors
      }
      video.removeAttribute('src')
      video.load()
    }
  }, [clearAfkTimer])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async (): Promise<void> => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & {
      webkitFullscreenElement?: Element
      webkitExitFullscreen?: () => void
    }

    const videoEl = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
    }

    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        // Exit fullscreen
        const exitFn =
          doc.exitFullscreen?.bind(doc) || doc.webkitExitFullscreen?.bind(doc)
        exitFn?.()
        setIsFullscreen(false)
      } else {
        // Enter fullscreen
        if (video.paused) {
          try {
            await video.play()
          } catch {
            // Silently handle play error
          }
        }

        const enterFn =
          videoEl.requestFullscreen?.bind(videoEl) ||
          videoEl.webkitEnterFullscreen?.bind(videoEl)
        enterFn?.()
        setIsFullscreen(true)
      }
    } catch {
      // Silently handle fullscreen error
    }
  }, [])

  // Extract webcam URL if website_url is provided
  const extractWebcam = useCallback(async (): Promise<string | null> => {
    if (!config.website_url) {
      return null
    }

    try {
      setIsLoading(true)
      const result = await extractWebcamUrl({
        websiteUrl: config.website_url,
        containerId: config.container_id,
        autoPlay: config.autoplay ?? true,
        cacheExpiration: config.cache ?? 300,
      })

      if (result.error || !result.data?.m3u8Url) {
        const errorMsg = result.error || 'Failed to extract webcam URL'
        // Check if it's a 404
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
          throw new Error('The camera is offline.')
        }
        throw new Error(errorMsg)
      }

      return result.data.m3u8Url
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      // Use clean message if it's already formatted (like "The camera is offline.")
      setHasError(
        errorMessage.includes('The camera is offline')
          ? errorMessage
          : `Failed to extract webcam URL: ${errorMessage}`
      )
      setIsLoading(false)
      return null
    }
  }, [config.website_url, config.container_id, config.autoplay, config.cache])

  // Initialize the stream
  const initStream = useCallback(async (): Promise<void> => {
    if (isAfk || isInitializingRef.current) return

    isInitializingRef.current = true
    setIsLoading(true)
    setHasError(null)
    await destroyStream()

    const video = videoRef.current
    if (!video) {
      isInitializingRef.current = false
      return
    }

    // If website_url is provided, extract m3u8 URL first
    let streamUrl: string | null = null
    if (config.website_url) {
      const extractedUrl = await extractWebcam()
      if (extractedUrl) {
        streamUrl = extractedUrl
        setM3u8Url(extractedUrl)
      } else {
        // Error already set in extractWebcam
        isInitializingRef.current = false
        return
      }
    } else if (config.url) {
      streamUrl = config.url
    } else {
      setHasError('No webcam URL provided')
      setIsLoading(false)
      isInitializingRef.current = false
      return
    }

    if (!streamUrl) {
      setHasError('No valid webcam URL available')
      setIsLoading(false)
      isInitializingRef.current = false
      return
    }

    // Format error message - show clean message for 404s
    const formatErrorMessage = (
      error: unknown,
      defaultMessage: string
    ): string => {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // Check for 404 errors
      if (
        errorMessage.includes('404') ||
        errorMessage.includes('Not Found') ||
        errorMessage.toLowerCase().includes('camera is offline')
      ) {
        return 'The camera is offline.'
      }

      return defaultMessage
    }

    // Function to handle playback errors
    const handlePlaybackError = (
      message: string,
      shouldRetry = false
    ): void => {
      const cleanMessage = formatErrorMessage(message, message)
      setHasError(cleanMessage)
      setIsLoading(false)

      if (shouldRetry && !isAfk) {
        setTimeout(() => {
          if (!isAfk) initStream()
        }, 2000)
      }
    }

    // Setup HLS.js if supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        autoStartLoad: true,
        lowLatencyMode: true,
        xhrSetup: (xhr: XMLHttpRequest, url: string): void => {
          // Only proxy if not already proxied or localhost
          if (
            url.startsWith('/api/proxy') ||
            url.startsWith('http://localhost') ||
            url.startsWith('https://localhost')
          ) {
            xhr.open('GET', url, true)
          } else {
            // Route through proxy for CORS and authentication
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`
            xhr.open('GET', proxyUrl, true)
          }
        },
      })

      hlsRef.current = hls
      // Route through proxy for CORS and authentication
      const proxyStreamUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`
      hls.loadSource(proxyStreamUrl)
      hls.attachMedia(video)

      // Handle HLS events
      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        if (isAfk) {
          await destroyStream()
          isInitializingRef.current = false
          return
        }

        try {
          await video.play()
          if (!isAfk) {
            setIsLoading(false)
            startAfkTimer()
            isInitializingRef.current = false
          } else {
            await destroyStream()
            isInitializingRef.current = false
          }
        } catch (err: unknown) {
          // Ignore browser power-saving errors (video paused in background)
          const errorMessage =
            err instanceof Error ? err.message : 'unknown error'
          if (errorMessage.includes('background media was paused')) {
            isInitializingRef.current = false
            return
          }
          isInitializingRef.current = false
          const cleanMessage = formatErrorMessage(
            err,
            `Playback failed: ${errorMessage}`
          )
          handlePlaybackError(cleanMessage)
        }
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (isAfk) {
          void destroyStream()
          isInitializingRef.current = false
          return
        }

        // Ignore non-fatal errors - HLS.js handles them automatically
        if (!data.fatal) {
          return
        }

        // levelLoadError is non-fatal - HLS.js automatically tries another quality level
        // Don't show error to user since playback continues
        if (data.details === 'levelLoadError') {
          return
        }

        const errorMessage = `Stream error: ${data.type} - ${data.details}`

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          setHasError(errorMessage)
          setIsLoading(false)
          isInitializingRef.current = false
        } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Check for 404 or manifestLoadError (often means camera offline)
          // Proxy now returns proper 404 status codes, HLS.js passes them through
          const responseCode = data.response?.code
          const is404 =
            responseCode === 404 ||
            data.details?.includes('404') ||
            errorMessage.includes('404') ||
            data.details === 'manifestLoadError' // Can't load manifest = likely offline
          const displayMessage = is404 ? 'The camera is offline.' : errorMessage
          setHasError(displayMessage)
          setIsLoading(false)
          isInitializingRef.current = false
          if (!is404) {
            setTimeout(() => hls.startLoad(), 2000)
          }
        } else {
          isInitializingRef.current = false
          handlePlaybackError(errorMessage, true)
        }
      })
    }
    // Use native HLS support for Safari
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Route through proxy for CORS and authentication
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(streamUrl)}`
      video.src = proxyUrl
      video.load()

      video.onloadedmetadata = async (): Promise<void> => {
        if (isAfk) {
          await destroyStream()
          isInitializingRef.current = false
          return
        }

        try {
          await video.play()
          if (!isAfk) {
            setIsLoading(false)
            startAfkTimer()
            isInitializingRef.current = false
          } else {
            await destroyStream()
            isInitializingRef.current = false
          }
        } catch (err: unknown) {
          // Ignore browser power-saving errors (video paused in background)
          const errorMessage =
            err instanceof Error ? err.message : 'unknown error'
          if (errorMessage.includes('background media was paused')) {
            isInitializingRef.current = false
            return
          }
          isInitializingRef.current = false
          const cleanMessage = formatErrorMessage(
            err,
            `Native playback failed: ${errorMessage}`
          )
          handlePlaybackError(cleanMessage)
        }
      }
    }
    // No HLS support available
    else {
      isInitializingRef.current = false
      handlePlaybackError('HLS playback not supported in this browser')
    }
  }, [
    config.url,
    config.website_url,
    destroyStream,
    isAfk,
    startAfkTimer,
    extractWebcam,
  ])

  // Handle keeping watching after AFK
  const handleKeepWatching = useCallback((): void => {
    setIsAfk(false)
    void initStream()
  }, [initStream])

  // Handle mouse movement
  const handleMouseMove = useCallback((): void => {
    if (!isAfk) {
      startAfkTimer()
    }
  }, [isAfk, startAfkTimer])

  // Reset state when config changes (e.g., navigating between spots)
  useEffect(() => {
    // Reset all state to prevent showing wrong webcam
    setM3u8Url(null)
    setHasError(null)
    setIsLoading(true)
    setIsAfk(false)
    isInitializingRef.current = false
    clearAfkTimer()

    // Destroy any existing stream
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const video = videoRef.current
    if (video) {
      video.pause()
      video.removeAttribute('src')
      // Use setTimeout to avoid interrupting pending play() promises
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load()
        }
      }, 100)
    }
  }, [config.website_url, config.url, config.container_id, clearAfkTimer])

  // Initialize stream and set up event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const abortController = new AbortController()
    const signal = abortController.signal

    const handlePlay = (): void => {
      if (isAfk) {
        destroyStream()
        return
      }
      setIsLoading(false)
      startAfkTimer()
    }

    const handleError = (): void => {
      if (isAfk) return
      // Check if video has error details (404, etc.)
      const video = videoRef.current
      if (video?.error) {
        // Video element errors are generic, but check network state
        // 404s usually come through HLS.js error handler, but check here too
        setHasError('The camera is offline.')
      } else {
        setHasError('Video error occurred')
      }
      setIsLoading(false)
    }

    video.addEventListener('playing', handlePlay, { signal })
    video.addEventListener('error', handleError, { signal })

    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove, { signal })
    }

    // Initialize stream if not AFK
    if (!isAfk) {
      void initStream()
      startAfkTimer()
    }

    // Clean up
    return (): void => {
      abortController.abort()
      void destroyStream()
    }
  }, [initStream, handleMouseMove, destroyStream, isAfk, startAfkTimer])

  // Hotkey: toggle fullscreen with "F" when player is active and visible
  useEffect(() => {
    if (isLoading || !!hasError || isAfk) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return

      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName?.toLowerCase()
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          target.isContentEditable
        ) {
          return
        }
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLoading, hasError, isAfk, toggleFullscreen])

  return (
    <div
      ref={containerRef}
      className="relative size-full bg-foreground dark:bg-muted"
    >
      <video ref={videoRef} className="size-full" playsInline muted />

      {isLoading && !isAfk && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" className="text-background dark:text-foreground" />
        </div>
      )}

      {hasError && !isAfk && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-background dark:text-foreground">
          <div>{hasError || 'Failed to load webcam stream'}</div>
          <Button
            onClick={() => void initStream()}
            variant="white"
            className="flex items-center gap-2"
          >
            <RefreshCw className="size-4" /> Retry
          </Button>
        </div>
      )}

      {isAfk && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-foreground text-white dark:bg-muted dark:text-foreground">
          <div className="font-medium">Are you still there?</div>
          <Button
            onClick={handleKeepWatching}
            variant="white"
            className="flex items-center gap-2"
          >
            <Play className="size-4" /> Keep watching
          </Button>
        </div>
      )}

      {!isLoading && !hasError && !isAfk && (
        <Button
          onClick={toggleFullscreen}
          size="icon"
          variant="white"
          className="absolute bottom-4 right-4"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? (
            <Shrink className="size-6" />
          ) : (
            <Expand className="size-6" />
          )}
        </Button>
      )}
    </div>
  )
}
