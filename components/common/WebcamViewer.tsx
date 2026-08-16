'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Hls, { type ErrorData, type Events } from 'hls.js'
import { Expand, Shrink, RefreshCw, Play } from 'lucide-react'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { extractWebcamUrl } from '@/api/polvo/actions/webcam'
import { WebcamConfig } from '@/api/sargo/interfaces/webcam'
import { CONFIG } from '@/constants/config'
import { cn } from '@/lib/utils'

const AFK_TIMEOUT_MS = CONFIG.webcam.afk_timer

interface WebcamViewerProps {
  configs: WebcamConfig[]
  className?: string
}

// ---------------------------------------------------------------------------
// Pure helpers (no component state)
// ---------------------------------------------------------------------------

/**
 * Providers that bind a stream URL to the address that fetches it. These must
 * be played DIRECTLY by the browser: polvo mints them for the visitor, so
 * routing them through our server means the server's address fetches a URL
 * signed for the visitor's — a guaranteed 403, with nothing in the response
 * to say why. Configuring a `referer` on one of these cams in Sargo would
 * otherwise silently break it.
 */
const DIRECT_ONLY_HOSTS = ['rtsp.me']

function isDirectOnly(url: string): boolean {
  try {
    const host = new URL(url, window.location.origin).hostname.toLowerCase()
    return DIRECT_ONLY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/** Route through /api/proxy when the cam needs a Referer header. */
function proxiedUrl(url: string, referer?: string): string {
  if (!referer || isDirectOnly(url)) return url
  return `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`
}

/**
 * Resolve the playable m3u8 for a config: either it's configured directly,
 * or we scrape it from the cam provider's page via the polvo action.
 */
async function resolveStreamUrl(
  config: WebcamConfig
): Promise<{ url: string } | { error: string }> {
  if (config.url) return { url: config.url }

  if (!config.website_url) return { error: 'No stream URL configured' }

  try {
    const result = await extractWebcamUrl({
      websiteUrl: config.website_url,
      containerId: config.container_id,
      autoPlay: config.autoplay ?? true,
      cacheExpiration: config.cache ?? 300,
    })
    if (result.error || !result.data?.m3u8Url) {
      return {
        error: result.error?.includes('404')
          ? 'Camera is offline'
          : 'Failed to load stream',
      }
    }
    return { url: result.data.m3u8Url }
  } catch {
    return { error: 'Failed to load stream' }
  }
}

/**
 * Draw the video's current frame onto the canvas (the frozen preview behind
 * the tap-to-play overlay). Needs a DECODED frame (readyState >=
 * HAVE_CURRENT_DATA); returns false when none exists yet.
 */
function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null
): boolean {
  if (!canvas || video.videoWidth === 0 || video.readyState < 2) return false
  try {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    return true
  } catch {
    // Cross-origin taint only blocks readback, not drawing — but be safe:
    // a blank canvas just means a dark backdrop.
    return false
  }
}

/**
 * When autoplay was blocked before a frame was decoded, ask the element to
 * decode one without playing and capture it as soon as it lands.
 */
function scheduleFrameCapture(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null,
  isStale: () => boolean
): void {
  video.preload = 'auto'
  const onFrame = (): void => {
    if (!isStale()) captureFrame(video, canvas)
  }
  video.addEventListener('loadeddata', onFrame, { once: true })
  if ('requestVideoFrameCallback' in video) {
    ;(
      video as HTMLVideoElement & {
        requestVideoFrameCallback: (cb: () => void) => void
      }
    ).requestVideoFrameCallback(onFrame)
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WebcamViewer({
  configs,
  className,
}: WebcamViewerProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Autoplay was blocked (iOS Low Power Mode / Android Data Saver reject even
  // muted autoplay). The stream is loaded and ready — it just needs a user
  // gesture. Rendered as a tap-to-play overlay, NOT an error: retrying the
  // whole init is wasteful and only "works" because the tap is the gesture.
  const [needsTap, setNeedsTap] = useState(false)
  const [isAfk, setIsAfk] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const config = configs[activeIndex] ?? configs[0]

  // Which of this spot's other cams we've already warmed, so switching between
  // them doesn't pay a cold resolve. Survives switches; reset only on remount.
  const prefetchedRef = useRef<Set<string>>(new Set())

  const videoRef = useRef<HTMLVideoElement>(null)
  // Frozen frame shown while the tap-to-play overlay is up. iOS paints its own
  // play glyph INSIDE the video's UA shadow DOM when autoplay is blocked and
  // modern WebKit ignores the ::-webkit-media-controls-* pseudo-elements — the
  // only reliable way to hide it is to hide the <video> itself, so we snapshot
  // the current frame to a canvas to keep the visual.
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const afkTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const streamIdRef = useRef(0)
  // iOS native fullscreen (webkitEnterFullscreen) doesn't update
  // document.fullscreenElement, so track it separately for the toggle + icon.
  const isNativeFullscreenRef = useRef(false)
  // Mirror `isAfk` into a ref so callbacks captured by the effect (e.g.
  // `isStale`) always see the latest value instead of the stale closure
  // value from when the effect first ran.
  const isAfkRef = useRef(isAfk)
  useEffect(() => {
    isAfkRef.current = isAfk
  }, [isAfk])

  // Everything the CURRENT stream attached (hls instance, video listeners),
  // detached with one call. Each init path registers exactly one closure —
  // replaces the previous per-listener ref bookkeeping.
  const teardownRef = useRef<(() => void) | null>(null)

  const clearAfkTimer = useCallback(() => {
    if (afkTimerRef.current) {
      clearTimeout(afkTimerRef.current)
      afkTimerRef.current = null
    }
  }, [])

  const cleanupStream = useCallback(() => {
    clearAfkTimer()

    teardownRef.current?.()
    teardownRef.current = null

    // Reset the <video> element so a previous src/MediaSource doesn't keep
    // buffering or fire late events on retry/unmount.
    const video = videoRef.current
    if (video) {
      video.removeAttribute('src')
      try {
        video.load()
      } catch {
        // Some browsers throw if load() is called during teardown — safe to ignore.
      }
    }
  }, [clearAfkTimer])

  /**
   * Warm the OTHER cams on this spot, so switching is quick.
   *
   * Deliberately warms the SERVER's cache rather than holding URLs here. A
   * client-side URL goes stale — Camaramar's live ~25 minutes — so a prefetch on
   * arrival used after a longer visit would hand the player a dead URL and turn
   * a saved wait into a broken cam. Asking again costs one round trip and hits a
   * warm cache (~2ms server-side) instead of a cold extraction (~4s).
   *
   * Only cams that need resolving: one configured with a direct `url` has
   * nothing to fetch. Sequential, not parallel — for a login-gated provider each
   * resolve is a Chromium launch on a box that shares its memory with the
   * forecast pipeline, and La Espasa has four cams. Firing them at once would
   * turn a convenience into a spike.
   *
   * Runs only after the first cam is PLAYING, so it never competes with the
   * stream the viewer is actually waiting for.
   */
  const prefetchOtherCams = useCallback(async () => {
    if (configs.length < 2) return
    for (const cam of configs) {
      if (isAfkRef.current) return // Left the tab; stop spending on their behalf.
      const target = cam.website_url
      if (!target || cam.url) continue // Direct URL: already resolved.
      if (target === config.website_url) continue // The one already playing.
      if (prefetchedRef.current.has(target)) continue
      prefetchedRef.current.add(target)
      try {
        await extractWebcamUrl({
          websiteUrl: target,
          containerId: cam.container_id,
          autoPlay: cam.autoplay ?? true,
          cacheExpiration: cam.cache ?? 300,
        })
      } catch {
        // Best effort: a cam that fails to warm just costs its own wait later.
        prefetchedRef.current.delete(target)
      }
    }
  }, [configs, config.website_url])

  const startAfkTimer = useCallback(() => {
    clearAfkTimer()
    afkTimerRef.current = setTimeout(() => {
      setIsAfk(true)
      cleanupStream()
    }, AFK_TIMEOUT_MS)
  }, [clearAfkTimer, cleanupStream])

  const initStream = useCallback(async () => {
    if (isAfkRef.current) return

    const currentStreamId = ++streamIdRef.current
    const isStale = (): boolean =>
      streamIdRef.current !== currentStreamId || isAfkRef.current

    setIsLoading(true)
    setError(null)
    setNeedsTap(false)
    cleanupStream()

    const video = videoRef.current
    if (!video) return

    // Mobile autoplay policy requires muted + playsInline to be TRUE ON THE
    // ELEMENT at play() time. React's `muted` attribute is not reliably
    // reflected during SSR/hydration (facebook/react#10389), which makes the
    // first play() throw NotAllowedError on mobile — set the properties
    // imperatively so autoplay is always eligible.
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true

    const resolved = await resolveStreamUrl(config)
    if (isStale()) return
    if ('error' in resolved) {
      setError(resolved.error)
      setIsLoading(false)
      return
    }

    const finalUrl = proxiedUrl(resolved.url, config.referer)

    const onPlaybackStarted = (): void => {
      if (isStale()) return
      setIsLoading(false)
      setNeedsTap(false)
      startAfkTimer()
      // Now that this cam is up, get the spot's others ready. Not awaited: the
      // viewer is watching, and a slow warm must never hold up the UI.
      void prefetchOtherCams()
    }
    video.addEventListener('playing', onPlaybackStarted, { once: true })
    const detachPlaying = (): void =>
      video.removeEventListener('playing', onPlaybackStarted)

    /** Terminal failure for this stream: detach + surface the message. */
    const fail = (msg: string): void => {
      if (isStale()) return
      detachPlaying()
      setError(msg)
      setIsLoading(false)
    }

    const handleReady = async (): Promise<void> => {
      if (isStale()) return
      try {
        await video.play()
      } catch (e) {
        if (isStale()) return
        if (!(e instanceof Error)) {
          fail('Playback failed')
          return
        }
        // Transient: a new load interrupted play(), or the browser aborted it
        // (common while iOS settles after exiting native fullscreen). The
        // `playing` listener still fires once playback starts.
        if (e.name === 'AbortError' || e.message.includes('interrupted')) {
          return
        }
        // Autoplay blocked (no user gesture — e.g. iOS Low Power Mode): the
        // stream is fine, it just needs a tap. Freeze a preview frame and show
        // the tap-to-play overlay; the 'playing' listener stays attached.
        if (e.name === 'NotAllowedError') {
          if (!captureFrame(video, canvasRef.current)) {
            scheduleFrameCapture(video, canvasRef.current, isStale)
          }
          setIsLoading(false)
          setNeedsTap(true)
          return
        }
        fail('Playback failed')
      }
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Start at the live edge with a small buffer and offload parsing to a
        // worker so playback begins after a few segments instead of filling a
        // large buffer first — much faster perceived startup for live cams.
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 18,
        maxMaxBufferLength: 30,
        // How many segments back from the live edge playback begins, and by far
        // the biggest lever on perceived load time — because it is measured in
        // SEGMENTS, and a segment is whatever the provider decided.
        //
        // Camaramar publishes 10-second segments of 1080p at 4.4 Mbps, i.e.
        // ~5.2 MB each, with only three in the chunklist. So the previous value
        // of 3 meant downloading ~15.7 MB before the first frame AND watching
        // footage up to 30 seconds old — on a surf cam, where the whole point is
        // what the water is doing now.
        //
        // 2 halves the wait to ~10.4 MB and the staleness to ~20s while keeping
        // one segment of slack. 1 would be faster still, but with only three
        // segments published and no lower-bitrate rendition to fall back to it
        // leaves no margin at all: one slow fetch and the viewer stalls.
        //
        // Worth re-checking if a provider with short segments is added — at 2s
        // segments this costs almost nothing, and the calculus changes entirely.
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 8,
        xhrSetup: config.referer
          ? (xhr, url): void => {
              // Don't double-proxy: segments rewritten by the proxy already
              // route through /api/proxy, but hls.js resolves them to absolute
              // URLs (e.g. https://seaprophet.com/api/proxy?...).
              if (
                url.startsWith('/api/proxy') ||
                url.startsWith(`${window.location.origin}/api/proxy`)
              ) {
                xhr.open('GET', url, true)
                return
              }
              xhr.open('GET', proxiedUrl(url, config.referer), true)
            }
          : undefined,
      })

      hls.on(Hls.Events.MANIFEST_PARSED, () => void handleReady())
      hls.on(Hls.Events.ERROR, (_event: Events.ERROR, data: ErrorData) => {
        if (isStale() || !data.fatal) return
        if (data.response?.code === 404) {
          fail('Camera is offline')
        } else if (
          data.response?.code === 403 &&
          isDirectOnly(data.url ?? '')
        ) {
          // Scoped deliberately to the per-viewer provider: a 403 from one of
          // those means the URL was signed for a different address than this
          // browser is fetching from — a stale mint, or the visitor reaching
          // us over IPv6 while the stream host is IPv4-only. From the user's
          // side that is indistinguishable from a dead camera, which is how it
          // went unnoticed once already. Every other provider keeps the exact
          // branches it had before.
          console.warn(
            `[webcam] 403 from ${config.name ?? 'stream'} — the URL was signed ` +
              'for a different address than this browser is using'
          )
          fail('Stream unavailable')
        } else if (data.details === 'manifestLoadError') {
          fail('Failed to load stream')
        } else {
          fail('Stream error')
        }
      })
      hls.loadSource(finalUrl)
      hls.attachMedia(video)

      // hls.destroy() detaches all of its own listeners + the media element.
      teardownRef.current = (): void => {
        detachPlaying()
        hls.destroy()
      }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (iOS Safari — no MSE, so hls.js is unsupported there).
      video.src = finalUrl
      video.onloadedmetadata = (): void => void handleReady()
      video.onerror = (): void => fail('Playback error')

      teardownRef.current = (): void => {
        detachPlaying()
        video.onloadedmetadata = null
        video.onerror = null
      }
    } else {
      fail('HLS not supported')
    }
  }, [config, cleanupStream, startAfkTimer, prefetchOtherCams])

  const handleRetry = useCallback(() => {
    initStream()
  }, [initStream])

  const handleTapToPlay = useCallback(() => {
    // Inside the click gesture, play() is allowed. The existing 'playing'
    // listener clears the overlay + starts the AFK timer. If play still
    // fails (stream died meanwhile), fall back to a full re-init.
    const video = videoRef.current
    if (!video) return
    video.play().catch(() => initStream())
  }, [initStream])

  const handleKeepWatching = useCallback(() => {
    // Update the ref synchronously so the guard at the top of `initStream`
    // (which reads `isAfkRef.current`) doesn't bail before the state update
    // from `setIsAfk(false)` is flushed on the next render.
    isAfkRef.current = false
    setIsAfk(false)
    initStream()
  }, [initStream])

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & { webkitFullscreenElement?: Element }
    const vid = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
      webkitExitFullscreen?: () => void
    }

    if (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      isNativeFullscreenRef.current
    ) {
      if (doc.exitFullscreen) doc.exitFullscreen()
      else vid.webkitExitFullscreen?.()
    } else {
      if (vid.webkitEnterFullscreen) vid.webkitEnterFullscreen()
      else video.requestFullscreen?.()
    }
  }, [])

  // Track fullscreen state for the toggle button + icon.
  //
  // iOS uses its native video fullscreen player (webkitbegin/endfullscreen),
  // which doesn't update document.fullscreenElement — hence the ref. When that
  // player closes, iOS tears down the hls.js MediaSource pipeline and leaves
  // the inline <video> dead, so we re-init the stream to recover it (the
  // loading spinner shows while it reconnects). This is keyed off the native
  // fullscreen event itself, not the OS: desktop and Android use the standard
  // Fullscreen API, where playback keeps running and no reload is needed.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & { webkitFullscreenElement?: Element }
    const syncIcon = (): void => {
      setIsFullscreen(
        !!(doc.fullscreenElement || doc.webkitFullscreenElement) ||
          isNativeFullscreenRef.current
      )
    }

    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    const onNativeBegin = (): void => {
      isNativeFullscreenRef.current = true
      syncIcon()
    }
    const onNativeEnd = (): void => {
      isNativeFullscreenRef.current = false
      syncIcon()
      // Let iOS finish tearing down its native player before we rebuild the
      // stream — re-initializing mid-transition makes play() abort.
      reloadTimer = setTimeout(() => initStream(), 300)
    }

    // Initial sync deferred a frame so state isn't set synchronously in the
    // effect body.
    const initialRaf = requestAnimationFrame(syncIcon)
    document.addEventListener('fullscreenchange', syncIcon)
    document.addEventListener('webkitfullscreenchange', syncIcon)
    video.addEventListener('webkitbeginfullscreen', onNativeBegin)
    video.addEventListener('webkitendfullscreen', onNativeEnd)

    return (): void => {
      cancelAnimationFrame(initialRaf)
      if (reloadTimer) clearTimeout(reloadTimer)
      document.removeEventListener('fullscreenchange', syncIcon)
      document.removeEventListener('webkitfullscreenchange', syncIcon)
      video.removeEventListener('webkitbeginfullscreen', onNativeBegin)
      video.removeEventListener('webkitendfullscreen', onNativeEnd)
    }
  }, [initStream])

  // Initialize on mount and config change. Deferred a frame so initStream's
  // initial setState isn't run synchronously inside the effect body.
  useEffect(() => {
    const raf = requestAnimationFrame(() => initStream())
    return (): void => {
      cancelAnimationFrame(raf)
      cleanupStream()
    }
  }, [initStream, cleanupStream])

  // Reset AFK timer on interaction
  useEffect(() => {
    if (isLoading || error || isAfk) return

    const handler = (): void => startAfkTimer()
    window.addEventListener('mousemove', handler)
    window.addEventListener('keydown', handler)
    window.addEventListener('touchstart', handler, { passive: true })

    return (): void => {
      window.removeEventListener('mousemove', handler)
      window.removeEventListener('keydown', handler)
      window.removeEventListener('touchstart', handler)
    }
  }, [isLoading, error, isAfk, startAfkTimer])

  // Fullscreen hotkey
  useEffect(() => {
    if (isLoading || error || isAfk) return

    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'f' || e.key === 'F') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault()
          toggleFullscreen()
        }
      }
    }

    window.addEventListener('keydown', handler)
    return (): void => window.removeEventListener('keydown', handler)
  }, [isLoading, error, isAfk, toggleFullscreen])

  return (
    <div
      data-theme="dark"
      className={cn(
        // Always a full-width 16:9 stage. Feeds with a different aspect
        // (e.g. square cams) are scaled to the stage height and centered
        // (object-contain), leaving bars at the sides instead of growing
        // the panel vertically. shrink-0 is load-bearing: the panel body is a
        // scrollable column flexbox, and overflow-hidden zeroes this item's
        // automatic minimum size — without shrink-0 the stage flex-shrinks to
        // 0 height whenever the panel content overflows (i.e. always).
        'relative aspect-video w-full shrink-0 overflow-hidden bg-card text-card-foreground',
        className
      )}
    >
      <video
        ref={videoRef}
        className={cn('size-full object-contain', needsTap && 'invisible')}
        playsInline
        muted
        autoPlay
        // "auto", not "metadata": decode the first frame immediately so the
        // tap-to-play snapshot (blocked autoplay) is ready without a lag. The
        // extra fetch is one segment — noise next to actually streaming.
        preload="auto"
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn(
          // Mirror the video's object-contain so the frozen tap-to-play
          // frame sits exactly where the live frame will appear.
          'pointer-events-none absolute inset-0 size-full object-contain',
          !needsTap && 'hidden'
        )}
      />

      {isLoading && !isAfk && (
        <Overlay>
          <Spinner className="size-8" />
          {config.website_url && (
            <p className="mt-4 text-sm">This camera takes longer to load</p>
          )}
        </Overlay>
      )}

      {needsTap && !error && !isAfk && (
        <Overlay>
          <Button
            onClick={handleTapToPlay}
            variant="overlay"
            size="icon-circle"
            aria-label="Play"
          >
            <Play />
          </Button>
        </Overlay>
      )}

      {error && !isAfk && (
        <Overlay>
          <p>{error}</p>
          <Button onClick={handleRetry} variant="overlay" className="mt-4">
            <RefreshCw />
            Retry
          </Button>
        </Overlay>
      )}

      {isAfk && (
        <Overlay>
          <p>Still watching?</p>
          <Button
            onClick={handleKeepWatching}
            variant="overlay"
            className="mt-4"
          >
            <Play />
            Continue
          </Button>
        </Overlay>
      )}

      {configs.length > 1 && !isAfk && (
        <div className="absolute bottom-4 left-4 flex gap-2 sm:bottom-6 sm:left-6">
          {configs.map((cam, i) => (
            <Button
              key={i}
              onClick={() => setActiveIndex(i)}
              size="xs"
              variant="overlay"
              data-active={i === activeIndex || undefined}
            >
              {cam.name || `CAM ${i + 1}`}
            </Button>
          ))}
        </div>
      )}

      {!isLoading && !error && !isAfk && !needsTap && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={toggleFullscreen}
                  size="icon-sm"
                  variant="overlay"
                  className="absolute right-4 bottom-4 sm:right-6 sm:bottom-6"
                >
                  {isFullscreen ? <Shrink /> : <Expand />}
                </Button>
              }
            />
            <TooltipContent side="left" sideOffset={10}>
              Fullscreen
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

function Overlay({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {children}
    </div>
  )
}
