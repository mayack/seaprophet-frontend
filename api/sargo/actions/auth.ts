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
        username: sargoResponse.user.username,
        email: sargoResponse.user.email,
        settings: sargoResponse.user.settings || CONFIG.settings.default,
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
    const cookiesToDelete = [
      CONFIG.api.tokens.polvo.key,
      CONFIG.api.tokens.sargo.key,
      CONFIG.api.tokens.sargoOptions.key,
    ]

    for (const cookieName of cookiesToDelete) {
      cookieStore.set({
        name: cookieName,
        value: '',
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      })
      cookieStore.delete(cookieName)
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
  const cookieStore = await cookies()
  const jwt = cookieStore.get(CONFIG.api.tokens.sargo.key)?.value

  if (!jwt) return null

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
      }
    } catch (error) {
      console.error('Failed to parse sargoOptions cookie:', error)
    }
  }

  try {
    const freshUser = await sargoClient.getCurrentUser()
    if (!freshUser) return null
    return {
      username: freshUser.username || '',
      email: freshUser.email || '',
      settings: freshUser.settings || CONFIG.settings.default,
    }
  } catch (error) {
    console.error('Failed to fetch fresh user data:', error)
    return null
  }
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
