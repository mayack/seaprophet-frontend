'use client'

import { useEffect } from 'react'
import { Mountain, Waves } from 'lucide-react'
import { useSpotPanel } from '@/contexts/SpotPanelContext'
import { useUser } from '@/contexts/UserContext'
import { isDevModeActive } from '@/lib/userSettings'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SpotPanelMetaSyncProps {
  terrainData?: boolean
  bathymetryData?: boolean
  updatedAt?: string
}

/** Syncs forecast meta from the panel body into context for the header. */
export function SpotPanelMetaSync({
  terrainData,
  bathymetryData,
  updatedAt,
}: SpotPanelMetaSyncProps): null {
  const { setPanelMeta } = useSpotPanel()

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPanelMeta({
        updatedAt: updatedAt ?? null,
        terrainData: terrainData === true,
        bathymetryData: bathymetryData === true,
      })
    })
    return (): void => cancelAnimationFrame(raf)
  }, [setPanelMeta, updatedAt, terrainData, bathymetryData])

  return null
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

export function SpotPanelHeaderMeta(): React.JSX.Element | null {
  const { panelMeta } = useSpotPanel()
  const { userData } = useUser()
  const devModeActive = isDevModeActive(userData)

  const showDataFlags =
    devModeActive && (panelMeta.terrainData || panelMeta.bathymetryData)

  if (!showDataFlags && !panelMeta.updatedAt) return null

  return (
    <div className="flex flex-1 items-center gap-3 text-xs text-muted-foreground">
      {showDataFlags ? (
        <TooltipProvider>
          <div className="flex shrink-0 items-center gap-3">
            {panelMeta.terrainData ? (
              <DataIndicator
                icon={Mountain}
                label="Terrain"
                description="Terrain data accounts for how surrounding land features affect wind patterns and wave forecasts at this location."
              />
            ) : null}
            {panelMeta.bathymetryData ? (
              <DataIndicator
                icon={Waves}
                label="Bathymetry"
                description="Bathymetry data uses detailed seafloor depth measurements to provide more accurate wave height and break predictions."
              />
            ) : null}
          </div>
        </TooltipProvider>
      ) : null}
      {panelMeta.updatedAt ? (
        <span className="truncate">
          Updated on{' '}
          {new Date(panelMeta.updatedAt).toLocaleString('en-GB', {
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
