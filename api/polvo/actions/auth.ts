'use server'

import { cookies } from 'next/headers'
import { CONFIG } from '@/constants/config'
import { polvoClient } from '@/api/polvo/client'

export async function refreshPolvoTokenAction() {
  const cookieStore = await cookies()
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
