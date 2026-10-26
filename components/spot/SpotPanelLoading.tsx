import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import React from 'react'

interface SpotPanelLoadingProps {
  /** Fixed height for mobile peek loading (px). */
  heightPx?: number
}

/** Loading state for the spot panel (desktop side card and mobile peek strip). */
export function SpotPanelLoading({
  heightPx,
}: SpotPanelLoadingProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center',
        heightPx === undefined && 'min-h-0 flex-1'
      )}
      style={heightPx !== undefined ? { height: heightPx } : undefined}
    >
      <Spinner className="size-8" />
    </div>
  )
}
