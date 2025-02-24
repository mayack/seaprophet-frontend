'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import { CONFIG } from '@/constants/config'
import type { User } from '../interfaces/user'

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
    const sargoResponse = await sargoClient.login(identifier, password)
    if (!sargoResponse?.jwt || !sargoResponse.user?.username) {
      throw new AppError(
        'Invalid credentials',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      )
    }

    const cookieStore = await cookies()

    // Set sargo JWT cookie
    cookieStore.set({
      name: CONFIG.api.tokens.sargo.key,
      value: sargoResponse.jwt,
      path: CONFIG.api.tokens.sargo.options.path,
      secure: CONFIG.api.tokens.sargo.options.secure,
      httpOnly: CONFIG.api.tokens.sargo.options.httpOnly,
      sameSite: CONFIG.api.tokens.sargo.options.sameSite,
      maxAge: CONFIG.api.tokens.sargo.options.maxAge,
    })

    // Set user settings cookie
    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify({
        username: sargoResponse.user.username,
        email: sargoResponse.user.email,
        settings: sargoResponse.user.settings,
      }),
      path: CONFIG.api.tokens.sargoOptions.options.path,
      secure: CONFIG.api.tokens.sargoOptions.options.secure,
      httpOnly: CONFIG.api.tokens.sargoOptions.options.httpOnly,
      sameSite: CONFIG.api.tokens.sargoOptions.options.sameSite,
      maxAge: CONFIG.api.tokens.sargoOptions.options.maxAge,
    })

    redirect('/')
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error
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
    // Delete all relevant cookies
    const cookiesToDelete = [
      CONFIG.api.tokens.polvo.key,
      CONFIG.api.tokens.sargo.key,
      CONFIG.api.tokens.sargoOptions.key,
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

    // Log remaining cookies for debugging (optional)
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

export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  const optionsCookie = cookieStore.get(
    CONFIG.api.tokens.sargoOptions.key
  )?.value

  // Default user object if no data is available
  const defaultUser: User = {
    username: '',
    email: '',
    settings: { units: CONFIG.units.default },
  }

  if (!jwt) {
    console.log('No JWT found, returning default user')
    return defaultUser
  }

  if (optionsCookie) {
    try {
      const userOptions = JSON.parse(optionsCookie) as User
      console.log('User options extracted from cookie:', userOptions)
      return {
        username: userOptions.username || '',
        email: userOptions.email || '',
        settings: userOptions.settings || { units: CONFIG.units.default },
      }
    } catch (error) {
      console.error('Failed to parse sargoOptions cookie:', error)
    }
  }

  // Fetch fresh user data if no valid cookie
  try {
    const freshUser = await sargoClient.getCurrentUser()
    if (freshUser) {
      console.log('Fresh user data fetched:', freshUser)
      return {
        username: freshUser.username || '',
        email: freshUser.email || '',
        settings: freshUser.settings || { units: CONFIG.units.default },
      }
    }
    console.log('Fresh user data was null, returning default')
    return defaultUser
  } catch (error) {
    console.error('Failed to fetch fresh user data:', error)
    return defaultUser
  }
}
