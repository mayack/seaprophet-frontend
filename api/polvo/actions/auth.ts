'use server'

import { cookies } from 'next/headers'
import { CONFIG } from '@/constants/config'
import { polvoClient } from '@/api/polvo/client'

export async function refreshPolvoTokenAction() {
  const cookieStore = await cookies()
  try {
    const newToken = await polvoClient.getAuthToken()
    cookieStore.set({
      name: CONFIG.api.tokens.polvo.key,
      value: newToken,
      ...CONFIG.api.tokens.polvo.options,
    })
    return { success: true, token: newToken }
  } catch (error) {
    console.error('Polvo token refresh failed:', error)
    return { success: false, error: 'Failed to refresh Polvo token' }
  }
}
