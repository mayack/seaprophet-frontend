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
  const identifier = formData.get('identifier')
  const password = formData.get('password')

  if (
    !identifier ||
    !password ||
    typeof identifier !== 'string' ||
    typeof password !== 'string'
  ) {
    throw new AppError(
      'Invalid credentials',
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      HTTP_STATUS.BAD_REQUEST
    )
  }

  try {
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
      path: CONFIG.api.tokens.sargo.options.path,
      secure: CONFIG.api.tokens.sargo.options.secure,
      httpOnly: CONFIG.api.tokens.sargo.options.httpOnly,
      sameSite: CONFIG.api.tokens.sargo.options.sameSite,
      maxAge: CONFIG.api.tokens.sargo.options.maxAge,
    })

    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify({
        username: sargoResponse.user.username,
        email: sargoResponse.user.email,
        settings: sargoResponse.user.settings || CONFIG.units.default,
      }),
      path: CONFIG.api.tokens.sargoOptions.options.path,
      secure: CONFIG.api.tokens.sargoOptions.options.secure,
      httpOnly: CONFIG.api.tokens.sargoOptions.options.httpOnly,
      sameSite: CONFIG.api.tokens.sargoOptions.options.sameSite,
      maxAge: CONFIG.api.tokens.sargoOptions.options.maxAge,
    })

    cookieStore.set({
      name: CONFIG.api.tokens.polvo.key,
      value: polvoToken,
      path: CONFIG.api.tokens.polvo.options.path,
      secure: CONFIG.api.tokens.polvo.options.secure,
      httpOnly: CONFIG.api.tokens.polvo.options.httpOnly,
      sameSite: CONFIG.api.tokens.polvo.options.sameSite,
      maxAge: CONFIG.api.tokens.polvo.options.maxAge,
    })

    redirect('/')
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error // Let Next.js handle the redirect
    }

    console.error('SignIn Error:', error)
    throw new AppError(
      'Authentication failed',
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED
    )
  }
}

export async function signOut() {
  const cookieStore = await cookies()

  try {
    // Delete all cookies in a specific order
    const cookiesToDelete = [
      CONFIG.api.tokens.polvo.key,
      CONFIG.api.tokens.sargoOptions.key,
      CONFIG.api.tokens.sargo.key,
    ]

    for (const cookieName of cookiesToDelete) {
      cookieStore.set({
        name: cookieName,
        value: '',
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      })
      cookieStore.delete(cookieName)
    }

    // Log remaining cookies for debugging
    const remainingCookies = cookiesToDelete.map((name) => ({
      name,
      exists: !!cookieStore.get(name),
    }))
    console.log('SignOut - Cookies status:', remainingCookies)

    revalidatePath('/')
    redirect('/auth/signin')
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error // Let Next.js handle the redirect
    }

    console.error('SignOut Error:', error)
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
    }
  }

  return { jwt, user: userOptions }
}
