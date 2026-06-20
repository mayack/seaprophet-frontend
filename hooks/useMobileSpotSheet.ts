'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { SPOT_PANEL } from '@/constants/spotPanel'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import {
  getMobilePanelHeightPx,
  getMobilePeekVisiblePx,
  type SpotSheetSnap,
} from '@/lib/spotFocusPadding'

const DRAG_THRESHOLD_PX = 10
const FLING_VELOCITY = 0.5 // px/ms

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function offsetForSnap(
  snap: SpotSheetSnap,
  panelHeight: number,
  peekVisiblePx: number
): number {
  if (snap === 'expanded') return 0
  if (snap === 'peek') {
    return Math.max(0, panelHeight - peekVisiblePx)
  }
  return panelHeight
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a, input, textarea, select, [role="button"]') !==
      null
  )
}

/** Peek drag — skip carousel so horizontal swipes stay on Embla. */
function isPeekDragBlocked(target: EventTarget | null): boolean {
  return (
    isInteractiveTarget(target) ||
    (target instanceof Element && target.closest('.embla') !== null)
  )
}

type PointerSession = {
  pointerId: number
  startY: number
  startOffset: number
  dragging: boolean
  lastY: number
  lastTime: number
  velocityY: number
}

interface UseMobileSpotSheetOptions {
  enabled: boolean
  isPresented: boolean
  dragEnabled?: boolean
  onRequestClose: () => void
  onSnapChange?: (snap: SpotSheetSnap) => void
  panelRef: RefObject<HTMLElement | null>
}

export interface UseMobileSpotSheetResult {
  snap: SpotSheetSnap
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPeekPanelPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  sheetStyle: CSSProperties | undefined
}

export function useMobileSpotSheet({
  enabled,
  isPresented,
  dragEnabled = true,
  onRequestClose,
  onSnapChange,
  panelRef,
}: UseMobileSpotSheetOptions): UseMobileSpotSheetResult {
  const { width: viewportWidth } = useBreakpoint()
  const peekVisiblePx = getMobilePeekVisiblePx(viewportWidth)

  const [snap, setSnap] = useState<SpotSheetSnap>('closed')
  const [panelHeight, setPanelHeight] = useState(0)
  const [dragY, setDragY] = useState<number | null>(null)

  const snapRef = useRef(snap)
  const heightRef = useRef(0)
  const dragYRef = useRef<number | null>(null)
  const sessionRef = useRef<PointerSession | null>(null)
  const wasPresentedRef = useRef(false)
  const peekVisibleRef = useRef(peekVisiblePx)
  const dragEnabledRef = useRef(dragEnabled)

  const height = panelHeight || getMobilePanelHeightPx()

  /* eslint-disable react-hooks/refs -- sync for pointer handlers between renders */
  snapRef.current = snap
  heightRef.current = height
  dragYRef.current = dragY
  peekVisibleRef.current = peekVisiblePx
  dragEnabledRef.current = dragEnabled
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    if (!enabled || dragEnabled) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDragY(null)
    sessionRef.current = null
    if (isPresented) {
      setSnap('peek')
    }
  }, [enabled, dragEnabled, isPresented])

  const resolveSnap = useCallback(
    (y: number, velocityY: number): void => {
      const panelH = heightRef.current
      const peekY = offsetForSnap('peek', panelH, peekVisibleRef.current)
      const midExpandedPeek = peekY / 2
      const midPeekClosed = (peekY + panelH) / 2

      if (velocityY < -FLING_VELOCITY) {
        setSnap('expanded')
        return
      }

      if (velocityY > FLING_VELOCITY && y > midExpandedPeek) {
        setSnap('closed')
        onRequestClose()
        return
      }

      if (y < midExpandedPeek) {
        setSnap('expanded')
      } else if (y < midPeekClosed) {
        setSnap('peek')
      } else {
        setSnap('closed')
        onRequestClose()
      }
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnap('closed')
      setDragY(null)
      sessionRef.current = null
    }

    wasPresentedRef.current = isPresented
  }, [enabled, isPresented])

  useEffect(() => {
    if (!onSnapChange) return
    onSnapChange(enabled ? snap : 'closed')
  }, [enabled, snap, onSnapChange])

  const beginSession = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!dragEnabledRef.current) return
      const panel = panelRef.current
      if (!panel) return

      sessionRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startOffset: offsetForSnap(
          snapRef.current,
          heightRef.current,
          peekVisibleRef.current
        ),
        dragging: false,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocityY: 0,
      }

      panel.setPointerCapture(event.pointerId)
    },
    [panelRef]
  )

  const onHeaderPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!enabled || !isPresented || !dragEnabled || isInteractiveTarget(event.target))
        return
      beginSession(event)
    },
    [enabled, isPresented, dragEnabled, beginSession]
  )

  const onPeekPanelPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!enabled || !isPresented || !dragEnabled || isPeekDragBlocked(event.target))
        return
      beginSession(event)
    },
    [enabled, isPresented, dragEnabled, beginSession]
  )

  useEffect(() => {
    if (!enabled || !isPresented || !dragEnabled) return

    const onPointerMove = (event: PointerEvent): void => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) return

      const deltaY = event.clientY - session.startY

      if (!session.dragging) {
        if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return
        session.dragging = true
      }

      const panelH = heightRef.current
      const nextY = clamp(session.startOffset + deltaY, 0, panelH)

      const dt = event.timeStamp - session.lastTime
      if (dt > 0) {
        session.velocityY = (event.clientY - session.lastY) / dt
      }
      session.lastY = event.clientY
      session.lastTime = event.timeStamp

      setDragY(nextY)
    }

    const endSession = (event: PointerEvent): void => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) return

      sessionRef.current = null

      if (!session.dragging) {
        if (snapRef.current === 'peek') {
          setSnap('expanded')
        }
        return
      }

      const y = dragYRef.current ?? session.startOffset
      setDragY(null)
      resolveSnap(y, session.velocityY)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endSession)
    window.addEventListener('pointercancel', endSession)

    return (): void => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endSession)
      window.removeEventListener('pointercancel', endSession)
    }
  }, [enabled, isPresented, dragEnabled, resolveSnap])

  // Peek only — stop iOS body rubber-band while the sheet is resting in peek.
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

  const translateY =
    dragY ??
    offsetForSnap(dragEnabled ? snap : 'peek', height, peekVisiblePx)
  const isDragging = dragY !== null

  return {
    snap,
    onHeaderPointerDown,
    onPeekPanelPointerDown,
    sheetStyle: enabled
      ? {
          transform: `translateY(${translateY}px)`,
          transition: isDragging
            ? 'none'
            : `transform ${SPOT_PANEL.transitionMs}ms ease-out`,
        }
      : undefined,
  }
}
