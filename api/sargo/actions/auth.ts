'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sargoClient } from '../client'
import { CONFIG } from '@/constants/config'
import type { User, UserAuthResponse } from '../interfaces/user'

// Cached Sargo user fetch — deduplicated within a single server render pass
// so that layout.tsx + page.tsx (or multiple pages) sharing one request
// don't each trigger a separate GET /api/users/me round-trip.
const fetchCurrentUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value

  if (!jwt) return null

  try {
    const freshUser = await sargoClient.getCurrentUser()
    if (!freshUser) return null

    return {
      id: freshUser.id,
      username: freshUser.username || '',
      email: freshUser.email || '',
      settings: freshUser.settings || CONFIG.settings.default,
      calibrationReporter: !!freshUser.calibrationReporter,
    }
  } catch (error) {
    const isAuthError = error instanceof Error && error.name === 'auth'
    if (isAuthError) return null

    console.error(
      'Sargo unreachable, falling back to cookie cache:',
      error
    )

    const optionsCookie = cookieStore.get(
      CONFIG.api.tokens.sargoOptions.key
    )?.value
    if (optionsCookie) {
      try {
        const userOptions = JSON.parse(optionsCookie) as User
        return {
          username: userOptions.username || '',
          email: userOptions.email || '',
          settings: userOptions.settings || CONFIG.settings.default,
          calibrationReporter: !!userOptions.calibrationReporter,
        }
      } catch (parseError) {
        console.error('Failed to parse sargoOptions cookie:', parseError)
      }
    }

    return null
  }
})

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

export async function getCurrentUser(): Promise<User | null> {
  return fetchCurrentUser()
}

export async function fetchSargoOptionsAction() {
  const cookieStore = await cookies()
  try {
    const user = await sargoClient.getCurrentUser()
    if (!user) throw new Error('No user data returned')
    const options = {
      username: user.username,
      email: user.email,
      settings: user.settings || CONFIG.settings.default,
      calibrationReporter: !!user.calibrationReporter,
    }
    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value: JSON.stringify(options),
      ...CONFIG.api.tokens.sargoOptions.options,
    })
    return { success: true, options }
  } catch (error) {
    console.error('Sargo options fetch failed:', error)
    return { success: false, error: 'Failed to fetch Sargo options' }
  }
}
