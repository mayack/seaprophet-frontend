'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMapFocus } from '@/contexts/MapFocusContext'

// Must match the `duration-300` slide transition below, so the box unmounts
// only after the close animation finishes.
const TRANSITION_MS = 300

/**
 * Reports the spot currently shown by the intercepting route into context.
 * Rendered (with the spot details) inside the @modal slot, so it mounts when a
 * spot opens and its props change when switching spots — but it never clears
 * on unmount. The box itself (SpotBox) is what closes, keyed off the route, so
 * switching spots updates `activeSpot` in place (never through null) and the
 * box doesn't close/reopen between spots.
 */
export function SpotBoxController({
  id,
  lng,
  lat,
  name,
}: {
  id: number
  lng: number
  lat: number
  name: string
}): null {
  const ctx = useMapFocus()
  const setActiveSpot = ctx?.setActiveSpot
  useEffect(() => {
    setActiveSpot?.({ id, lng, lat, name })
  }, [setActiveSpot, id, lng, lat, name])
  return null
}

/**
 * The popover box shell. Mounted once in the authenticated layout so it
 * persists across spot navigations — switching spots only swaps its children
 * (the spot details) and re-pans the map; the box never remounts, so it never
 * replays its open animation.
 *
 * - Desktop: floating card on the right with 16px margins (map visible around).
 * - Mobile: tall bottom sheet.
 *
 * Open/close is driven by the route (`/spot/[id]` → open), so the box appears
 * instantly on click and shows the modal slot's loading.tsx spinner while the
 * spot data streams in. The map focus waits for the coords (`activeSpot`).
 */
export function SpotBox({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const ctx = useMapFocus()
  const pathname = usePathname()
  const router = useRouter()

  const activeSpot = ctx?.activeSpot ?? null
  const focusSpot = ctx?.focusSpot
  const clearFocus = ctx?.clearFocus
  const setActiveSpot = ctx?.setActiveSpot
  // Open as soon as we're on a spot route — instantly, before the spot's data
  // has loaded — so the box appears right away and shows a spinner (the modal
  // slot's loading.tsx) while its content streams in. Map focus still waits for
  // the coords (activeSpot), which arrive with the data.
  const open = pathname?.startsWith('/spot/') ?? false

  const close = useCallback((): void => {
    // Just dismiss the box and stay on the map. `replace` (not back) so we
    // never navigate to a prior/external history entry — the cause of the
    // "routes back / refreshes" on a directly-loaded spot — and (not push) so
    // closing doesn't stack history. The map lives in the persistent (map)
    // layout, so this doesn't remount it: only the box closes and the focus
    // padding resets, leaving the map where the user was.
    router.replace('/')
  }, [router])

  // Drop the active spot whenever we're off the spot route, so stale coords
  // don't drive the map after the box has closed.
  useEffect(() => {
    if (!open) setActiveSpot?.(null)
  }, [open, setActiveSpot])

  // Pan/label the map once the spot's coords arrive (the box may already be
  // open and showing a spinner before this); reset when closed.
  useEffect(() => {
    if (!open) {
      clearFocus?.()
      return
    }
    if (activeSpot) {
      focusSpot?.([activeSpot.lng, activeSpot.lat])
    }
  }, [open, activeSpot, focusSpot, clearFocus])

  // Open/close animation. `rendered` keeps the box mounted through the
  // slide-out so it doesn't just vanish; `entered` drives the slide position.
  const [rendered, setRendered] = useState(open)
  const [entered, setEntered] = useState(false)
  // Cache the content while open so it stays visible during the close
  // animation (the route's modal slot goes empty the moment we navigate away).
  const [shownChildren, setShownChildren] = useState<React.ReactNode>(children)
  useEffect(() => {
    if (open) setShownChildren(children)
  }, [open, children])

  useEffect(() => {
    if (open) {
      setRendered(true)
      const id = requestAnimationFrame(() => setEntered(true))
      return (): void => cancelAnimationFrame(id)
    }
    // Closing: slide out, then unmount once the transition has finished.
    setEntered(false)
    const t = setTimeout(() => setRendered(false), TRANSITION_MS)
    return (): void => clearTimeout(t)
  }, [open])

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [open, close])

  // Fully closed and the slide-out has finished — render nothing (so no sliver
  // peeks at the screen edge).
  if (!rendered) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-hidden={!open}
      className={`fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] flex-col overflow-hidden rounded-t-xl border bg-background shadow-xl transition-transform duration-300 ease-out md:inset-y-4 md:left-auto md:right-4 md:h-auto md:w-[75vw] md:rounded-xl md:border ${
        open ? '' : 'pointer-events-none'
      } ${
        entered
          ? 'translate-y-0 md:translate-x-0'
          : 'translate-y-full md:translate-x-full md:translate-y-0'
      }`}
    >
      <div className="flex shrink-0 items-center justify-end border-b p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={close}
          aria-label="Close spot details"
        >
          <X />
        </Button>
      </div>
      <div className="wrapper-spacing mobile-safe-bottom flex-1 overflow-y-auto py-4 sm:py-6 xl:py-8">
        {shownChildren}
      </div>
    </div>
  )
}
