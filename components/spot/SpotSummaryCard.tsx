'use client'

import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
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
      : 'cursor-pointer hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50'

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
        <ItemTitle className="w-full max-w-full truncate [display:block] [-webkit-line-clamp:unset]">
          {spot.name}
        </ItemTitle>
        {spot.distance !== undefined && (
          <ItemDescription className="text-xs">
            {formatDistance(spot.distance)}
          </ItemDescription>
        )}
      </ItemContent>
      {spot.webcam && (
        <ItemMedia variant="icon" className="text-muted-foreground">
          <Video />
        </ItemMedia>
      )}
    </Item>
  )
}
