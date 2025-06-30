'use server'

import { CONFIG } from '@/constants/config'
import { polvoClient } from '@/api/polvo/client'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  exp?: number
  iat?: number
  [key: string]: unknown
}

// In-memory cache for the current server session
let tokenCache: { token: string; timestamp: number } | null = null

// Convert seconds to milliseconds for comparison
const TOKEN_CACHE_DURATION = CONFIG.api.tokens.polvo.cacheDuration * 1000 // 15 minutes in ms

// Debug function to inspect tokens
async function debugToken(token: string, context: string) {
  try {
    const decoded = jwtDecode<TokenPayload>(token)
    const now = Math.floor(Date.now() / 1000)
    const isExpired = decoded.exp ? decoded.exp < now : false
    const timeToExpiry = decoded.exp ? decoded.exp - now : 0

    return { isExpired, timeToExpiry }
  } catch (error) {
    return { isExpired: true, timeToExpiry: 0 }
  }
}

export async function getPolvoToken(): Promise<string | null> {
  try {
    // Check in-memory cache first
    if (
      tokenCache &&
      Date.now() - tokenCache.timestamp < TOKEN_CACHE_DURATION
    ) {
      await debugToken(tokenCache.token, 'CACHED')
      return tokenCache.token
    }

    // If no cached token or expired, fetch a new one
    const newToken = await polvoClient.getAuthToken()

    if (newToken) {
      // Debug the fresh token
      const debugResult = await debugToken(newToken, 'FRESH')

      if (debugResult.isExpired) {
        return null
      }

      // Cache in memory
      tokenCache = { token: newToken, timestamp: Date.now() }
      return newToken
    }

    return null
  } catch (error) {
    return null
  }
}

// Simple fetch function that caches the result
export async function fetchPolvoToken(): Promise<string | null> {
  try {
    const newToken = await polvoClient.getAuthToken()

    if (newToken) {
      const debugResult = await debugToken(newToken, 'RETRY_FRESH')

      if (debugResult.isExpired) {
        return null
      }

      // Cache the new token
      tokenCache = { token: newToken, timestamp: Date.now() }
      return newToken
    }

    return null
  } catch (error) {
    return null
  }
}

// Clear the token cache (for when tokens expire)
export async function clearPolvoTokenCache() {
  tokenCache = null
}

// Server action for manual refresh (mainly for debugging/admin purposes)
export async function refreshPolvoTokenAction() {
  try {
    // Clear existing cache first
    await clearPolvoTokenCache()

    // Fetch new token (which will cache it)
    const newToken = await fetchPolvoToken()

    if (!newToken) {
      return {
        success: false,
        error: 'Failed to refresh Polvo token: Empty token',
      }
    }

    return { success: true, token: newToken }
  } catch (error) {
    return {
      success: false,
      error:
        'Failed to refresh Polvo token: ' +
        (error instanceof Error ? error.message : 'Unknown error'),
    }
  }
}

// Utility function to check cache status (for debugging)
export async function getPolvoTokenCacheStatus() {
  if (!tokenCache) {
    return { cached: false, age: 0, timeRemaining: 0 }
  }

  const age = Date.now() - tokenCache.timestamp
  const timeRemaining = TOKEN_CACHE_DURATION - age

  return {
    cached: timeRemaining > 0,
    age: Math.floor(age / 1000), // in seconds
    timeRemaining: Math.floor(Math.max(0, timeRemaining) / 1000), // in seconds
  }
}
