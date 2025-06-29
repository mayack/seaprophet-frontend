'use server'

import { CONFIG } from '@/constants/config'
import { polvoClient } from '@/api/polvo/client'
import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  exp?: number
  iat?: number
  [key: string]: any
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

    console.log(`🔍 Token Debug (${context}):`, {
      issued: decoded.iat
        ? new Date(decoded.iat * 1000).toISOString()
        : 'unknown',
      expires: decoded.exp
        ? new Date(decoded.exp * 1000).toISOString()
        : 'unknown',
      currentTime: new Date(now * 1000).toISOString(),
      isExpired,
      timeToExpiry: `${timeToExpiry} seconds`,
      tokenPreview: token.substring(0, 50) + '...',
    })

    return { isExpired, timeToExpiry }
  } catch (error) {
    console.error(`❌ Failed to decode token (${context}):`, error)
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
      console.log('📦 Using cached Polvo token')
      await debugToken(tokenCache.token, 'CACHED')
      return tokenCache.token
    }

    // If no cached token or expired, fetch a new one
    console.log('🔄 No cached Polvo token found, fetching new token...')
    const newToken = await polvoClient.getAuthToken()

    if (newToken) {
      // Debug the fresh token
      const debugResult = await debugToken(newToken, 'FRESH')

      if (debugResult.isExpired) {
        console.error(
          '🚨 CRITICAL: Polvo API returned an already-expired token!'
        )
        return null
      }

      // Cache in memory
      tokenCache = { token: newToken, timestamp: Date.now() }
      console.log('✅ Fresh token cached successfully')
      return newToken
    }

    return null
  } catch (error) {
    console.error('❌ Error getting Polvo token:', error)
    return null
  }
}

// Simple fetch function that caches the result
export async function fetchPolvoToken(): Promise<string | null> {
  try {
    console.log('🆕 Fetching completely fresh Polvo token (bypass cache)...')
    const newToken = await polvoClient.getAuthToken()

    if (newToken) {
      const debugResult = await debugToken(newToken, 'RETRY_FRESH')

      if (debugResult.isExpired) {
        console.error('🚨 CRITICAL: Fresh retry token is also expired!')
        console.error('🔧 Possible causes:')
        console.error('   - Server clock sync issue')
        console.error('   - Polvo API returning invalid tokens')
        console.error('   - Network delay causing token expiry')
        return null
      }

      // Cache the new token
      tokenCache = { token: newToken, timestamp: Date.now() }
      console.log('✅ Retry token cached successfully')
      return newToken
    }

    return null
  } catch (error) {
    console.error('❌ Failed to fetch fresh Polvo token:', error)
    return null
  }
}

// Clear the token cache (for when tokens expire)
export async function clearPolvoTokenCache() {
  console.log('🗑️ Clearing expired Polvo token cache...')
  if (tokenCache) {
    const age = Math.floor((Date.now() - tokenCache.timestamp) / 1000)
    console.log(`📊 Cached token was ${age} seconds old`)
  }
  tokenCache = null
}

// Server action for manual refresh (mainly for debugging/admin purposes)
export async function refreshPolvoTokenAction() {
  try {
    console.log('🔄 Manually refreshing Polvo token...')

    // Clear existing cache first
    await clearPolvoTokenCache()

    // Fetch new token (which will cache it)
    const newToken = await fetchPolvoToken()

    if (!newToken) {
      console.error('No token returned from fetchPolvoToken')
      return {
        success: false,
        error: 'Failed to refresh Polvo token: Empty token',
      }
    }

    return { success: true, token: newToken }
  } catch (error) {
    console.error('Polvo token refresh failed:', error)
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
