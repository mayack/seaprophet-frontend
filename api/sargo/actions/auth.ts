'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sargoClient } from '../client'
import { polvoClient } from '@/api/polvo/client'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import { CONFIG } from '@/constants/config'
import type { User, UserAuthResponse } from '../interfaces/user'

export async function signIn(formData: FormData): Promise<never> {
  const identifier = formData.get('identifier')
  const password = formData.get('password')

  // Validate input
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
        'Invalid response from server',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      )
    }

    // Get polvo token
    const polvoToken = await polvoClient.getAuthToken()
    const cookieStore = await cookies()

    // Prepare user options
    const optionsCookieData = {
      username: sargoResponse.user.username,
      email: sargoResponse.user.email,
      settings: sargoResponse.user.settings || CONFIG.units.default,
    }

    // Set cookies synchronously with config-aligned options
    cookieStore.set({
      name: CONFIG.api.tokens.sargo.key,
      value: sargoResponse.jwt,
      path: CONFIG.api.tokens.sargo.options.path,
      secure: CONFIG.api.tokens.sargo.options.secure,
      httpOnly: CONFIG.api.tokens.sargo.options.httpOnly,
      sameSite: CONFIG.api.tokens.sargo.options.sameSite,
      maxAge: CONFIG.api.tokens.sargo.options.maxAge, // 30 days
    })

    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify(optionsCookieData),
      path: CONFIG.api.tokens.sargoOptions.options.path,
      secure: CONFIG.api.tokens.sargoOptions.options.secure,
      httpOnly: CONFIG.api.tokens.sargoOptions.options.httpOnly,
      sameSite: CONFIG.api.tokens.sargoOptions.options.sameSite,
      maxAge: CONFIG.api.tokens.sargoOptions.options.maxAge, // 5 minutes
    })

    cookieStore.set({
      name: CONFIG.api.tokens.polvo.key,
      value: polvoToken,
      path: CONFIG.api.tokens.polvo.options.path,
      secure: CONFIG.api.tokens.polvo.options.secure,
      httpOnly: CONFIG.api.tokens.polvo.options.httpOnly,
      sameSite: CONFIG.api.tokens.polvo.options.sameSite,
      maxAge: CONFIG.api.tokens.polvo.options.maxAge, // 24 hours
    })

    // Debug: Confirm cookies are set
    console.log('SignIn - Cookies set:', {
      sargo: cookieStore.get(CONFIG.api.tokens.sargo.key),
      options: cookieStore.get(CONFIG.api.tokens.sargoOptions.key),
      polvo: cookieStore.get(CONFIG.api.tokens.polvo.key),
    })

    // Redirect to home
    redirect('/')
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error // Let Next.js handle the redirect
    }

    console.error('SignIn Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      identifier,
    })

    throw new AppError(
      error instanceof Error ? error.message : 'Authentication failed',
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED
    )
  }
}

export async function signOut(): Promise<never> {
  try {
    const cookieStore = await cookies()

    // Delete cookies synchronously
    cookieStore.delete(CONFIG.api.tokens.sargo.key)
    cookieStore.delete(CONFIG.api.tokens.sargoOptions.key)
    cookieStore.delete(CONFIG.api.tokens.polvo.key)

    // Debug: Confirm cookies are deleted
    console.log('SignOut - Cookies after deletion:', {
      sargo: cookieStore.get(CONFIG.api.tokens.sargo.key),
      options: cookieStore.get(CONFIG.api.tokens.sargoOptions.key),
      polvo: cookieStore.get(CONFIG.api.tokens.polvo.key),
    })

    // Redirect to sign-in page
    redirect('/auth/signin')
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error // Expected redirect behavior
    }

    console.error('SignOut Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
    })

    throw new Error('Failed to sign out')
  }
}

export async function signUp(formData: FormData): Promise<never> {
  const username = formData.get('username')
  const email = formData.get('email')
  const password = formData.get('password')

  if (
    !username ||
    !email ||
    !password ||
    typeof username !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    throw new AppError(
      'Invalid registration data',
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }

  try {
    const response = await sargoClient.register(username, email, password)
    if (!response?.jwt || !response.user?.username) {
      throw new AppError(
        'Invalid response from server',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      )
    }

    const cookieStore = await cookies()
    const optionsCookieData = {
      username: response.user.username,
      email: response.user.email,
      settings: response.user.settings || CONFIG.units.default,
    }

    cookieStore.set({
      name: CONFIG.api.tokens.sargo.key,
      value: response.jwt,
      path: CONFIG.api.tokens.sargo.options.path,
      secure: CONFIG.api.tokens.sargo.options.secure,
      httpOnly: CONFIG.api.tokens.sargo.options.httpOnly,
      sameSite: CONFIG.api.tokens.sargo.options.sameSite,
      maxAge: CONFIG.api.tokens.sargo.options.maxAge, // 30 days
    })

    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify(optionsCookieData),
      path: CONFIG.api.tokens.sargoOptions.options.path,
      secure: CONFIG.api.tokens.sargoOptions.options.secure,
      httpOnly: CONFIG.api.tokens.sargoOptions.options.httpOnly,
      sameSite: CONFIG.api.tokens.sargoOptions.options.sameSite,
      maxAge: CONFIG.api.tokens.sargoOptions.options.maxAge, // 5 minutes
    })

    redirect('/')
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error
    }
    console.error('SignUp Error:', error)
    throw new AppError(
      error instanceof Error ? error.message : 'Registration failed',
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED
    )
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  return !!jwt && typeof jwt === 'string'
}

async function isTokenExpired(token: string): Promise<boolean> {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000
    return Date.now() >= exp
  } catch (error) {
    console.error('Token decode error:', error)
    return true
  }
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
    console.log('getCurrentUser: No JWT found')
    return fallbackResponse
  }

  if (await isTokenExpired(jwt)) {
    console.log('getCurrentUser: JWT expired')
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
