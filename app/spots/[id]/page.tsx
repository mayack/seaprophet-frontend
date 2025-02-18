import { getCurrentUser } from '@/api/sargo/actions/user'
import { getSpotWithForecast } from '@/api/polvo/actions/forecast'
import { UserProvider } from '@/contexts/UserContext'
import { DEFAULT_UNITS } from '@/constants/units'
import SpotContent from '@/components/spots/SpotContent'
import { ForecastResponse } from '@/api/polvo/interfaces/forecast'

export default async function SpotPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const units = user?.settings?.units || DEFAULT_UNITS
  const response = await getSpotWithForecast(parseInt(params.id), units)

  const forecast: ForecastResponse | null = response.forecast
    ? {
        days: response.forecast.days,
        tidalDatum: 'MSL',
      }
    : null

  return (
    <div className="py-12 w-full">
      <UserProvider initialUser={user}>
        <SpotContent
          spot={response.spot ?? null}
          forecast={forecast}
          error={response.error ?? undefined}
        />
      </UserProvider>
    </div>
  )
}
