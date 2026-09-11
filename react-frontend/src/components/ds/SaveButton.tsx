import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  label?: string
  pendingLabel?: string
  successLabel?: string
  size?: 'sm' | 'md'
  type?: 'button' | 'submit'
  className?: string
  isPending: boolean
  /** Passez `mutation.isSuccess` (TanStack Query) pour afficher la confirmation. */
  isSuccess?: boolean
  /** Si défini, le bouton n’est actif que lorsque le formulaire a été modifié. */
  isDirty?: boolean
  disabled?: boolean
  onClick?: () => void
}

/**
 * Bouton Enregistrer avec retour visuel : grisé si rien à sauver, ✓ vert après succès.
 */
export default function SaveButton({
  label = 'Enregistrer',
  pendingLabel = 'Enregistrement…',
  successLabel = 'Enregistré',
  size = 'sm',
  type = 'button',
  className = '',
  isPending,
  isSuccess = false,
  isDirty,
  disabled = false,
  onClick,
}: Props) {
  const [justSaved, setJustSaved] = useState(false)
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !isPending && isSuccess) {
      setJustSaved(true)
      const timer = window.setTimeout(() => setJustSaved(false), 2500)
      return () => window.clearTimeout(timer)
    }
    wasPending.current = isPending
  }, [isPending, isSuccess])

  useEffect(() => {
    if (isDirty) {
      setJustSaved(false)
    }
  }, [isDirty])

  const dirtyGated = isDirty !== undefined
  const canSave = dirtyGated ? Boolean(isDirty) && !disabled : !disabled
  const isDisabled = isPending || justSaved || !canSave

  let variantClass = 'btn-primary'
  let content: ReactNode = label

  if (isPending) {
    content = pendingLabel
  } else if (justSaved) {
    variantClass = 'btn-save--success'
    content = (
      <>
        <span className="btn-save__icon" aria-hidden="true">
          ✓
        </span>
        {successLabel}
      </>
    )
  } else if (dirtyGated && !isDirty) {
    variantClass = 'btn-save--idle'
  }

  const sizeClass = size === 'sm' ? 'btn-sm' : ''

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} btn-save ${className}`.trim()}
      disabled={isDisabled}
      onClick={onClick}
      aria-live="polite"
    >
      {content}
    </button>
  )
}
