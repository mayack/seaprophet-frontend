'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '@/api/sargo/client'
import { CONFIG } from '@/constants/config'
import { AppError, ErrorCode, HTTP_STATUS } from '@/utils/error'
import type { UserUnits, UserSettings } from '../interfaces/user'

export async function updateUsername(formData: FormData) {
  const username = formData.get('username')
  if (!username || typeof username !== 'string') {
    throw new AppError(
      'Username is required',
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }

  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  if (!jwt) {
    throw new AppError(
      'Authentication token not found',
      ErrorCode.AUTH_UNAUTHORIZED,
      HTTP_STATUS.UNAUTHORIZED
    )
  }

  try {
    await sargoClient.updateUserProfile({ username })

    const optionsCookie = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value
    const parsedOptions = optionsCookie
      ? JSON.parse(optionsCookie)
      : { username: '', email: '', settings: CONFIG.settings.default }

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

function isWindSpeedUnit(value: unknown): value is UserUnits['wind_speed'] {
  return ['knots', 'mph', 'kph', 'mps'].includes(value as string)
}

function isHeightUnit(value: unknown): value is UserUnits['surf_height'] {
  return ['feet', 'meters'].includes(value as string)
}

function isTemperatureUnit(value: unknown): value is UserUnits['temperature'] {
  return ['celsius', 'fahrenheit'].includes(value as string)
}

function isTheme(value: unknown): value is UserSettings['theme'] {
  return ['light', 'dark', 'system'].includes(value as string)
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

  // Validate form data
  const windSpeed = formData.get('units.wind_speed')
  const surfHeight = formData.get('units.surf_height')
  const swellHeight = formData.get('units.swell_height')
  const tideHeight = formData.get('units.tide_height')
  const temperature = formData.get('units.temperature')

  // Validate each unit
  if (!windSpeed || !isWindSpeedUnit(windSpeed)) {
    throw new AppError(
      `Invalid wind speed unit: ${windSpeed || 'missing'}`,
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }
  if (!surfHeight || !isHeightUnit(surfHeight)) {
    throw new AppError(
      `Invalid surf height unit: ${surfHeight || 'missing'}`,
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }
  if (!swellHeight || !isHeightUnit(swellHeight)) {
    throw new AppError(
      `Invalid swell height unit: ${swellHeight || 'missing'}`,
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }
  if (!tideHeight || !isHeightUnit(tideHeight)) {
    throw new AppError(
      `Invalid tide height unit: ${tideHeight || 'missing'}`,
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }
  if (!temperature || !isTemperatureUnit(temperature)) {
    throw new AppError(
      `Invalid temperature unit: ${temperature || 'missing'}`,
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }

  const units: UserUnits = {
    wind_speed: windSpeed,
    surf_height: surfHeight,
    swell_height: swellHeight,
    tide_height: tideHeight,
    temperature: temperature,
  }

  try {
    // First get the current cookie data to get the most recent theme setting
    const optionsCookie = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value
    const currentSettings = optionsCookie
      ? JSON.parse(optionsCookie)
      : { username: '', email: '', settings: CONFIG.settings.default }

    // Create updated settings preserving the current theme
    const updatedSettings = {
      units,
      theme: currentSettings.settings.theme, // Use theme from cookie instead of fetching from server
    }

    // Update settings on the server
    await sargoClient.updateUserProfile({ settings: updatedSettings })

    // Update cookie with new settings while preserving other data
    const updatedCookieData = {
      username: currentSettings.username,
      email: currentSettings.email,
      settings: updatedSettings,
    }

    // Set the updated cookie
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

export async function updateTheme(theme: string) {
  if (!isTheme(theme)) {
    throw new AppError(
      `Invalid theme: ${theme}`,
      ErrorCode.INVALID_PARAMETERS,
      HTTP_STATUS.BAD_REQUEST
    )
  }

  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  if (!jwt) {
    throw new AppError(
      'Unauthorized',
      ErrorCode.AUTH_UNAUTHORIZED,
      HTTP_STATUS.UNAUTHORIZED
    )
  }

  try {
    // Get current settings from cookie
    const optionsCookie = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value
    const currentSettings = optionsCookie
      ? JSON.parse(optionsCookie)
      : { username: '', email: '', settings: CONFIG.settings.default }

    // Create updated settings preserving the current units
    const updatedSettings = {
      units: currentSettings.settings.units, // Preserve current units
      theme,
    }

    // Update settings on server
    await sargoClient.updateUserProfile({ settings: updatedSettings })

    // Update cookie with new settings while preserving other data
    const updatedCookieData = {
      username: currentSettings.username,
      email: currentSettings.email,
      settings: updatedSettings,
    }

    // Set the updated cookie
    cookieStore.set(
      CONFIG.api.tokens.sargoOptions.key,
      JSON.stringify(updatedCookieData),
      CONFIG.api.tokens.sargoOptions.options
    )

    return { success: true }
  } catch (error) {
    console.error('Update theme error:', error)
    throw new AppError(
      error instanceof Error ? error.message : 'Failed to update theme',
      ErrorCode.SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
  }
}
