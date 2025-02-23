'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { polvoClient } from '@/api/polvo/client'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import { CONFIG } from '@/constants/config'
import type { User, UserAuthResponse } from '../interfaces/user'

export async function signIn(formData: FormData) {
  try {
    const identifier = formData.get('identifier')
    const password = formData.get('password')

    if (!identifier || !password || typeof identifier !== 'string' || typeof password !== 'string') {
      throw new AppError(
        'Invalid credentials',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.BAD_REQUEST
      )
    }

    // Perform login
    const sargoResponse = await sargoClient.login(identifier, password)
    if (!sargoResponse?.jwt || !sargoResponse.user?.username) {
      throw new AppError(
        'Invalid credentials',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      )
    }

    // Get polvo token
    const polvoToken = await polvoClient.getAuthToken()
    const cookieStore = await cookies()

    // Set cookies
    cookieStore.set({
      name: CONFIG.api.tokens.sargo.key,
      value: sargoResponse.jwt,
      ...CONFIG.api.tokens.sargo.options,
    })

    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify({
        username: sargoResponse.user.username,
        email: sargoResponse.user.email,
        settings: sargoResponse.user.settings || CONFIG.units.default,
      }),
      ...CONFIG.api.tokens.sargoOptions.options,
    })

    cookieStore.set({
      name: CONFIG.api.tokens.polvo.key,
      value: polvoToken,
      ...CONFIG.api.tokens.polvo.options,
    })

    return redirect('/')
  } catch (error) {
    console.error('SignIn Error:', error)

    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error
    }

    throw new AppError(
      'Authentication failed. Please check your credentials.',
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED
    )
  }
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies()

  try {
    // Delete all cookies in a specific order
    const cookiesToDelete = [
      CONFIG.api.tokens.polvo.key,
      CONFIG.api.tokens.sargoOptions.key,
      CONFIG.api.tokens.sargo.key,
    ]

    for (const cookieName of cookiesToDelete) {
      // First set to expire
      cookieStore.set({
        name: cookieName,
        value: '',
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      })

      // Then delete
      cookieStore.delete(cookieName)
    }

    // Log remaining cookies for debugging
    const remainingCookies = cookiesToDelete.map(name => ({
      name,
      exists: !!cookieStore.get(name),
    }))
    console.log('SignOut - Cookies status:', remainingCookies)

    // Force revalidation
    revalidatePath('/')

    // Redirect to sign-in
    redirect('/auth/signin')
  } catch (error) {
    console.error('SignOut Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
    })

    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error
    }

    redirect('/auth/signin')
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  return !!jwt && typeof jwt === 'string'
}

export async function getCurrentUser({
  skipOptions = false,
} = {}): Promise<UserAuthResponse> {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  const optionsCookie = skipOptions
    ? null
    : cookieStore.get(CONFIG.api.tokens.sargoOptions.key)?.value

  let userOptions: User = {
    username: '',
    email: '',
    settings: { units: CONFIG.units.default },
  }

  const fallbackResponse = { jwt: '', user: userOptions }

  if (!jwt) {
    return fallbackResponse
  }

  if (optionsCookie) {
    try {
      userOptions = JSON.parse(optionsCookie)
    } catch (error) {
      console.error('Failed to parse options cookie:', error)
    }
  } else {
    try {
      const freshUser = await sargoClient.getCurrentUser()
      if (freshUser) {
        userOptions = {
          username: freshUser.username,
          email: freshUser.email,
          settings: freshUser.settings || CONFIG.units.default,
        }
      }
    } catch (error) {
      console.error('Failed to fetch fresh user data:', error)
      return fallbackResponse
    }
  }

  return { jwt, user: userOptions }
}
