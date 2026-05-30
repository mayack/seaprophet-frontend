'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type IOSVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitPresentationMode?: 'inline' | 'fullscreen' | 'picture-in-picture'
}

interface UseVideoFullscreenOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  onExitFullscreen?: () => void
}

export function useVideoFullscreen({
  videoRef,
  onExitFullscreen,
}: UseVideoFullscreenOptions): {
  isFullscreen: boolean
  toggleFullscreen: () => void
} {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isNativeVideoFullscreenRef = useRef(false)
  const onExitRef = useRef(onExitFullscreen)
  onExitRef.current = onExitFullscreen

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & { webkitFullscreenElement?: Element }

    const sync = (): void => {
      setIsFullscreen(
        !!(doc.fullscreenElement || doc.webkitFullscreenElement) ||
          isNativeVideoFullscreenRef.current
      )
    }

    const handleNativeExit = (): void => {
      isNativeVideoFullscreenRef.current = false
      sync()
      onExitRef.current?.()
    }

    const handleNativeEnter = (): void => {
      isNativeVideoFullscreenRef.current = true
      sync()
    }

    const onPresentationModeChanged = (): void => {
      const iosVideo = video as IOSVideo
      if (iosVideo.webkitPresentationMode === 'inline') {
        handleNativeExit()
      } else if (iosVideo.webkitPresentationMode === 'fullscreen') {
        handleNativeEnter()
      }
    }

    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    video.addEventListener('webkitbeginfullscreen', handleNativeEnter)
    video.addEventListener('webkitendfullscreen', handleNativeExit)
    video.addEventListener(
      'webkitpresentationmodechanged',
      onPresentationModeChanged
    )

    return (): void => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
      video.removeEventListener('webkitbeginfullscreen', handleNativeEnter)
      video.removeEventListener('webkitendfullscreen', handleNativeExit)
      video.removeEventListener(
        'webkitpresentationmodechanged',
        onPresentationModeChanged
      )
    }
  }, [videoRef])

  const toggleFullscreen = useCallback((): void => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & { webkitFullscreenElement?: Element }
    const iosVideo = video as IOSVideo

    if (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      isNativeVideoFullscreenRef.current
    ) {
      void doc.exitFullscreen?.()
      iosVideo.webkitExitFullscreen?.()
    } else {
      iosVideo.webkitEnterFullscreen?.() || void video.requestFullscreen?.()
    }
  }, [videoRef])

  return { isFullscreen, toggleFullscreen }
}
