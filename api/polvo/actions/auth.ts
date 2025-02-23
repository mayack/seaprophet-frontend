// 'use server'

// import { cookies } from 'next/headers'
// import { polvoClient } from '../client'
// import { CONFIG } from '@/constants/config'

// export async function refreshPolvoToken(): Promise<string> {
//   const cookieStore = await cookies();
//   try {
//     const newToken = await polvoClient.getAuthToken();
//     cookieStore.set({
//       name: CONFIG.api.tokens.polvo.key,
//       value: newToken,
//       path: CONFIG.api.tokens.polvo.options.path,
//       secure: CONFIG.api.tokens.polvo.options.secure,
//       httpOnly: CONFIG.api.tokens.polvo.options.httpOnly,
//       sameSite: CONFIG.api.tokens.polvo.options.sameSite,
//       maxAge: CONFIG.api.tokens.polvo.options.maxAge,
//     });
//     console.log('refreshPolvoToken: New Polvo token set:', newToken);
//     return newToken;
//   } catch (error) {
//     console.error('refreshPolvoToken: Failed to refresh Polvo token:', error);
//     throw error;
//   }
// }

// // export async function checkPolvoToken(): Promise<{
// //   token: string | null
// //   error: string | null
// // }> {
// //   console.log('checkPolvoToken called')
// //   try {
// //     const cookieStore = await cookies()
// //     const existingToken = cookieStore.get(CONFIG.api.tokens.polvo.key)?.value
// //     console.log('Existing token check:', existingToken ? 'Found' : 'Not found')

// //     if (existingToken && !polvoClient.isTokenExpired(existingToken)) {
// //       console.log('Token is valid')
// //       return { token: existingToken, error: null }
// //     }

// //     const token = await polvoClient.getAuthToken()
// //     console.log('New token fetched:', token)
// //     cookieStore.set(
// //       CONFIG.api.tokens.polvo.key,
// //       token,
// //       CONFIG.api.tokens.polvo.options
// //     )
// //     console.log('Token set in cookies')
// //     return { token, error: null }
// //   } catch (error) {
// //     console.error('Polvo auth error:', {
// //       message: error instanceof Error ? error.message : 'Unknown error',
// //       stack: error instanceof Error ? error.stack : undefined,
// //     })
// //     return {
// //       token: null,
// //       error:
// //         error instanceof Error
// //           ? error.message
// //           : 'Failed to authenticate with Polvo API',
// //     }
// //   }
// // }

// // export async function resetPolvoToken(): Promise<void> {
// //   const cookieStore = await cookies()
// //   cookieStore.delete(CONFIG.api.tokens.polvo.key)
// //   console.log('Polvo token reset')
// // }

// // export async function refreshPolvoToken(): Promise<{
// //   token: string | null
// //   error: string | null
// // }> {
// //   console.log('refreshPolvoToken called')
// //   try {
// //     const cookieStore = await cookies()
// //     cookieStore.delete(CONFIG.api.tokens.polvo.key)
// //     const token = await polvoClient.getAuthToken()
// //     console.log('Refreshed token fetched:', token)
// //     cookieStore.set(
// //       CONFIG.api.tokens.polvo.key,
// //       token,
// //       CONFIG.api.tokens.polvo.options
// //     )
// //     console.log('Refreshed token set in cookies')
// //     return { token, error: null }
// //   } catch (error) {
// //     console.error('Polvo token refresh error:', {
// //       message: error instanceof Error ? error.message : 'Unknown error',
// //       stack: error instanceof Error ? error.stack : undefined,
// //     })
// //     return {
// //       token: null,
// //       error:
// //         error instanceof Error
// //           ? error.message
// //           : 'Failed to refresh Polvo token',
// //     }
// //   }
// // }
