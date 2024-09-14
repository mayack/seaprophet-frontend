'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { FormState } from '@/api/sargo/interfaces/formState'
import strapi from '@/api/sargo/client'

export async function signIn(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const identifier = formData.get('identifier') as string
  const password = formData.get('password') as string

  try {
    const response = await strapi.login({ identifier, password })

    // Set HTTP-only cookie with JWT
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
    const errorMessage =
      error.error?.message ||
      'Failed to sign in. Please check your credentials and try again.'
    return { message: errorMessage, success: false }
  }
}

export async function signOut() {
  try {
    await strapi.logout()
    cookies().delete('jwt')
  } catch (error) {
    console.error('Sign out error:', error)
    return { error: 'Failed to sign out' }
  }

  // Perform the redirect after all other operations
  redirect('/')
}

export async function signUp(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const username = formData.get('username') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    const response = await strapi.register({ username, email, password })

    // Set HTTP-only cookie with JWT
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
    const errorMessage =
      error.error?.message || 'Failed to sign up. Please try again.'
    return { message: errorMessage, success: false }
  }
}
