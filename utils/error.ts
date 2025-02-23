export enum ErrorCode {
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_MAX_RETRIES = 'AUTH_MAX_RETRIES',
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
}

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const

export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}
