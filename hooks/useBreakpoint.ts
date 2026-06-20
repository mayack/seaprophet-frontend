'use client'

import { useSyncExternalStore } from 'react'
import { SPOT_PANEL } from '@/constants/spotPanel'

const SPOT_PANEL_MQ = `(min-width: ${SPOT_PANEL.layoutBreakpoints.spotPanel}px)`
const FORECAST_TABLE_MQ = `(min-width: ${SPOT_PANEL.layoutBreakpoints.forecastTable}px)`

interface BreakpointState {
  /** Side panel layout (right card) vs bottom sheet. */
  isSpotPanelDesktop: boolean
  /** Desktop forecast table vs mobile carousel inside the panel. */
  isForecastTableDesktop: boolean
  width: number
}

/** Stable reference — getServerSnapshot must not allocate a new object per call. */
const SERVER_SNAPSHOT: BreakpointState = {
  isSpotPanelDesktop: false,
  isForecastTableDesktop: false,
  width: 0,
}

let clientSnapshot: BreakpointState = SERVER_SNAPSHOT

function subscribe(onStoreChange: () => void): () => void {
  const spotPanelMq = window.matchMedia(SPOT_PANEL_MQ)
  const forecastTableMq = window.matchMedia(FORECAST_TABLE_MQ)
  const onChange = (): void => onStoreChange()

  spotPanelMq.addEventListener('change', onChange)
  forecastTableMq.addEventListener('change', onChange)
  window.addEventListener('resize', onChange)

  return (): void => {
    spotPanelMq.removeEventListener('change', onChange)
    forecastTableMq.removeEventListener('change', onChange)
    window.removeEventListener('resize', onChange)
  }
}

function getSnapshot(): BreakpointState {
  const isSpotPanelDesktop = window.matchMedia(SPOT_PANEL_MQ).matches
  const isForecastTableDesktop = window.matchMedia(FORECAST_TABLE_MQ).matches
  const width = window.innerWidth

  if (
    clientSnapshot.isSpotPanelDesktop !== isSpotPanelDesktop ||
    clientSnapshot.isForecastTableDesktop !== isForecastTableDesktop ||
    clientSnapshot.width !== width
  ) {
    clientSnapshot = {
      isSpotPanelDesktop,
      isForecastTableDesktop,
      width,
    }
  }

  return clientSnapshot
}

function getServerSnapshot(): BreakpointState {
  return SERVER_SNAPSHOT
}

/** Tracks spot-panel and forecast-table layout breakpoints with shared listeners. */
export function useBreakpoint(): BreakpointState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
