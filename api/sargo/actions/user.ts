// frontend/api/sargo/actions/user.ts

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
		const response = await strapi.login(identifier, password)

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
		const response = await strapi.register(username, email, password)

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

export async function getCurrentUser() {
	const jwt = cookies().get('jwt')?.value

	if (!jwt) {
		return null
	}

	try {
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_STRAPI_API_URL}/api/users/me`,
			{
				headers: {
					Authorization: `Bearer ${jwt}`,
				},
			}
		)

		if (!response.ok) {
			if (response.status === 401) {
				cookies().delete('jwt')
				return null
			}
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		const userData = await response.json()
		return {
			...userData,
			settings: userData.settings || { unit_system: 'metric' },
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

	// Handle profile update
	try {
		const profileResponse = await fetch(
			`${process.env.NEXT_PUBLIC_STRAPI_API_URL}/api/user/me`,
			{
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${jwt}`,
				},
				body: JSON.stringify({
					username,
					settings: { unit_system: unitSystem },
				}),
			}
		)

		if (!profileResponse.ok) {
			const errorData = await profileResponse.json()
			return {
				message: errorData.error?.message || 'Failed to update profile',
				success: false,
			}
		}
	} catch (error) {
		console.error('Error updating user profile:', error)
		return {
			message: 'An unexpected error occurred updating profile',
			success: false,
		}
	}

	// Handle password update if new password is provided
	if (newPassword) {
		if (newPassword !== confirmPassword) {
			return { message: 'New passwords do not match', success: false }
		}

		try {
			const passwordResponse = await fetch(
				`${process.env.NEXT_PUBLIC_STRAPI_API_URL}/api/auth/change-password`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${jwt}`,
					},
					body: JSON.stringify({
						currentPassword,
						newPassword,
						confirmPassword,
					}),
				}
			)

			if (!passwordResponse.ok) {
				const errorData = await passwordResponse.json()
				return {
					message: errorData.error?.message || 'Failed to update password',
					success: false,
				}
			}
		} catch (error) {
			console.error('Error updating password:', error)
			return {
				message: 'An unexpected error occurred updating password',
				success: false,
			}
		}
	}

	return { message: 'Settings updated successfully', success: true }
}
