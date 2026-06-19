'use client'

import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpotPanelHeaderMeta } from '@/components/spot/SpotsDetails/Meta'
import { cn } from '@/lib/utils'

/** Panel chrome — forecast meta + close (shared by mobile sheet and desktop card). */
export function SpotPanelHeader({
  onClose,
  onDragPointerDown,
  showGrabBar = false,
}: {
  onClose: () => void
  onDragPointerDown?: (event: React.PointerEvent<HTMLElement>) => void
  showGrabBar?: boolean
}): React.JSX.Element {
  return (
    <header
      className={cn(
        'shrink-0',
        onDragPointerDown && 'cursor-grab active:cursor-grabbing'
      )}
      onPointerDown={onDragPointerDown}
    >
      {showGrabBar ? (
        <div className="flex items-center justify-center pt-3 pb-1">
          <div
            className="h-1 w-16 rounded-full bg-border"
            aria-hidden
          />
        </div>
      ) : null}
      <div className="flex items-center justify-end gap-2 py-2 pr-2 pl-4 sm:pl-6">
        <SpotPanelHeaderMeta />
        <Button
          variant="ghost"
          size="icon"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="Close spot details"
        >
          <X />
        </Button>
      </div>
    </header>
  )
}
