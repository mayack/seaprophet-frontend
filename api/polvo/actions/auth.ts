'use server'

import { cookies } from 'next/headers'
import { CONFIG } from '@/constants/config'
import { polvoClient } from '@/api/polvo/client'

export async function refreshPolvoTokenAction() {
  try {
    console.log('Refreshing Polvo token...')
    const newToken = await polvoClient.getAuthToken()

    if (!newToken) {
      console.error('No token returned from getAuthToken')
      return {
        success: false,
        error: 'Failed to refresh Polvo token: Empty token',
      }
    }

    console.log('Setting new Polvo token in cookie')
    const cookieStore = cookies()
    cookieStore.set({
      name: CONFIG.api.tokens.polvo.key,
      value: newToken,
      ...CONFIG.api.tokens.polvo.options,
    })

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

export async function getPolvoToken(): Promise<string | null> {
  try {
    // Try to get the token from cookies first
    const cookieStore = cookies()
    const token = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value

    // If we have a token, return it
    if (token) {
      return token
    }

    // If no token, try to refresh
    const refreshResult = await refreshPolvoTokenAction()
    if (refreshResult.success && refreshResult.token) {
      return refreshResult.token
    }

    return null
  } catch (error) {
    console.error('Error getting Polvo token:', error)
    return null
  }
}
