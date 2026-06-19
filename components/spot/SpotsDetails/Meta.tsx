'use client'

import { Mountain, Waves } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { isDevModeActive } from '@/lib/userSettings'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Forecast meta shown in the panel header. */
export interface SpotPanelMetaInfo {
  updatedAt: string | null
  terrainData: boolean
  bathymetryData: boolean
}

function DataIndicator({
  icon: Icon,
  label,
  description,
}: {
  icon: typeof Mountain
  label: string
  description: string
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="flex cursor-help items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          />
        }
      >
        <Icon className="size-3" />
        <span>{label}</span>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-[30ch] text-xs leading-tight"
        side="bottom"
        sideOffset={10}
      >
        {description}
      </TooltipContent>
    </Tooltip>
  )
}

export function SpotPanelHeaderMeta({
  meta,
}: {
  meta: SpotPanelMetaInfo | null
}): React.JSX.Element | null {
  const { userData } = useUser()
  const devModeActive = isDevModeActive(userData)

  if (!meta) return null

  const showDataFlags =
    devModeActive && (meta.terrainData || meta.bathymetryData)

  if (!showDataFlags && !meta.updatedAt) return null

  return (
    <div className="flex flex-1 items-center gap-3 text-xs text-muted-foreground">
      {showDataFlags ? (
        <TooltipProvider>
          <div className="flex shrink-0 items-center gap-3">
            {meta.terrainData ? (
              <DataIndicator
                icon={Mountain}
                label="Terrain"
                description="Terrain data accounts for how surrounding land features affect wind patterns and wave forecasts at this location."
              />
            ) : null}
            {meta.bathymetryData ? (
              <DataIndicator
                icon={Waves}
                label="Bathymetry"
                description="Bathymetry data uses detailed seafloor depth measurements to provide more accurate wave height and break predictions."
              />
            ) : null}
          </div>
        </TooltipProvider>
      ) : null}
      {meta.updatedAt ? (
        <span className="truncate">
          Updated on{' '}
          {new Date(meta.updatedAt).toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </span>
      ) : null}
    </div>
  )
}
