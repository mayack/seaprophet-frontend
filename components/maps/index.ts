import { lazy } from 'react'

// Dynamic imports for better code splitting
export const MapNavigator = lazy(() =>
  import('./MapNavigator').then((module) => ({
    default: module.MapNavigator,
  }))
)

export const SimpleMap = lazy(() =>
  import('./SimpleMap').then((module) => ({
    default: module.SimpleMap,
  }))
)

// Static exports for utilities that are needed immediately
export { useMapbox } from './useMapbox'
export * from './utils'

// Re-export types for convenience
export type {
  SimpleMapProps,
  MapNavigatorProps,
  UseMapboxOptions,
  UseMapboxReturn,
  Coordinates,
  LocationState,
  MapError,
  GeographicBounds,
} from '@/types/map'
