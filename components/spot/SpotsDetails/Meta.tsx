'use client'

import { Mountain, Waves } from 'lucide-react'
import React, { useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SpotsDetailsMetaProps {
  terrainData?: boolean
  bathymetryData?: boolean
  updatedAt?: string
}

export function SpotsDetailsMeta({
  terrainData,
  bathymetryData,
  updatedAt,
}: SpotsDetailsMetaProps): React.JSX.Element | null {
  const [terrainTooltipOpen, setTerrainTooltipOpen] = useState(false)
  const [bathymetryTooltipOpen, setBathymetryTooltipOpen] = useState(false)

  if (!updatedAt && !terrainData && !bathymetryData) return null

  return (
    <div className="wrapper mt-4 flex items-center gap-4">
      {updatedAt && (
        <div className="flex flex-1 flex-col gap-x-1 text-xs text-muted-foreground xs:flex-row xs:items-center">
          <span>Updated on:</span>
          <span>
            {new Date(updatedAt).toLocaleString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
      )}
      <div className="flex gap-x-4">
        <TooltipProvider>
          {terrainData && (
            <Tooltip
              open={terrainTooltipOpen}
              onOpenChange={setTerrainTooltipOpen}
            >
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setTerrainTooltipOpen(!terrainTooltipOpen)}
                  className="flex cursor-help items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mountain className="size-3" />
                  <span>Terrain</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                className="max-w-[30ch] text-xs leading-tight"
                sideOffset={10}
                side="bottom"
              >
                Terrain data accounts for how surrounding land features affect
                wind patterns and wave forecasts at this location.
              </TooltipContent>
            </Tooltip>
          )}
          {bathymetryData && (
            <Tooltip
              open={bathymetryTooltipOpen}
              onOpenChange={setBathymetryTooltipOpen}
            >
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    setBathymetryTooltipOpen(!bathymetryTooltipOpen)
                  }
                  className="flex cursor-help items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Waves className="size-3" />
                  <span>Bathymetry</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                className="max-w-[30ch] text-xs leading-tight"
                sideOffset={10}
                side="bottom"
              >
                Bathymetry data uses detailed seafloor depth measurements to
                provide more accurate wave height and break predictions.
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  )
}
