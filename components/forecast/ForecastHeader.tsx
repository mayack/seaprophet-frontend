import React from 'react'

/** Desktop forecast table column headers. */
export function ForecastHeader(): React.JSX.Element {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between bg-background py-2 text-2xs/[1] font-semibold">
      <div className="w-3"></div>
      <div className="w-26">Surf</div>
      <div className="w-19">Primary</div>
      <div className="w-19">Secondary</div>
      <div className="w-19">Wind swell</div>
      <div className="w-18 text-center">Wind</div>
      <div className="w-13">Weather</div>
    </div>
  )
}
