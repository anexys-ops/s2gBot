export type FieldErrors = Record<string, string[]>

export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldErrors
  readonly raw: unknown

  constructor(message: string, options: { status?: number; code?: string; fieldErrors?: FieldErrors; raw?: unknown } = {}) {
    super(message)
    this.name = 'AppError'
    this.status = options.status ?? 0
    this.code = options.code ?? 'unknown'
    this.fieldErrors = options.fieldErrors ?? {}
    this.raw = options.raw
  }

  static fromHttp(status: number, message: string, fieldErrors: FieldErrors = {}): AppError {
    const code =
      status === 401
        ? 'unauthorized'
        : status === 403
          ? 'forbidden'
          : status === 404
            ? 'not_found'
            : status === 422
              ? 'validation'
              : status >= 500
                ? 'server'
                : 'http'
    return new AppError(message, { status, code, fieldErrors })
  }

  get fieldMessages(): string[] {
    return Object.values(this.fieldErrors)
      .flat()
      .filter((m): m is string => typeof m === 'string' && m.trim() !== '')
  }

  get displayMessage(): string {
    const fields = this.fieldMessages
    if (fields.length > 0) {
      return fields.join(' ')
    }
    return this.message
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function errorMessage(err: unknown, fallback: string): string {
  if (isAppError(err)) return err.displayMessage
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}
