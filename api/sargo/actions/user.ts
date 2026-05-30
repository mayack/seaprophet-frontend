'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { CONFIG } from '@/constants/config'
import type { UserSettings } from '../interfaces/user'
import { normalizeUserSettings } from '@/lib/userSettings'
import { readSargoOptions, mergeSargoOptions } from '../cookies'

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

    return await withUserLock(async () => {
      const updatedUser = await sargoClient.updateUserProfile({
        username: username.trim(),
      })

      await mergeSargoOptions({ username: updatedUser.username })
      revalidatePath('/settings')
      return { success: true as const, user: updatedUser }
    })
  } catch (error) {
    console.error('Failed to update username:', error)
    return {
      success: false as const,
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
        await mergeSargoOptions({
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          settings: response.user.settings,
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
    const normalized = normalizeUserSettings(settings)

    return await withUserLock(async () => {
      const updatedUser = await sargoClient.updateUserProfile({
        settings: normalized,
      })

      if (!updatedUser || !updatedUser.username) {
        console.error(
          'updateUserSettings: API returned incomplete user data',
          updatedUser
        )
        return {
          success: false as const,
          error: 'Incomplete user data from server',
        }
      }

      const persistedSettings = normalizeUserSettings(
        updatedUser.settings || normalized
      )
      // Refresh the cookie so the next render reads new units without hitting
      // Sargo. Merge keeps fields this action doesn't own (calibrationReporter).
      await mergeSargoOptions({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        settings: persistedSettings,
      })

      return {
        success: true as const,
        settings: persistedSettings,
        user: updatedUser,
      }
    })
  } catch (error) {
    console.error('Failed to update user settings:', error)
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : 'Failed to update settings',
    }
  }
}

// Per-user serialization for read-modify-write settings mutations.
//
// Sargo only mutates the user via `PUT /api/user/me` with the full settings
// object (no atomic favorite/username/unit endpoints). Two concurrent writes
// can both read the same baseline and the second clobbers the first.
//
// Within a single Next.js server instance this map serializes a user's writes
// so the second awaits the first before reading current state. Multi-instance
// deployments still race — that needs a backend fix (dedicated endpoint or
// optimistic concurrency on the settings field). See M6 in the bug log.
const userMutationLocks = new Map<string, Promise<unknown>>()

async function runWithUserLock<T>(
  userKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const prev = userMutationLocks.get(userKey) ?? Promise.resolve()
  // Chain on prev's settled state (success OR failure) so a thrown error
  // doesn't deadlock subsequent calls.
  const next = prev.then(
    () => fn(),
    () => fn()
  )
  userMutationLocks.set(userKey, next)
  try {
    return await next
  } finally {
    // Only clear if no later caller has chained on top of us, otherwise
    // we'd drop the serialization order.
    if (userMutationLocks.get(userKey) === next) {
      userMutationLocks.delete(userKey)
    }
  }
}

// Serialize on the JWT cookie: stable per session, no extra round-trip.
async function withUserLock<T>(fn: () => Promise<T>): Promise<T> {
  const cookieStore = await cookies()
  const lockKey =
    cookieStore.get(CONFIG.api.tokens.sargo.key)?.value ?? 'anonymous'
  return runWithUserLock(lockKey, fn)
}

export async function toggleFavorite(spotId: number) {
  try {
    return await withUserLock(async () => {
      // Read the cached snapshot inside the lock so a prior concurrent toggle's
      // cookie write is visible; fall back to the API if it's missing/corrupt.
      const cached = await readSargoOptions()
      let user = cached
      if (!user?.username) {
        const apiUser = await sargoClient.getCurrentUser()
        if (!apiUser) throw new Error('User not found')
        user = apiUser
      }

      const settings = normalizeUserSettings(user.settings)
      const currentFavorites = settings.favorites ?? []
      const isFavorite = currentFavorites.includes(spotId)
      const uniqueFavorites = Array.from(
        new Set(
          isFavorite
            ? currentFavorites.filter((id) => id !== spotId)
            : [...currentFavorites, spotId]
        )
      )

      const updatedUser = await sargoClient.updateUserProfile({
        settings: { ...settings, favorites: uniqueFavorites },
      })

      // Treat a thin API response as failure rather than fabricating a user
      // from local state — callers read `success: true` as server agreement.
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

      const finalSettings = normalizeUserSettings({
        ...(updatedUser.settings || settings),
        favorites: uniqueFavorites,
      })
      await mergeSargoOptions({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        settings: finalSettings,
      })

      revalidatePath('/')
      return {
        success: true as const,
        isFavorite: !isFavorite,
        favorites: uniqueFavorites,
        user: { ...updatedUser, settings: finalSettings },
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
