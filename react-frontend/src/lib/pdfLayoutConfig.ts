import type { PdfLayoutConfig } from '../api/client'

export type PdfLayoutExtraFieldType = 'text' | 'image'

export interface PdfLayoutExtraFieldRow {
  /** Identifiant technique (formData / rapport). */
  key: string
  /** Libellé affiché sur le PDF. */
  label: string
  type: PdfLayoutExtraFieldType
}

export interface PdfLayoutConfigForm {
  export_pdf: boolean
  export_docx: boolean
  header: {
    show_logo: boolean
    show_signature_block: boolean
    photo_slots: number
    /** Sous-titre optionnel sous le logo. */
    subtitle: string
  }
  extra_fields: PdfLayoutExtraFieldRow[]
}

function clampPhotoSlots(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(3, Math.max(0, Math.round(n)))
}

/** Normalise la réponse API (partielle) vers le formulaire. */
export function layoutConfigToForm(raw: PdfLayoutConfig | undefined | null): PdfLayoutConfigForm {
  const r = raw ?? {}
  const h = (r.header as Record<string, unknown> | undefined) ?? {}
  const rawFields = r.extra_fields
  const fields: PdfLayoutExtraFieldRow[] = Array.isArray(rawFields)
    ? rawFields
        .map((row) => {
          if (!row || typeof row !== 'object') return null
          const o = row as Record<string, unknown>
          const key = typeof o.key === 'string' ? o.key.trim() : ''
          const label = typeof o.label === 'string' ? o.label.trim() : ''
          const type = o.type === 'image' ? 'image' : 'text'
          return { key, label, type } as PdfLayoutExtraFieldRow
        })
        .filter((x): x is PdfLayoutExtraFieldRow => x !== null)
    : []

  return {
    export_pdf: r.export_pdf !== false,
    export_docx: Boolean(r.export_docx),
    header: {
      show_logo: h.show_logo !== false,
      show_signature_block: h.show_signature_block !== false,
      photo_slots: clampPhotoSlots(Number(h.photo_slots)),
      subtitle: typeof h.subtitle === 'string' ? h.subtitle : '',
    },
    extra_fields: fields,
  }
}

/** Payload envoyé à l’API (fusionné côté Laravel avec les défauts). */
export function formToLayoutConfigPayload(form: PdfLayoutConfigForm): PdfLayoutConfig {
  const header: Record<string, unknown> = {
    show_logo: form.header.show_logo,
    show_signature_block: form.header.show_signature_block,
    photo_slots: form.header.photo_slots,
  }
  const st = form.header.subtitle.trim()
  if (st !== '') {
    header.subtitle = st
  }

  const extra_fields = form.extra_fields
    .filter((f) => f.key.trim() !== '' && f.label.trim() !== '')
    .map((f) => ({
      key: f.key.trim(),
      label: f.label.trim(),
      type: f.type,
    }))

  return {
    export_pdf: form.export_pdf,
    export_docx: form.export_docx,
    header,
    extra_fields,
  }
}

const KEY_RE = /^[a-z][a-z0-9_]{0,63}$/i

export function validateLayoutForm(form: PdfLayoutConfigForm): string | null {
  const keys = new Set<string>()
  for (const f of form.extra_fields) {
    const k = f.key.trim()
    const lab = f.label.trim()
    if (k === '' && lab !== '') {
      return 'Chaque ligne avec un libellé doit avoir une clé technique, ou supprimez la ligne.'
    }
    if (k === '') continue
    if (!KEY_RE.test(k)) {
      return `Clé technique invalide pour « ${f.label.trim() || k} » : utilisez lettres, chiffres, underscore (ex. zone_prelevement).`
    }
    const lower = k.toLowerCase()
    if (keys.has(lower)) {
      return `La clé « ${k} » est dupliquée.`
    }
    keys.add(lower)
    if (f.label.trim() === '') {
      return `Renseignez le libellé pour la clé « ${k} ».`
    }
  }
  return null
}

export function emptyExtraField(): PdfLayoutExtraFieldRow {
  return { key: '', label: '', type: 'text' }
}
