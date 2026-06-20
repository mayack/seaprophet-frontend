'use client'

import { useSyncExternalStore } from 'react'
import { canUseHoverTooltips } from '@/lib/pointerCapabilities'

function subscribe(onStoreChange: () => void): () => void {
  const query = window.matchMedia('(hover: hover) and (pointer: fine)')
  query.addEventListener('change', onStoreChange)
  return (): void => query.removeEventListener('change', onStoreChange)
}

function getSnapshot(): boolean {
  return canUseHoverTooltips()
}

function getServerSnapshot(): boolean {
  return false
}

export function useCanHoverTooltips(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
