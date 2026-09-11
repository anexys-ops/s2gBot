import { useEffect } from 'react'

export type ToastVariant = 'success' | 'error'

type ToastProps = {
  message: string
  variant: ToastVariant
  durationMs?: number
  onClose: () => void
}

export default function Toast({ message, variant, durationMs = 5000, onClose }: ToastProps) {
  useEffect(() => {
    const timerId = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(timerId)
  }, [durationMs, message, onClose])

  return (
    <div className={`app-toast app-toast--${variant}`} role="alert" aria-live="polite">
      <span className="app-toast__icon" aria-hidden>
        {variant === 'success' ? '✓' : '!'}
      </span>
      <span className="app-toast__message">{message}</span>
      <button type="button" className="app-toast__close" onClick={onClose} aria-label="Fermer">
        ×
      </button>
    </div>
  )
}

export function toastErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message
  }
  return fallback
}
