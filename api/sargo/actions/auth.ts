'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { sargoClient } from '../client'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import { CONFIG } from '@/constants/config'
import type { UserAuthResponse } from '../interfaces/user'

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
    const response = await sargoClient.login(identifier, password)

    if (!response?.jwt || !response.user?.username) {
      throw new AppError(
        'Invalid response from server',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      )
    }

    const cookieStore = await cookies()
    const cookieData = {
      jwt: response.jwt,
      user: {
        username: response.user.username,
        email: response.user.email,
        settings: response.user.settings || CONFIG.units.default,
      },
    }
    cookieStore.set(
      CONFIG.api.tokens.sargo.key,
      JSON.stringify(cookieData),
      CONFIG.api.tokens.sargo.options
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
    const cookieData = {
      jwt: response.jwt,
      user: {
        username: response.user.username,
        email: response.user.email,
        settings: response.user.settings || CONFIG.units.default,
      },
    }
    cookieStore.set(
      CONFIG.api.tokens.sargo.key,
      JSON.stringify(cookieData),
      CONFIG.api.tokens.sargo.options
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
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
    if (!userCookie) {
      console.log('isAuthenticated: No cookie found')
      return false
    }

    const parsedToken = JSON.parse(userCookie)
    const hasJwt = !!parsedToken.jwt && typeof parsedToken.jwt === 'string'
    console.log('isAuthenticated:', hasJwt ? 'JWT found' : 'No valid JWT')
    return hasJwt
  } catch (error) {
    console.error('Failed to check user cookie for JWT:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return false
  }
}

export async function getCurrentUser(): Promise<UserAuthResponse | null> {
  try {
    const cookieStore = await cookies()
    const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
    if (!sargoToken) {
      console.log('getCurrentUser: No cookie found')
      return null
    }
    const parsedToken = JSON.parse(sargoToken)
    const hasJwt = !!parsedToken.jwt && typeof parsedToken.jwt === 'string'
    if (!hasJwt) {
      console.log('getCurrentUser: No valid JWT found')
      return null
    }
    console.log('getCurrentUser: JWT found')
    return parsedToken as UserAuthResponse
  } catch (error) {
    console.error('Failed to check user cookie for JWT:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return null
  }
}
