export function ForecastHeader() {
  return (
    <div className="sticky top-0 z-20 grid flex-1 grid-cols-32 bg-background py-2 text-xs font-semibold">
      <div className="col-span-3">Time</div>
      <div className="col-span-6">Surf</div>
      <div className="col-span-5">Primary swell</div>
      <div className="col-span-5">Secondary swell</div>
      <div className="col-span-5">Wind wave</div>
      <div className="col-span-5">Wind</div>
      <div className="col-span-3">Weather</div>
    </div>
  )
}
