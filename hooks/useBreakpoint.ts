'use client'

import { useSyncExternalStore } from 'react'
import { SPOT_PANEL } from '@/constants/spotPanel'

const MEDIA_QUERY = `(min-width: ${SPOT_PANEL.breakpoints.md}px)`

interface BreakpointState {
  isDesktop: boolean
  width: number
}

/** Stable reference — getServerSnapshot must not allocate a new object per call. */
const SERVER_SNAPSHOT: BreakpointState = { isDesktop: false, width: 0 }

let clientSnapshot: BreakpointState = SERVER_SNAPSHOT

function subscribe(onStoreChange: () => void): () => void {
  const mq = window.matchMedia(MEDIA_QUERY)
  const onChange = (): void => onStoreChange()
  mq.addEventListener('change', onChange)
  window.addEventListener('resize', onChange)
  return (): void => {
    mq.removeEventListener('change', onChange)
    window.removeEventListener('resize', onChange)
  }
}

function getSnapshot(): BreakpointState {
  const isDesktop = window.matchMedia(MEDIA_QUERY).matches
  const width = window.innerWidth
  if (
    clientSnapshot.isDesktop !== isDesktop ||
    clientSnapshot.width !== width
  ) {
    clientSnapshot = { isDesktop, width }
  }
  return clientSnapshot
}

function getServerSnapshot(): BreakpointState {
  return SERVER_SNAPSHOT
}

/** Tracks desktop breakpoint and viewport width with a single listener. */
export function useBreakpoint(): BreakpointState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
