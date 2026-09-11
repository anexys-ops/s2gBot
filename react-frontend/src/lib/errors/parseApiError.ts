import { AppError, type FieldErrors } from './appError'
import { httpStatusMessage } from './messages'

function normalizeFieldErrors(raw: unknown): FieldErrors {
  if (!raw || typeof raw !== 'object') return {}
  const out: FieldErrors = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[key] = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    } else if (typeof value === 'string' && value.trim() !== '') {
      out[key] = [value]
    }
  }
  return out
}

function messageFromPayload(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.message === 'string' && obj.message.trim() !== '') {
      return obj.message
    }
  }
  return httpStatusMessage(status)
}

export async function parseApiErrorResponse(res: Response, data?: unknown): Promise<AppError> {
  let payload = data
  if (payload === undefined) {
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      payload = await res.json().catch(() => ({}))
    } else {
      const text = await res.text().catch(() => '')
      if (res.status === 502 || text.toLowerCase().includes('bad gateway')) {
        return AppError.fromHttp(
          502,
          'Le serveur est momentanément indisponible (502). Réessayez dans quelques instants.',
        )
      }
      if (text.trim()) {
        return AppError.fromHttp(res.status, httpStatusMessage(res.status))
      }
      payload = {}
    }
  }

  const fieldErrors = normalizeFieldErrors(
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>).errors : undefined,
  )
  const message = messageFromPayload(payload, res.status)

  return new AppError(message, {
    status: res.status,
    code: res.status === 422 ? 'validation' : res.status >= 500 ? 'server' : 'http',
    fieldErrors,
    raw: payload,
  })
}
