'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { CONFIG } from '@/constants/config'
import type { User, UserAuthResponse } from '../interfaces/user'

export async function signIn(formData: FormData) {
  const identifier = formData.get('identifier')
  const password = formData.get('password')

  if (
    !identifier ||
    !password ||
    typeof identifier !== 'string' ||
    typeof password !== 'string'
  ) {
    console.error('Invalid form data:', { identifier, password })
    return { success: false, error: 'Invalid credentials' }
  }

  const cookieStore = await cookies()

  try {
    const sargoResponse: UserAuthResponse = await sargoClient.login(
      identifier,
      password
    )
    if (!sargoResponse?.jwt || !sargoResponse.user?.username) {
      console.error('Invalid login response:', sargoResponse)
      return { success: false, error: 'Invalid credentials' }
    }

    cookieStore.set({
      name: CONFIG.api.tokens.sargo.key,
      value: sargoResponse.jwt,
      ...CONFIG.api.tokens.sargo.options,
    })
    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify({
        id: sargoResponse.user.id,
        username: sargoResponse.user.username,
        email: sargoResponse.user.email,
        settings: sargoResponse.user.settings || CONFIG.settings.default,
        calibrationReporter: !!sargoResponse.user.calibrationReporter,
      }),
      ...CONFIG.api.tokens.sargoOptions.options,
    })

    return { success: true }
  } catch (error) {
    console.error('SignIn Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    }
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
    redirect('/auth/signin')
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error
    console.error('SignOut Error:', error)
    redirect('/auth/signin')
  }
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

  const optionsCookie = cookieStore.get(
    CONFIG.api.tokens.sargoOptions.key
  )?.value

  if (optionsCookie) {
    try {
      const cached = JSON.parse(optionsCookie) as User
      if (cached.username) {
        return {
          id: cached.id,
          username: cached.username,
          email: cached.email || '',
          settings: cached.settings || CONFIG.settings.default,
          calibrationReporter: !!cached.calibrationReporter,
        }
      }
    } catch (parseError) {
      console.error('Failed to parse sargoOptions cookie:', parseError)
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
      settings: freshUser.settings || CONFIG.settings.default,
      calibrationReporter: !!freshUser.calibrationReporter,
    }

    // NOTE: getCurrentUser is called from Server Components, which
    // Next.js forbids from writing cookies. The options cookie is only
    // written here as a best-effort — if it throws, we still return the
    // user data so the page renders correctly.
    try {
      cookieStore.set({
        name: CONFIG.api.tokens.sargoOptions.key,
        value: JSON.stringify(userData),
        ...CONFIG.api.tokens.sargoOptions.options,
      })
    } catch {
      // Server Component context — cookie write not allowed, that's fine.
    }

    return userData
  } catch (error) {
    const isAuthError = error instanceof Error && error.name === 'auth'
    if (isAuthError) return null

    console.error('Sargo unreachable and no cookie cache:', error)
    return null
  }
}
