import React from 'react'

export function ForecastHeader(): React.JSX.Element {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between bg-background py-2 text-2xs font-semibold xl:text-xs">
      <div className="w-9">Time</div>
      <div className="w-36 xl:w-40">Surf</div>
      <div className="hidden w-20 sm:block">Primary</div>
      <div className="hidden w-20 sm:block">Secondary</div>
      <div className="hidden w-20 md:block">Wind wave</div>
      <div className="w-20 text-center">Wind</div>
      <div className="w-12 xl:w-16">Weather</div>
    </div>
  )
}
