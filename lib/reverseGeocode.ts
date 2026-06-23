/**
 * Reverse-geocode coordinates to a friendly place name via the Mapbox
 * Geocoding v6 API, reusing the public map token. Best-effort: returns null on
 * any failure so callers can degrade gracefully (store coords without a name).
 */
export async function reverseGeocode(
  longitude: number,
  latitude: number
): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  if (!token) return null

  const url = new URL('https://api.mapbox.com/search/geocode/v6/reverse')
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('latitude', String(latitude))
  // Prefer a town/city-level name; fall back through coarser layers.
  url.searchParams.set('types', 'place,locality,region')
  url.searchParams.set('limit', '1')
  url.searchParams.set('access_token', token)

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = (await res.json()) as {
      features?: Array<{
        properties?: { name?: string; place_formatted?: string }
      }>
    }

    const props = data.features?.[0]?.properties
    return props?.name || props?.place_formatted || null
  } catch {
    return null
  }
}
