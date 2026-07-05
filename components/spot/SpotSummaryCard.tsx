'use client'

import type { NowConditions } from '@/api/polvo/interfaces/now'
import type { SpotSummary } from '@/api/sargo/interfaces/spot'
import type { UserUnits } from '@/api/sargo/interfaces/user'
import { WindRatingBubble } from '@/components/forecast/CellItems'
import { formatValueWithUnitSeparated } from '@/lib/units'
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

/** Current-conditions row for the map cards, composed from the SAME
 *  components the spot forecast table uses (SurfItem + WindItem from
 *  CellItems) so the two can never drift visually. Null fields (cold
 *  forecast cache) render as an em dash; the 5-min summary refresh fills
 *  them in — never refetched harder client-side. */
function NowConditionsRow({
  conditions,
  units,
}: {
  conditions: NowConditions | null
  units: UserUnits
}): React.JSX.Element {
  const c = conditions
  const hasSurf = c !== null && c.surf !== null && c.period !== null
  const hasWind =
    c !== null &&
    c.windSpeed !== null &&
    c.windDirection !== null &&
    c.windRating !== null

  if (!hasSurf && !hasWind) {
    return (
      <ItemDescription className="flex items-center gap-2 text-xs">
        <span>—</span>
      </ItemDescription>
    )
  }

  return (
    <div className="mt-1 flex w-full min-w-0 items-center gap-2 text-xs">
      {hasSurf ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {formatValueWithUnitSeparated(c.surf as number, units.surf_height)}
          {formatValueWithUnitSeparated(c.period as number, 'seconds')}
        </div>
      ) : (
        <span className="flex-1 text-muted-foreground">—</span>
      )}
      {hasWind && (
        <div className="flex shrink-0 items-center gap-1.5">
          {formatValueWithUnitSeparated(
            c.windSpeed as number,
            units.wind_speed
          )}
          <WindRatingBubble
            direction={c.windDirection as number}
            windRating={c.windRating as number}
            size="sm"
          />
        </div>
      )}
    </div>
  )
}

interface SpotSummaryCardProps {
  spot: SpotSummary
  onSelect: (spot: SpotSummary) => void
  variant?: 'outline' | 'elevated'
  interactive?: boolean
  disabled?: boolean
  /** Current-hour conditions (map cards). `undefined` = feature not wired
   *  for this card; `null` = wired but no data yet → dashes. */
  conditions?: NowConditions | null
  units?: UserUnits
}

export function SpotSummaryCard({
  spot,
  onSelect,
  variant = 'outline',
  interactive = false,
  disabled = false,
  conditions,
  units,
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
        {/* Title + webcam icon share the row: the title needs min-w-0 INSIDE
            the flex row (flex items default to min-width:auto and refuse to
            shrink below their content, which would push the icon out instead
            of truncating the name). Icon is shrink-0 so long names ellipsize
            against it. */}
        <div className="flex w-full min-w-0 items-center gap-2">
          <ItemTitle className="block min-w-0 flex-1 truncate whitespace-nowrap [-webkit-line-clamp:unset]">
            {spot.name}
          </ItemTitle>
          {spot.webcam && (
            <Video className="size-3.5 shrink-0" strokeWidth={1.5} />
          )}
        </div>
        {spot.distance !== undefined && (
          <ItemDescription className="flex items-center gap-2 text-xs">
            <span className="flex-1">{formatDistance(spot.distance)}</span>
          </ItemDescription>
        )}
        {conditions !== undefined && units && (
          <NowConditionsRow conditions={conditions} units={units} />
        )}
      </ItemContent>
    </Item>
  )
}
