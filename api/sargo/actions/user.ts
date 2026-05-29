'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { CONFIG } from '@/constants/config'
import type { UserSettings } from '../interfaces/user'

// FormData.get returns `FormDataEntryValue | null`, which can be a `File`
// (e.g. if the form was tampered with). Always validate to `string` before
// using a field as text. Mirrors the guard in `signIn` (auth.ts).
function getStringField(fd: FormData, key: string): string | null {
  const v = fd.get(key)
  return typeof v === 'string' ? v : null
}

export async function updateUsername(formData: FormData) {
  try {
    const username = getStringField(formData, 'username')

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
    const currentPassword = getStringField(formData, 'currentPassword')
    const newPassword = getStringField(formData, 'newPassword')
    const confirmPassword = getStringField(formData, 'confirmPassword')

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { success: false, error: 'All password fields are required' }
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New passwords do not match' }
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' }
    }

    const response = await sargoClient.changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    })

    // Strapi rotates the JWT on password change. Persist the new token so
    // the old one (which technically still works until it expires) is
    // replaced in the user's session, and refresh the cached user options
    // cookie if the controller returned a sanitized user payload.
    if (response?.jwt) {
      const cookieStore = await cookies()
      cookieStore.set({
        name: CONFIG.api.tokens.sargo.key,
        value: response.jwt,
        ...CONFIG.api.tokens.sargo.options,
      })

      if (response.user?.username) {
        cookieStore.set({
          name: CONFIG.api.tokens.sargoOptions.key,
          value: JSON.stringify({
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            settings: response.user.settings || CONFIG.settings.default,
          }),
          ...CONFIG.api.tokens.sargoOptions.options,
        })
      }
    }

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

// Accepts the full settings object from the client (which already knows the
// current state via UserContext) so we can skip the read-before-write
// getCurrentUser() round-trip that previously doubled the latency of every
// unit toggle. The client is responsible for merging the new units into the
// existing settings before calling this.
export async function updateUserSettings(settings: UserSettings) {
  try {
    const updatedUser = await sargoClient.updateUserProfile({
      settings,
    })

    if (!updatedUser || !updatedUser.username) {
      console.error(
        'updateUserSettings: API returned incomplete user data',
        updatedUser
      )
      return {
        success: false,
        error: 'Incomplete user data from server',
      }
    }

    // Update the options cookie so the next page load reads fresh data
    // without hitting Sargo.  Include `id` so getCurrentUser() can build
    // a complete User from the cookie alone.
    const cookieStore = await cookies()
    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        settings: updatedUser.settings || settings,
      }),
      ...CONFIG.api.tokens.sargoOptions.options,
    })

    // No revalidatePath here — the client already updates optimistically via
    // useOptimistic + setUserData.  revalidatePath('/settings') would trigger
    // a redundant server re-render + another Sargo getCurrentUser() call.
    return {
      success: true,
      settings: updatedUser.settings || settings,
      user: updatedUser,
    }
  } catch (error) {
    console.error('Failed to update user settings:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update settings',
    }
  }
}

// Per-user serialization for the read-modify-write favourites flow.
//
// Sargo doesn't expose atomic add/remove-favorite endpoints — the only way
// to mutate favorites is `PUT /api/user/me` with the full settings.favorites
// array. Two concurrent toggles can therefore both read the same baseline
// and the second write clobbers the first.
//
// Within a single Next.js server instance this map serializes toggles for a
// given user so the second toggle awaits the first's resolution before
// reading the current value. Multi-instance deployments still race, but
// that requires a backend-side fix (add a dedicated endpoint, or use
// optimistic concurrency on the settings field) — see M6 in the bug log.
const toggleFavoriteLocks = new Map<string, Promise<unknown>>()

async function runWithUserLock<T>(
  userKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const prev = toggleFavoriteLocks.get(userKey) ?? Promise.resolve()
  // Chain on prev's settled state (success OR failure) so a thrown error
  // doesn't deadlock subsequent calls.
  const next = prev.then(
    () => fn(),
    () => fn()
  )
  toggleFavoriteLocks.set(userKey, next)
  try {
    return await next
  } finally {
    // Only clear if no later caller has chained on top of us, otherwise
    // we'd drop the serialization order.
    if (toggleFavoriteLocks.get(userKey) === next) {
      toggleFavoriteLocks.delete(userKey)
    }
  }
}

export async function toggleFavorite(spotId: number) {
  try {
    const cookieStore = await cookies()
    // Use the JWT cookie value as the per-user serialization key. It is
    // stable per session and avoids needing the user id up front (which
    // would require an extra round-trip and defeat the cookie fast path).
    const lockKey =
      cookieStore.get(CONFIG.api.tokens.sargo.key)?.value ?? 'anonymous'

    return await runWithUserLock(lockKey, async () => {
      // Re-read cookies inside the lock so a previous concurrent toggle's
      // refreshed sargoOptions cookie is visible to this iteration.
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

      const updatedUser = await sargoClient.updateUserProfile({
        settings: updatedSettings,
      })

      // If the API came back without the fields we need, surface that as a
      // failure rather than fabricating a fake user from local state — callers
      // were treating `success: true` as a guarantee the server agreed.
      if (!updatedUser || !updatedUser.username) {
        console.error(
          'toggleFavorite: API returned incomplete user data',
          updatedUser
        )
        return {
          success: false as const,
          error: 'Incomplete user data from server',
        }
      }

      // Use the API response as the source of truth, falling back to the
      // locally-computed settings only when the response is missing them.
      const finalSettings = updatedUser.settings || updatedSettings
      const finalUser = {
        ...updatedUser,
        settings: {
          ...finalSettings,
          favorites: uniqueFavorites,
        },
      }

      cookieStore.set({
        name: CONFIG.api.tokens.sargoOptions.key,
        value: JSON.stringify({
          id: finalUser.id,
          username: finalUser.username,
          email: finalUser.email,
          settings: finalUser.settings,
        }),
        ...CONFIG.api.tokens.sargoOptions.options,
      })

      revalidatePath('/')
      return {
        success: true as const,
        isFavorite: !isFavorite,
        favorites: uniqueFavorites,
        user: finalUser,
      }
    })
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : 'Failed to toggle favorite',
    }
  }
}
