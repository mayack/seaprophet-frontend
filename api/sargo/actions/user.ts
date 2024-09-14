'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { FormState } from '@/api/sargo/interfaces/formState'

const API_URL =
  process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337'

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}/api${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('API Error:', data)
    throw new Error(data.error?.message || 'An error occurred')
  }

  return data
}

export async function signIn(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const identifier = formData.get('identifier') as string
  const password = formData.get('password') as string

  try {
    const response = await fetchAPI('/auth/local', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })

    cookies().set('jwt', response.jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    return { message: 'Signed in successfully', success: true }
  } catch (error: any) {
    console.error('Sign in error:', error)
    return { message: error.message, success: false }
  }
}

export async function signOut() {
  try {
    cookies().delete('jwt')
  } catch (error) {
    console.error('Sign out error:', error)
    return { error: 'Failed to sign out' }
  }

  redirect('/')
}

export async function signUp(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const username = formData.get('username') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  console.log('Sign up data:', {
    username,
    email,
    password: password ? '[REDACTED]' : 'missing',
  })

  try {
    const response = await fetchAPI('/auth/local/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    })

    cookies().set('jwt', response.jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    return { message: 'Signed up successfully', success: true }
  } catch (error: any) {
    console.error('Sign up error:', error)
    return { message: error.message, success: false }
  }
}

export async function getCurrentUser() {
  const jwt = cookies().get('jwt')?.value

  if (!jwt) {
    return null
  }

  try {
    const response = await fetchAPI('/users/me', {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })

    return {
      ...response,
      settings: response.settings || { unit_system: 'metric' },
    }
  } catch (error) {
    console.error('Error fetching current user:', error)
    return null
  }
}

export async function updateUserSettings(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const jwt = cookies().get('jwt')?.value

  if (!jwt) {
    return { message: 'Not authenticated', success: false }
  }

  const username = formData.get('username') as string
  const unitSystem = formData.get('unitSystem') as 'metric' | 'imperial'
  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  try {
    // Update profile
    await fetchAPI('/user/me', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        settings: { unit_system: unitSystem },
      }),
    })

    // Update password if provided
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        return { message: 'New passwords do not match', success: false }
      }

      await fetchAPI('/auth/change-password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })
    }

    return { message: 'Settings updated successfully', success: true }
  } catch (error: any) {
    console.error('Error updating user settings:', error)
    return { message: error.message, success: false }
  }
}
