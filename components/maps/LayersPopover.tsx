'use client'

import React from 'react'
import { Wind } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface LayersPopoverProps {
  windEnabled: boolean
  onToggleWind: () => void
}

/**
 * Wind-layer toggle in the top toolbar. Clicking it turns the particle overlay
 * on/off; the icon glows blue (matching the locate button) while active, so the
 * map's live-overlay state is visible at a glance.
 */
export function LayersPopover({
  windEnabled,
  onToggleWind,
}: LayersPopoverProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="elevated"
            size="icon-sm"
            aria-label="Wind layer"
            aria-pressed={windEnabled}
            onClick={onToggleWind}
            className="rounded-md shadow-none ring-0"
          />
        }
      >
        <Wind className={cn(windEnabled && 'text-blue-500')} />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        Wind
      </TooltipContent>
    </Tooltip>
  )
}
