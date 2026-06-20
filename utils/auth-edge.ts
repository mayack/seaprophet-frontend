// Edge-runtime-safe auth helpers. This module must not import anything
// from `next/headers`, the Sargo/Polvo API clients, or anything else that
// pulls Node-only APIs. The proxy runs on the Edge runtime and
// importing Node-only code from here would pollute the edge bundle and
// can fail the build.

import { NextRequest, NextResponse } from 'next/server'
import { hasJwtShape, isJwtExpired } from '@/lib/jwt'
import { CONFIG } from '@/constants/config'

/**
 * Structural validity check for the Sargo JWT.
 *
 * IMPORTANT: This does NOT verify the JWT signature. We don't have the
 * Sargo HS256 secret exposed to the frontend (no JWT_SECRET in
 * .env.local), so we cannot cryptographically verify tokens at the edge.
 *
 * The real authentication gate is the authenticated `/users/me` call
 * performed by server components / server actions (see
 * `api/sargo/actions/auth.ts#getCurrentUser`). This function exists only
 * to cheaply weed out obviously bogus / expired tokens before letting a
 * request reach the app, so the proxy can short-circuit redirect
 * unauthenticated traffic to the signin page.
 *
 * Do NOT treat a `true` return from this function as proof of identity.
 */
export function isTokenStructurallyValid(token: string): boolean {
  return hasJwtShape(token) && !isJwtExpired(token)
}

// Resolve a `/auth/signin` redirect target that works in every env we
// deploy to (prod, preview, localhost) without hardcoding any specific
// hostname. Order of preference:
//   1. The incoming request URL — the proxy always has this and it
//      naturally matches the user's current origin.
//   2. `NEXT_PUBLIC_BASE_URL` — env-configured public base URL. We don't
//      currently declare it in `types/env.d.ts`, but if ops sets it we
//      use it as a fallback when the request URL is unparsable.
//   3. `request.nextUrl.origin` — NextRequest exposes this even when the
//      raw URL string is malformed; safe last-ditch absolute origin.
function resolveSigninRedirect(request: NextRequest): URL | string {
  try {
    return new URL('/auth/signin', request.url)
  } catch (urlError) {
    console.error('Error creating redirect URL from request.url:', urlError)
  }

  const envBase = process.env.NEXT_PUBLIC_BASE_URL
  if (envBase) {
    try {
      return new URL('/auth/signin', envBase)
    } catch (envUrlError) {
      console.error(
        'Error creating redirect URL from NEXT_PUBLIC_BASE_URL:',
        envUrlError
      )
    }
  }

  try {
    return new URL('/auth/signin', request.nextUrl.origin)
  } catch (nextUrlError) {
    console.error(
      'Error creating redirect URL from request.nextUrl.origin:',
      nextUrlError
    )
  }

  // Pure relative path — NextResponse.redirect may reject this in some
  // runtimes, but it's strictly better than the previous behaviour of
  // pointing at literal localhost in production.
  return '/auth/signin'
}

export function clearTokensAndRedirect(request: NextRequest): NextResponse {
  try {
    const redirectUrl = resolveSigninRedirect(request)
    const response = NextResponse.redirect(redirectUrl)

    const tokensToDelete = [
      CONFIG.api.tokens.sargo.key,
      CONFIG.api.tokens.sargoOptions.key,
    ]

    for (const tokenName of tokensToDelete) {
      try {
        // Clear by writing an already-expired cookie with the SAME attributes
        // used at write time — an attribute mismatch leaves a phantom cookie
        // (Safari especially). A bare `cookies.delete(name)` uses default
        // attributes and isn't reliable here, so this single set replaces it.
        response.cookies.set({
          name: tokenName,
          value: '',
          path: '/',
          expires: new Date(0),
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        })
      } catch (cookieError) {
        console.error(`Error clearing cookie ${tokenName}:`, cookieError)
      }
    }

    return response
  } catch (error) {
    console.error('Critical error in clearTokensAndRedirect:', error)
    // Last-resort redirect — re-use the same resolver so we never fall
    // through to a hardcoded localhost URL.
    return NextResponse.redirect(resolveSigninRedirect(request))
  }
}
