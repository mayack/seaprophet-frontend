'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import { CONFIG } from '@/constants/config'
import type { UserAuthResponse, UserUnits } from '../interfaces/user'

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
    console.log(response, 'sign in response')

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

export async function updateSettings(formData: FormData): Promise<never> {
  try {
    const username = formData.get('username') as string
    if (!username)
      throw new AppError(
        'Username is required',
        ErrorCode.INVALID_PARAMETERS,
        HTTP_STATUS.BAD_REQUEST
      )

    const units: UserUnits = {
      wind_speed: formData.get('units.wind_speed') as UserUnits['wind_speed'],
      surf_height: formData.get(
        'units.surf_height'
      ) as UserUnits['surf_height'],
      swell_height: formData.get(
        'units.swell_height'
      ) as UserUnits['swell_height'],
      tide_height: formData.get(
        'units.tide_height'
      ) as UserUnits['tide_height'],
      temperature: formData.get(
        'units.temperature'
      ) as UserUnits['temperature'],
    }

    // Update user profile on the server
    await sargoClient.updateUserProfile({ username, settings: { units } })

    // Update the cookie with the new settings
    const cookieStore = await cookies()
    const sargoToken = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
    if (!sargoToken) {
      throw new AppError(
        'Authentication token not found',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      )
    }

    const parsedToken = JSON.parse(sargoToken)
    const updatedCookieData = {
      jwt: parsedToken.jwt,
      user: {
        ...parsedToken.user,
        username,
        settings: { units }, // Nest settings under user
      },
    }
    cookieStore.set(
      CONFIG.api.tokens.sargo.key,
      JSON.stringify(updatedCookieData),
      CONFIG.api.tokens.sargo.options
    )

    // Handle password change if provided
    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new AppError(
          'All password fields are required',
          ErrorCode.INVALID_PARAMETERS,
          HTTP_STATUS.BAD_REQUEST
        )
      }
      if (newPassword !== confirmPassword) {
        throw new AppError(
          'New passwords do not match',
          ErrorCode.INVALID_PARAMETERS,
          HTTP_STATUS.BAD_REQUEST
        )
      }
      await sargoClient.changePassword({
        currentPassword,
        password: newPassword,
        passwordConfirmation: confirmPassword,
      })
    }

    // Invalidate cache for /settings
    revalidatePath('/settings')
    redirect('/settings?success=true')
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error // Let redirect proceed
    }
    console.error('Update settings error:', error)
    throw error instanceof Error
      ? error
      : new Error('Failed to update settings')
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

// let authRetryCount = 0

// export async function getCurrentUser(): Promise<UserUnits | null> {
//   try {
//     if (authRetryCount >= CONFIG.auth.maxRetries) {
//       throw new AppError(
//         'Authentication failed after multiple attempts',
//         ErrorCode.AUTH_MAX_RETRIES,
//         HTTP_STATUS.UNAUTHORIZED
//       )
//     }

//     const cookieStore = await cookies()
//     const token = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
//     if (!token) return null

//     authRetryCount++ // Increment retry counter
//     const user = await sargoClient.getCurrentUser()

//     if (user) {
//       authRetryCount = 0 // Reset counter on success
//       return user
//     }

//     return null
//   } catch (error) {
//     console.error('getCurrentUser error:', error)

//     if (error instanceof AppError && error.status === HTTP_STATUS.UNAUTHORIZED) {
//       const cookieStore = await cookies()
//       cookieStore.delete(CONFIG.api.tokens.sargo.key)
//     }

//     // Let error boundary handle max retries error
//     if (error instanceof AppError && error.code === ErrorCode.AUTH_MAX_RETRIES) {
//       throw error
//     }

//     return null
//   }
// }
