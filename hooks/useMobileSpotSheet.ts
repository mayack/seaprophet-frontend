'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { SPOT_PANEL } from '@/constants/spotPanel'
import {
  getMobilePanelHeightPx,
  type SpotSheetSnap,
} from '@/lib/spotFocusPadding'

const VELOCITY_THRESHOLD = 0.4 // px/ms — flick to snap

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getPeekOffset(panelHeight: number): number {
  return panelHeight * (1 - SPOT_PANEL.mobilePeekRatio)
}

function snapToOffset(snap: SpotSheetSnap, panelHeight: number): number {
  if (snap === 'expanded') return 0
  if (snap === 'peek') return getPeekOffset(panelHeight)
  return panelHeight
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a, input, textarea, select, [role="button"]') !==
      null
  )
}

/** Peek panel drag — skip carousel so horizontal swipes stay on Embla. */
function isPeekPanelTarget(target: EventTarget | null): boolean {
  return (
    isInteractiveTarget(target) ||
    (target instanceof Element && target.closest('.embla') !== null)
  )
}

interface UseMobileSpotSheetOptions {
  enabled: boolean
  isPresented: boolean
  onRequestClose: () => void
  onSnapChange?: (snap: SpotSheetSnap) => void
  panelRef: RefObject<HTMLElement | null>
  transitionMs: number
}

export interface UseMobileSpotSheetResult {
  snap: SpotSheetSnap
  /** Expanded — header only. */
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  /** Peek — anywhere on the panel except interactive targets / Embla. */
  onPeekPanelPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  sheetMotionStyle: {
    transform: string
    transition: string
  }
}

export function useMobileSpotSheet({
  enabled,
  isPresented,
  onRequestClose,
  onSnapChange,
  panelRef,
  transitionMs,
}: UseMobileSpotSheetOptions): UseMobileSpotSheetResult {
  const [panelHeight, setPanelHeight] = useState(0)
  const [snap, setSnap] = useState<SpotSheetSnap>('closed')
  const [dragY, setDragY] = useState<number | null>(null)

  const snapRef = useRef(snap)
  const panelHeightRef = useRef(panelHeight)
  const dragYRef = useRef(dragY)
  const isDraggingRef = useRef(false)
  const wasPresentedRef = useRef(false)
  const dragStateRef = useRef({
    pointerId: -1,
    startY: 0,
    startOffset: 0,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
  })

  // Mirror the latest state into refs so the window-level pointer handlers
  // (registered once) read fresh values mid-drag without re-subscribing.
  /* eslint-disable react-hooks/refs */
  snapRef.current = snap
  panelHeightRef.current = panelHeight || getMobilePanelHeightPx()
  dragYRef.current = dragY
  /* eslint-enable react-hooks/refs */

  const settleAtY = useCallback(
    (y: number, velocityY: number): void => {
      const height = panelHeightRef.current
      const peekY = getPeekOffset(height)

      if (velocityY > VELOCITY_THRESHOLD) {
        if (y < peekY * 0.6) {
          setSnap('peek')
        } else {
          setSnap('closed')
          onRequestClose()
        }
        return
      }

      if (velocityY < -VELOCITY_THRESHOLD) {
        setSnap('expanded')
        return
      }

      const candidates: { snap: SpotSheetSnap; offset: number }[] = [
        { snap: 'expanded', offset: 0 },
        { snap: 'peek', offset: peekY },
        { snap: 'closed', offset: height },
      ]

      let nearest = candidates[0]
      let nearestDistance = Math.abs(y - candidates[0].offset)

      for (let i = 1; i < candidates.length; i += 1) {
        const distance = Math.abs(y - candidates[i].offset)
        if (distance < nearestDistance) {
          nearest = candidates[i]
          nearestDistance = distance
        }
      }

      if (nearest.snap === 'closed') {
        setSnap('closed')
        onRequestClose()
        return
      }

      setSnap(nearest.snap)
    },
    [onRequestClose]
  )

  useEffect(() => {
    if (!enabled) return

    const panel = panelRef.current
    if (!panel) return

    const measure = (): void => {
      setPanelHeight(panel.offsetHeight)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    return (): void => observer.disconnect()
  }, [enabled, panelRef])

  useEffect(() => {
    if (!enabled) return

    if (isPresented && !wasPresentedRef.current) {
      setSnap('peek')
    }

    if (!isPresented) {
      // Sync sheet state to the `isPresented` prop when the panel closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnap('closed')
      setDragY(null)
      isDraggingRef.current = false
    }

    wasPresentedRef.current = isPresented
  }, [enabled, isPresented])

  useEffect(() => {
    if (!onSnapChange) return
    onSnapChange(enabled ? snap : 'closed')
  }, [enabled, snap, onSnapChange])

  const finishDrag = useCallback((): void => {
    if (!isDraggingRef.current) return

    const height = panelHeightRef.current
    const currentY = dragYRef.current ?? snapToOffset(snapRef.current, height)
    const { velocityY } = dragStateRef.current

    isDraggingRef.current = false
    setDragY(null)
    settleAtY(currentY, velocityY)
  }, [settleAtY])

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const panel = panelRef.current
      if (!panel) return

      const height = panelHeightRef.current
      dragStateRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startOffset: dragYRef.current ?? snapToOffset(snapRef.current, height),
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocityY: 0,
      }

      panel.setPointerCapture(event.pointerId)
      isDraggingRef.current = true
      setDragY(dragYRef.current ?? snapToOffset(snapRef.current, height))
    },
    [panelRef]
  )

  const onHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!enabled || !isPresented || isInteractiveTarget(event.target)) return
      startDrag(event)
    },
    [enabled, isPresented, startDrag]
  )

  const onPeekPanelPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!enabled || !isPresented || isPeekPanelTarget(event.target)) return
      startDrag(event)
    },
    [enabled, isPresented, startDrag]
  )

  useEffect(() => {
    if (!enabled || !isPresented) return

    const onPointerMove = (event: PointerEvent): void => {
      if (!isDraggingRef.current) return
      if (event.pointerId !== dragStateRef.current.pointerId) return

      const height = panelHeightRef.current
      const deltaY = event.clientY - dragStateRef.current.startY
      const nextY = clamp(dragStateRef.current.startOffset + deltaY, 0, height)

      const dt = event.timeStamp - dragStateRef.current.lastTime
      if (dt > 0) {
        dragStateRef.current.velocityY =
          (event.clientY - dragStateRef.current.lastY) / dt
      }
      dragStateRef.current.lastY = event.clientY
      dragStateRef.current.lastTime = event.timeStamp

      setDragY(nextY)
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!isDraggingRef.current) return
      if (event.pointerId !== dragStateRef.current.pointerId) return
      finishDrag()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    return (): void => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [enabled, isPresented, finishDrag])

  // Peek only — stop iOS body rubber-band while dragging the sheet.
  useEffect(() => {
    if (!enabled || !isPresented || snap !== 'peek') return

    const onTouchMove = (event: TouchEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('[data-spot-panel]')) return
      if (target.closest('.embla')) return
      event.preventDefault()
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return (): void => document.removeEventListener('touchmove', onTouchMove)
  }, [enabled, isPresented, snap])

  const height = panelHeight || getMobilePanelHeightPx()
  const translateY = dragY ?? snapToOffset(snap, height)

  return {
    snap,
    onHeaderPointerDown,
    onPeekPanelPointerDown,
    sheetMotionStyle: {
      transform: `translateY(${translateY}px)`,
      transition:
        dragY !== null ? 'none' : `transform ${transitionMs}ms ease-out`,
    },
  }
}
