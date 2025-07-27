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

    const units: UserSettings['units'] = {
      wind_speed: ((formData.get('units.wind_speed') as string) ||
        user.settings.units.wind_speed) as UserSettings['units']['wind_speed'],
      surf_height: ((formData.get('units.surf_height') as string) ||
        user.settings.units
          .surf_height) as UserSettings['units']['surf_height'],
      swell_height: ((formData.get('units.swell_height') as string) ||
        user.settings.units
          .swell_height) as UserSettings['units']['swell_height'],
      tide_height: ((formData.get('units.tide_height') as string) ||
        user.settings.units
          .tide_height) as UserSettings['units']['tide_height'],
      temperature: ((formData.get('units.temperature') as string) ||
        user.settings.units
          .temperature) as UserSettings['units']['temperature'],
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
      ...user.settings,
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
