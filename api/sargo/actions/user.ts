'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '@/api/sargo/client'
import { CONFIG } from '@/constants/config'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import type { UserUnits } from '@/api/sargo/interfaces/user'

export async function updateUsername(formData: FormData) {
  const username = formData.get('username')
  if (!username || typeof username !== 'string') {
    throw new AppError(
      'Username is required',
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }

  try {
    await sargoClient.updateUserProfile({ username })

    // Update the cookie with the new username
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
      },
    }
    cookieStore.set(
      CONFIG.api.tokens.sargo.key,
      JSON.stringify(updatedCookieData),
      CONFIG.api.tokens.sargo.options
    )

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError(
          'Failed to update username',
          ErrorCode.UNKNOWN_ERROR,
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        )
  }
}

export async function updatePassword(formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

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

  try {
    await sargoClient.changePassword({
      currentPassword,
      password: newPassword,
      passwordConfirmation: confirmPassword,
    })
    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError(
          'Failed to update password',
          ErrorCode.UNKNOWN_ERROR,
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        )
  }
}

export async function updateUnits(formData: FormData) {
  try {
    // Get current user data from cookie
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
    const currentUsername = parsedToken.user.username

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
    await sargoClient.updateUserProfile({
      username: currentUsername,
      settings: { units },
    })

    // Update the cookie with the new settings
    const updatedCookieData = {
      jwt: parsedToken.jwt,
      user: {
        ...parsedToken.user,
        settings: { units },
      },
    }
    cookieStore.set(
      CONFIG.api.tokens.sargo.key,
      JSON.stringify(updatedCookieData),
      CONFIG.api.tokens.sargo.options
    )

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    throw error instanceof AppError
      ? error
      : new AppError(
          'Failed to update settings',
          ErrorCode.UNKNOWN_ERROR,
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        )
  }
}
