// Edge-safe JWT helpers. Only depends on `jwt-decode` (no Node APIs), so it's
// importable from middleware/edge as well as server actions.
//
// NOTE: these do NOT verify the signature — we don't hold the signing secret
// on the frontend. They only read claims to cheaply reject expired/garbage
// tokens; the real auth gate is the authenticated API call.
import { jwtDecode } from 'jwt-decode'

interface JwtClaims {
  exp?: number
  [key: string]: unknown
}

export function decodeJwt(token: string): JwtClaims | null {
  try {
    return jwtDecode<JwtClaims>(token)
  } catch {
    return null
  }
}

/** True if the token is unparseable, has no `exp`, or `exp` is in the past. */
export function isJwtExpired(token: string): boolean {
  const claims = decodeJwt(token)
  if (!claims || claims.exp === undefined) return true
  return claims.exp <= Math.floor(Date.now() / 1000)
}

/** Cheap structural check: three base64url segments. No signature check. */
export function hasJwtShape(token: string): boolean {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  return parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))
}
