import React from 'react'

export function ForecastHeader(): React.JSX.Element {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between bg-background py-2 text-2xs font-semibold md:text-xs">
      <div className="w-8 md:w-9">Time</div>
      <div className="w-28 md:w-26">Surf</div>
      <div className="hidden w-20 md:block">Primary</div>
      <div className="hidden w-20 md:block">Secondary</div>
      <div className="hidden w-20 lg:block">Wind wave</div>
      <div className="w-20 text-center">Wind</div>
      <div className="w-12 md:w-16">Weather</div>
    </div>
  )
}
