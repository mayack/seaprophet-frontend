'use server'

import { CONFIG } from '@/constants/config'
import { polvoClient } from '@/api/polvo/client'
import { isJwtExpired } from '@/lib/jwt'

// In-memory cache for the current server instance.
let tokenCache: { token: string; timestamp: number } | null = null
// In-flight fetch shared across concurrent callers to avoid a thundering herd.
let pending: Promise<string | null> | null = null

const TOKEN_CACHE_DURATION = CONFIG.api.tokens.polvo.cacheDuration * 1000

async function obtainToken(bypassCache: boolean): Promise<string | null> {
  // Honor both the time-based cache window AND the token's own expiry — a JWT
  // can expire inside the cache window, which previously slipped through.
  if (
    !bypassCache &&
    tokenCache &&
    Date.now() - tokenCache.timestamp < TOKEN_CACHE_DURATION &&
    !isJwtExpired(tokenCache.token)
  ) {
    return tokenCache.token
  }

  if (pending) return pending

  pending = (async () => {
    try {
      const token = await polvoClient.getAuthToken()
      if (!token || isJwtExpired(token)) {
        tokenCache = null
        return null
      }
      tokenCache = { token, timestamp: Date.now() }
      return token
    } catch {
      return null
    } finally {
      pending = null
    }
  })()

  return pending
}

/** Cached Polvo token, refetched when stale or expired. */
export async function getPolvoToken(): Promise<string | null> {
  return obtainToken(false)
}

/** Force a fresh token (used after an auth failure). */
export async function fetchPolvoToken(): Promise<string | null> {
  return obtainToken(true)
}

/** Clear the cache so the next request fetches a fresh token. */
export async function clearPolvoTokenCache(): Promise<void> {
  tokenCache = null
}
