'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { CONFIG } from '@/constants/config'
import type { UserSettings } from '../interfaces/user'

export async function updateUsername(formData: FormData) {
  try {
    const username = formData.get('username') as string

    if (!username || username.trim().length === 0) {
      return { success: false, error: 'Username is required' }
    }

    const updatedUser = await sargoClient.updateUserProfile({
      username: username.trim(),
    })

    // Update cached user options
    const cookieStore = await cookies()
    const existingOptionsStr = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value

    if (existingOptionsStr) {
      try {
        const existingOptions = JSON.parse(existingOptionsStr)
        cookieStore.set({
          name: CONFIG.api.tokens.sargoOptions.key,
          value: JSON.stringify({
            ...existingOptions,
            username: updatedUser.username,
          }),
          ...CONFIG.api.tokens.sargoOptions.options,
        })
      } catch (error) {
        console.error('Failed to update cached username:', error)
      }
    }

    revalidatePath('/settings')
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error('Failed to update username:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update username',
    }
  }
}

export async function updatePassword(formData: FormData) {
  try {
    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { success: false, error: 'All password fields are required' }
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New passwords do not match' }
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' }
    }

    await sargoClient.changePassword({
      currentPassword,
      password: newPassword,
      passwordConfirmation: confirmPassword,
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to update password:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update password',
    }
  }
}

export async function updateUnits(formData: FormData) {
  try {
    const user = await sargoClient.getCurrentUser()
    if (!user) throw new Error('User not found')

    const currentUnits = user.settings?.units || CONFIG.settings.default.units

    const units: UserSettings['units'] = {
      wind_speed: ((formData.get('units.wind_speed') as string) ||
        currentUnits.wind_speed) as UserSettings['units']['wind_speed'],
      surf_height: ((formData.get('units.surf_height') as string) ||
        currentUnits.surf_height) as UserSettings['units']['surf_height'],
      swell_height: ((formData.get('units.swell_height') as string) ||
        currentUnits.swell_height) as UserSettings['units']['swell_height'],
      tide_height: ((formData.get('units.tide_height') as string) ||
        currentUnits.tide_height) as UserSettings['units']['tide_height'],
      temperature: ((formData.get('units.temperature') as string) ||
        currentUnits.temperature) as UserSettings['units']['temperature'],
    }

    const updatedSettings: UserSettings = {
      ...user.settings,
      units: units,
    }

    const updatedUser = await sargoClient.updateUserProfile({
      settings: updatedSettings,
    })

    // Update cached user options
    const cookieStore = await cookies()
    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify({
        username: updatedUser.username,
        email: updatedUser.email,
        settings: updatedSettings,
      }),
      ...CONFIG.api.tokens.sargoOptions.options,
    })

    revalidatePath('/settings')
    return {
      success: true,
      units: units,
      user: updatedUser,
    }
  } catch (error) {
    console.error('Failed to update units:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update units',
    }
  }
}

// New server action that accepts plain objects (no FormData)
export async function updateUserUnits(units: UserSettings['units']) {
  try {
    const user = await sargoClient.getCurrentUser()
    if (!user) throw new Error('User not found')

    const updatedSettings: UserSettings = {
      ...(user.settings || {}),
      units: units,
    }

    console.log('Updating user profile with settings:', updatedSettings)

    const updatedUser = await sargoClient.updateUserProfile({
      settings: updatedSettings,
    })

    console.log('Updated user response:', updatedUser)

    // Check if the API call returned a valid user object
    if (!updatedUser || !updatedUser.username) {
      console.warn('API returned incomplete user data, using fallback approach')
      // Fall back to using the original user data with updated settings
      const fallbackUser = {
        ...user,
        settings: updatedSettings,
      }

      // Update cached user options with fallback data
      const cookieStore = await cookies()
      cookieStore.set({
        name: CONFIG.api.tokens.sargoOptions.key,
        value: JSON.stringify({
          username: fallbackUser.username,
          email: fallbackUser.email,
          settings: updatedSettings,
        }),
        ...CONFIG.api.tokens.sargoOptions.options,
      })

      revalidatePath('/settings')
      return {
        success: true,
        units: units,
        user: fallbackUser,
      }
    }

    // Update cached user options with the response from API
    const cookieStore = await cookies()
    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify({
        username: updatedUser.username,
        email: updatedUser.email,
        settings: updatedSettings,
      }),
      ...CONFIG.api.tokens.sargoOptions.options,
    })

    revalidatePath('/settings')
    return {
      success: true,
      units: units,
      user: updatedUser,
    }
  } catch (error) {
    console.error('Failed to update user units:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update user units',
    }
  }
}

