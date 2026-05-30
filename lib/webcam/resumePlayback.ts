import type Hls from 'hls.js'

const RESUME_DELAY_MS = 150

async function tryPlay(video: HTMLVideoElement): Promise<boolean> {
  if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return true
  }

  try {
    await video.play()
    return !video.paused
  } catch {
    return false
  }
}

/** Resume inline playback after iOS native fullscreen exits. */
export async function resumeInlinePlayback(
  video: HTMLVideoElement,
  playbackUrl: string,
  hls: Hls | null,
  usesNativeHls: boolean
): Promise<void> {
  if (await tryPlay(video)) return

  // iOS often needs a brief delay before play() succeeds after exiting
  // native video fullscreen.
  await new Promise((resolve) => setTimeout(resolve, RESUME_DELAY_MS))
  if (await tryPlay(video)) return

  if (usesNativeHls) {
    video.src = playbackUrl
    video.load()
    await tryPlay(video)
    return
  }

  hls?.startLoad(-1)
  await tryPlay(video)
}
