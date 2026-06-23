'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * The home-spot marker glyph: a solid house (primary fill) with a white heart
 * (the shadcn `--background` token). No strokes. Used for the HTML drag marker
 * in edit mode and the popover header; the resting map glyph is a GL layer
 * (see `homeMarkerLayer.ts`).
 */
export function HomeSpotIcon({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      // Size is driven by `--home-marker-size` (set per-zoom on the edit marker
      // element so it scales like the GL spot pins); falls back to a fixed size
      // off-map (e.g. in the popover header).
      style={{
        width: 'var(--home-marker-size, 2.25rem)',
        height: 'var(--home-marker-size, 2.25rem)',
        // Lifts/grows while dragging (var toggled on the marker element).
        transform: 'scale(var(--home-marker-drag-scale, 1))',
        transformOrigin: 'center',
        transition: 'transform 150ms ease-out',
        ...style,
      }}
      className={cn('drop-shadow-md', className)}
      aria-hidden="true"
    >
      {/* House body */}
      <path
        fill="var(--primary)"
        d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      />
      {/* Heart */}
      <path
        fill="var(--background)"
        d="M8.62 13.8A2.25 2.25 0 1 1 12 10.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z"
      />
    </svg>
  )
}

/**
 * Controlled popover for the home-spot glyph. Anchored to a virtual element at
 * the marker's projected screen position (the glyph itself is a GL layer with
 * no DOM node). Opened by clicking the home layer on the map.
 */
export function HomeSpotPopover({
  open,
  onOpenChange,
  anchor,
  name,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchor: PopoverAnchor | null
  name: string
  onChange: () => void
}): React.JSX.Element {
  const handleChange = (): void => {
    onOpenChange(false)
    onChange()
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent
        side="top"
        sideOffset={12}
        anchor={anchor ?? undefined}
        className="w-44"
      >
        <div className="flex flex-col gap-3 text-center">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold">Your home spot</span>
            <span className="truncate text-sm text-muted-foreground">
              {name}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleChange}
          >
            Change
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Minimal virtual anchor (floating-ui shape) for positioning off a map point. */
export interface PopoverAnchor {
  getBoundingClientRect: () => DOMRect
}
