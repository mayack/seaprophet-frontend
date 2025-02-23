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
        'Invalid response from server',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      )
    }

    const polvoToken = await polvoClient.getAuthToken()
    const cookieStore = await cookies()
    const optionsCookieData = {
      username: sargoResponse.user.username,
      email: sargoResponse.user.email,
      settings: sargoResponse.user.settings || CONFIG.units.default,
    }
    cookieStore.set(
      CONFIG.api.tokens.sargo.key,
      sargoResponse.jwt,
      CONFIG.api.tokens.sargo.options
    )
    cookieStore.set(
      CONFIG.api.tokens.sargoOptions.key,
      JSON.stringify(optionsCookieData),
      CONFIG.api.tokens.sargoOptions.options
    )
    cookieStore.set(
      CONFIG.api.tokens.polvo.key,
      polvoToken,
      CONFIG.api.tokens.polvo.options
    )

    redirect('/')
  } catch (error) {
    console.error('Sign in error:', error)
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error
    throw new AppError(
      error instanceof Error ? error.message : 'Authentication failed',
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED
    )
  }
}

export async function signOut(): Promise<never> {
  const cookieStore = await cookies()
  cookieStore.delete(CONFIG.api.tokens.sargo.key)
  cookieStore.delete(CONFIG.api.tokens.sargoOptions.key)
  cookieStore.delete(CONFIG.api.tokens.polvo.key)
  redirect('/auth/signin')
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
    cookieStore.set(
      CONFIG.api.tokens.sargo.key,
      response.jwt,
      CONFIG.api.tokens.sargo.options
    )
    cookieStore.set(
      CONFIG.api.tokens.sargoOptions.key,
      JSON.stringify(optionsCookieData),
      CONFIG.api.tokens.sargoOptions.options
    )

    redirect('/')
  } catch (error) {
    console.error('Sign up error:', error)
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
