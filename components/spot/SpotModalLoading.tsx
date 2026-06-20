import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import React from 'react'

interface SpotModalLoadingProps {
  /** Fixed height for mobile peek loading (px). */
  heightPx?: number
}

/** Shared loading state for spot modal routes. */
export function SpotModalLoading({
  heightPx,
}: SpotModalLoadingProps): React.JSX.Element {
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
