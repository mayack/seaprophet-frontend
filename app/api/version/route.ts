/**
 * Tiny build-identity probe for stale-tab detection (see BuildRefreshGuard).
 * Returns the build id baked into the SERVER bundle; a client whose own baked
 * id differs is running a previous deployment and should reload.
 */
export const dynamic = 'force-dynamic'

export function GET(): Response {
  return Response.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? null },
    // no-store on the response too, so Netlify's CDN never serves a cached
    // build id from an older deployment — that would defeat the whole check.
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
