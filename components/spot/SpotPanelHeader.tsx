'use client'

import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SpotPanelHeaderMeta,
  type SpotPanelMetaInfo,
} from '@/components/spot/SpotsDetails/Meta'
import { SPOT_PANEL } from '@/constants/spotPanel'
import { cn } from '@/lib/utils'

/** Panel chrome — forecast meta + close (shared by mobile sheet and desktop card). */
export function SpotPanelHeader({
  meta,
  onClose,
  onDragPointerDown,
  showGrabBar = false,
  closeOnly = false,
}: {
  meta: SpotPanelMetaInfo | null
  onClose: () => void
  onDragPointerDown?: (event: React.PointerEvent<HTMLElement>) => void
  showGrabBar?: boolean
  /** Loading — hide grab bar and meta; close button only. */
  closeOnly?: boolean
}): React.JSX.Element {
  return (
    <header
      className={cn(
        'shrink-0',
        onDragPointerDown && 'cursor-grab active:cursor-grabbing'
      )}
      onPointerDown={onDragPointerDown}
    >
      {showGrabBar && !closeOnly ? (
        <div className="flex items-center justify-center pt-2 absolute top-0 w-full">
          <div className="h-1 w-16 rounded-full bg-border" aria-hidden />
        </div>
      ) : null}
      <div
        className={cn(
          'flex items-center justify-end gap-2',
          closeOnly ? 'p-1.5' : 'pl-4 pr-1.5 py-1.5 md:pl-6'
        )}
        style={
          closeOnly ? { height: SPOT_PANEL.mobilePeekHeaderPx } : undefined
        }
      >
        {!closeOnly ? <SpotPanelHeaderMeta meta={meta} /> : null}
        <Button
          variant="ghost"
          size="icon"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="Close spot details"
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
    </header>
  )
}
