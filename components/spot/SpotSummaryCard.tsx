'use client'

import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { cn } from '@/lib/utils'
import { formatDistance } from '@/utils/location'
import { Video } from 'lucide-react'
import React from 'react'

interface SpotSummaryCardProps {
  spot: SpotSummary
  onSelect: (spot: SpotSummary) => void
  variant?: 'outline' | 'elevated'
  interactive?: boolean
  disabled?: boolean
}

export function SpotSummaryCard({
  spot,
  onSelect,
  variant = 'outline',
  interactive = false,
  disabled = false,
}: SpotSummaryCardProps): React.JSX.Element {
  const interactiveClasses =
    variant === 'elevated'
      ? 'cursor-pointer hover:border-muted hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:border-muted dark:hover:bg-muted'
      : 'cursor-pointer shadow-xs hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50'

  return (
    <Item
      variant={variant}
      size="sm"
      className={cn(
        'h-full flex-nowrap',
        interactive && !disabled && interactiveClasses,
        disabled && 'pointer-events-none [&>*]:opacity-30'
      )}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect(spot)
      }}
    >
      <ItemContent className="min-w-0 gap-y-0.5">
        <ItemTitle className="block max-w-full min-w-0 truncate whitespace-nowrap [-webkit-line-clamp:unset]">
          {spot.name}
        </ItemTitle>
        {spot.distance !== undefined && (
          <ItemDescription className="flex items-center gap-2 text-xs">
            <span className="flex-1">{formatDistance(spot.distance)}</span>
            {spot.webcam && <Video className="size-3.5" strokeWidth={1.5} />}
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  )
}
