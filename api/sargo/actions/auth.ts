'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { CONFIG } from '@/constants/config'
import { normalizeUserSettings } from '@/lib/userSettings'
import { readSargoOptions, writeSargoOptions } from '../cookies'
import type { User, UserAuthResponse } from '../interfaces/user'

export type SignInState = { error?: string; success?: boolean } | null

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const identifier = formData.get('identifier')
  const password = formData.get('password')

  if (
    !identifier ||
    !password ||
    typeof identifier !== 'string' ||
    typeof password !== 'string'
  ) {
    return { error: 'Enter your email/username and password.' }
  }

  const cookieStore = await cookies()

  try {
    const sargoResponse: UserAuthResponse = await sargoClient.login(
      identifier,
      password
    )
    if (!sargoResponse?.jwt || !sargoResponse.user?.username) {
      console.error('Invalid login response from Sargo')
      return { error: 'Invalid credentials' }
    }

    cookieStore.set({
      name: CONFIG.api.tokens.sargo.key,
      value: sargoResponse.jwt,
      ...CONFIG.api.tokens.sargo.options,
    })
    await writeSargoOptions({
      id: sargoResponse.user.id,
      username: sargoResponse.user.username,
      email: sargoResponse.user.email,
      settings: sargoResponse.user.settings,
      calibrationReporter: sargoResponse.user.calibrationReporter,
    })

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('SignIn Error:', error)
    if (error instanceof Error && error.name === 'auth') {
      return { error: 'Incorrect email/username or password.' }
    }
    if (error instanceof Error && error.name === 'network') {
      return { error: 'Check your connection and try again.' }
    }
    return { error: 'Sign-in failed. Please try again.' }
  }
}

export async function signOut() {
  const cookieStore = await cookies()

  try {
    // To reliably clear a cookie the delete-instruction must mirror the
    // EXACT attribute set used at write time (path, secure, sameSite,
    // httpOnly, …). Browsers — Safari most notably — keep "phantom"
    // cookies around when the path or sameSite of the Set-Cookie response
    // doesn't match the original. We deliberately reuse the same
    // `CONFIG.api.tokens.*.options` blob used by `signIn` so the two
    // sides can never drift.
    const cookiesToDelete: Array<{
      name: string
      options: typeof CONFIG.api.tokens.sargo.options
    }> = [
      {
        name: CONFIG.api.tokens.sargo.key,
        options: CONFIG.api.tokens.sargo.options,
      },
      {
        name: CONFIG.api.tokens.sargoOptions.key,
        options: CONFIG.api.tokens.sargoOptions.options,
      },
    ]

    for (const { name, options } of cookiesToDelete) {
      cookieStore.set({
        name,
        value: '',
        ...options,
        // Override maxAge/expires so the cookie expires immediately
        // regardless of the long maxAge baked into the write options.
        maxAge: 0,
        expires: new Date(0),
      })
    }

    revalidatePath('/')
  } catch (error) {
    console.error('SignOut Error:', error)
  }

  return { success: true }
}

// Reads user data from the TOKEN_SARGO_OPTIONS cookie (fast path).
// The options cookie is written on sign-in and updated on every settings
// mutation, so it's always fresh enough for page-render reads.  Only when
// the cookie is missing or corrupt do we fall back to a Sargo API call.
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()

  // Must have a JWT at all — if it's gone the session is dead.
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value
  if (!jwt) return null

  const cached = await readSargoOptions()
  if (cached?.username && 'calibrationReporter' in cached) {
    return {
      id: cached.id,
      username: cached.username,
      email: cached.email || '',
      settings: normalizeUserSettings(cached.settings),
      calibrationReporter: !!cached.calibrationReporter,
    }
  }

  // Cookie missing or invalid — fetch from Sargo and populate it.
  try {
    const freshUser = await sargoClient.getCurrentUser()
    if (!freshUser) return null

    const userData: User = {
      id: freshUser.id,
      username: freshUser.username || '',
      email: freshUser.email || '',
      settings: normalizeUserSettings(freshUser.settings),
      calibrationReporter: !!freshUser.calibrationReporter,
    }

    // Best-effort cookie refresh (no-op in Server Component render context).
    await writeSargoOptions(userData)

    return userData
  } catch (error) {
    const isAuthError = error instanceof Error && error.name === 'auth'
    if (isAuthError) return null

    console.error('Sargo unreachable and no cookie cache:', error)
    return null
  }
}