export async function toggleFavorite(spotId: number) {
  try {
    const cookieStore = await cookies()

    // First, try to read from cookie cache (most up-to-date)
    let user: {
      username: string
      email: string
      settings: UserSettings
    } | null = null
    const optionsCookie = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value

    if (optionsCookie) {
      try {
        const cachedUser = JSON.parse(optionsCookie) as {
          username: string
          email: string
          settings: UserSettings
        }
        user = cachedUser
      } catch (error) {
        console.error('Failed to parse sargoOptions cookie:', error)
      }
    }

    // Fall back to API if cookie doesn't exist or is invalid
    if (!user) {
      const apiUser = await sargoClient.getCurrentUser()
      if (!apiUser) throw new Error('User not found')
      user = {
        username: apiUser.username,
        email: apiUser.email,
        settings: apiUser.settings || CONFIG.settings.default,
      }
    }

    // Ensure we have a proper favorites array
    // Handle cases where favorites might be undefined, null, or not an array
    let currentFavorites: number[] = []
    if (user.settings.favorites) {
      if (Array.isArray(user.settings.favorites)) {
        // Ensure all items are numbers
        currentFavorites = user.settings.favorites
          .map((id) => Number(id))
          .filter((id) => !isNaN(id))
      }
    }

    const isFavorite = currentFavorites.includes(spotId)

    // Create updated favorites array
    const updatedFavorites = isFavorite
      ? currentFavorites.filter((id) => id !== spotId)
      : [...currentFavorites, spotId]

    // Remove duplicates just in case
    const uniqueFavorites = Array.from(new Set(updatedFavorites))

    // Ensure we preserve all existing settings
    const updatedSettings: UserSettings = {
      ...user.settings,
      favorites: uniqueFavorites,
    }

    console.log('Toggling favorite:', {
      spotId,
      currentFavorites,
      updatedFavorites: uniqueFavorites,
      isFavorite,
      userSettings: user.settings,
      source: optionsCookie ? 'cookie' : 'api',
    })

    const updatedUser = await sargoClient.updateUserProfile({
      settings: updatedSettings,
    })

    console.log('Updated user response:', {
      username: updatedUser.username,
      settings: updatedUser.settings,
      favorites: updatedUser.settings?.favorites,
    })

    // Check if the API call returned a valid user object with complete settings
    if (!updatedUser || !updatedUser.username) {
      console.warn('API returned incomplete user data, using fallback approach')
      // Fall back to using the original user data with updated settings
      const fallbackUser = {
        ...user,
        settings: updatedSettings,
      }

      // Update cached user options with fallback data
      const cookieStore = await cookies()
      cookieStore.set({
        name: CONFIG.api.tokens.sargoOptions.key,
        value: JSON.stringify({
          username: fallbackUser.username,
          email: fallbackUser.email,
          settings: updatedSettings,
        }),
        ...CONFIG.api.tokens.sargoOptions.options,
      })

      revalidatePath('/')
      return {
        success: true,
        isFavorite: !isFavorite,
        favorites: uniqueFavorites,
        user: fallbackUser,
      }
    }

    // Ensure the returned user has the updated settings
    // Sometimes the API might not return the complete settings object
    // Always use our calculated settings to ensure consistency
    const finalUser = {
      ...updatedUser,
      settings: {
        ...updatedUser.settings,
        favorites: uniqueFavorites,
      },
    }

    // Update cached user options with the response from API
    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify({
        username: finalUser.username,
        email: finalUser.email,
        settings: finalUser.settings,
      }),
      ...CONFIG.api.tokens.sargoOptions.options,
    })

    revalidatePath('/')
    return {
      success: true,
      isFavorite: !isFavorite,
      favorites: uniqueFavorites,
      user: finalUser,
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to toggle favorite',
    }
  }
}
