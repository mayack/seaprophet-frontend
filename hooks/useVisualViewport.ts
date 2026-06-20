'use client'

import { useEffect, useState } from 'react'

export interface VisualViewportRect {
  /** Visual viewport offset from the layout viewport top (px). */
  offsetTop: number
  /** Visible height — shrinks when the on-screen keyboard is shown (px). */
  height: number
}

/**
 * Tracks `window.visualViewport` while `enabled`. The visual viewport is the
 * region actually visible to the user — on iOS/Android it shrinks when the
 * soft keyboard opens (the layout viewport and `dvh`/`svh` do not), so this is
 * the only reliable way to size an element to the space above the keyboard.
 *
 * Returns `null` until measured (and on browsers without the API).
 */
export function useVisualViewport(enabled: boolean): VisualViewportRect | null {
  const [rect, setRect] = useState<VisualViewportRect | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return

    const update = (): void => {
      setRect({ offsetTop: vv.offsetTop, height: vv.height })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return (): void => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])

  return rect
}
