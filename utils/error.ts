// Simple error types for the most common cases
export type ErrorType = 'auth' | 'network' | 'validation' | 'unknown'

// Simple error creator for consistent error responses
export function createError(
  message: string,
  type: ErrorType = 'unknown'
): Error {
  const error = new Error(message)
  error.name = type
  return error
}

// Helper to extract meaningful error messages
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}
