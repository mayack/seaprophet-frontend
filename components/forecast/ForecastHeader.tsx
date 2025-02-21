export function ForecastHeader() {
  return (
    <div className="sticky top-0 z-20 grid aspect-[3/1] flex-1 bg-background py-2 text-xs font-semibold">
      <div className="col-span-3">Time</div>
      <div className="col-span-6">Surf</div>
      <div className="col-span-5">Primary Swell</div>
      <div className="col-span-5">Secondary Swell</div>
      <div className="col-span-5">Wind Wave</div>
      <div className="col-span-5">Wind</div>
      <div className="col-span-3">Weather</div>
    </div>
  )
}
