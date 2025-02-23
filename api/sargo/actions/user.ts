'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '@/api/sargo/client'
import { CONFIG } from '@/constants/config'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import type { UserUnits } from '../interfaces/user'

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

    const cookieStore = await cookies()
    const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
    if (!jwt) {
      throw new AppError(
        'Authentication token not found',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        HTTP_STATUS.UNAUTHORIZED
      )
    }

    const optionsCookie = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value
    const parsedOptions = optionsCookie
      ? JSON.parse(optionsCookie)
      : { username: '', email: '', settings: CONFIG.units.default }
    const updatedCookieData = {
      username,
      email: parsedOptions.email,
      settings: parsedOptions.settings,
    }
    cookieStore.set(
      CONFIG.api.tokens.sargoOptions.key,
      JSON.stringify(updatedCookieData),
      CONFIG.api.tokens.sargoOptions.options
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
  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  if (!jwt) {
    throw new AppError(
      'Unauthorized',
      ErrorCode.AUTH_UNAUTHORIZED,
      HTTP_STATUS.UNAUTHORIZED
    )
  }

  const units = {
    wind_speed: formData.get('units.wind_speed') as string,
    surf_height: formData.get('units.surf_height') as string,
    swell_height: formData.get('units.swell_height') as string,
    tide_height: formData.get('units.tide_height') as string,
    temperature: formData.get('units.temperature') as string,
  } as UserUnits

  try {
    await sargoClient.updateUserProfile({ settings: { units } })

    const optionsCookie = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value
    const parsedOptions = optionsCookie
      ? JSON.parse(optionsCookie)
      : { username: '', email: '', settings: CONFIG.units.default }
    const updatedCookieData = {
      username: parsedOptions.username,
      email: parsedOptions.email,
      settings: { units },
    }
    cookieStore.set(
      CONFIG.api.tokens.sargoOptions.key,
      JSON.stringify(updatedCookieData),
      CONFIG.api.tokens.sargoOptions.options
    )

    revalidatePath('/settings')
    return { success: true, units }
  } catch (error) {
    console.error('Update units error:', error)
    throw new AppError(
      error instanceof Error ? error.message : 'Failed to update units',
      ErrorCode.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
  }
}
