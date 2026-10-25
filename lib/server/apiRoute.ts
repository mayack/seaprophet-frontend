import { NextResponse } from 'next/server'

// Shared plumbing for the app's own GET routes (app/api/*). `/api/*` is skipped
// by the edge proxy, so every route checks the session itself — none of them
// may become an anonymous way into Polvo or Sargo (getCurrentUser reads the
// session cookie — no network round-trip in the normal case).

const NO_STORE = 'private, no-store'

/** JSON response; private (per-user) caching for `maxAgeSeconds`, else none. */
export function jsonResponse(
  body: unknown,
  {
    status = 200,
    maxAgeSeconds,
  }: { status?: number; maxAgeSeconds?: number } = {}
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': maxAgeSeconds
        ? `private, max-age=${maxAgeSeconds}`
        : NO_STORE,
    },
  })
}

export function unauthenticatedResponse(): NextResponse {
  return jsonResponse(
    { status: 'unauthenticated', error: 'Not signed in' },
    { status: 401 }
  )
}
