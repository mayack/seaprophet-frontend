export function ForecastHeader() {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between bg-background py-2 text-2xs font-semibold xl:text-xs">
      <div className="w-9">Time</div>
      <div className="w-26 xl:w-32">Surf</div>
      <div className="hidden w-20 sm:block xl:w-24">Primary</div>
      <div className="hidden w-20 sm:block xl:w-24">Secondary</div>
      <div className="hidden w-20 md:block xl:w-24">Wind wave</div>
      <div className="w-24 text-center">Wind</div>
      <div className="w-16">Weather</div>
    </div>
  )
}
