import { getPolvoToken, fetchPolvoToken, clearPolvoTokenCache } from './auth'

/**
 * Run a Polvo API call with the cached token, retrying once with a fresh token
 * if the call fails with an auth error. Throws if no token is available or the
 * retry also fails — callers map the thrown error to their response shape.
 */
export async function withPolvoAuth<T>(
  call: (token: string) => Promise<T>
): Promise<T> {
  const token = await getPolvoToken()
  if (!token) {
    throw new Error('Authentication token not available')
  }

  try {
    return await call(token)
  } catch (error) {
    if (error instanceof Error && error.name === 'auth') {
      await clearPolvoTokenCache()
      const freshToken = await fetchPolvoToken()
      if (freshToken) {
        return call(freshToken)
      }
    }
    throw error
  }
}
