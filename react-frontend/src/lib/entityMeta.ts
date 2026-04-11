import type { EntityMetaPayload } from '../api/client'

export function normalizeEntityMeta(raw: unknown): EntityMetaPayload {
  if (!raw || typeof raw !== 'object') {
    return { indicateurs: {}, champs_perso: {} }
  }
  const o = raw as Record<string, unknown>
  const asMap = (v: unknown): Record<string, string> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, String(val ?? '')]),
    )
  }
  return {
    indicateurs: asMap(o.indicateurs),
    champs_perso: asMap(o.champs_perso),
  }
}

export function serializeMetaForApi(meta: EntityMetaPayload): EntityMetaPayload {
  const clean = (m: Record<string, string>) =>
    Object.fromEntries(Object.entries(m).filter(([k, v]) => k.trim() !== '' && v !== ''))
  return {
    indicateurs: clean(meta.indicateurs ?? {}),
    champs_perso: clean(meta.champs_perso ?? {}),
  }
}
