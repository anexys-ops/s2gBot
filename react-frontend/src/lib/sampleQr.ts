/** Extrait FOLD ou transco depuis le contenu scanné (QR compact ou ancien JSON). */
export function parseSampleQrContent(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null

  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(text) as { fold?: string | null; transco?: string | null }
      const code = data.fold ?? data.transco
      return code?.trim() || null
    } catch {
      return null
    }
  }

  const foldMatch = text.match(/FOLD-\d+/i)
  if (foldMatch) return foldMatch[0].toUpperCase()

  const s2gMatch = text.match(/^s2g:sample:([A-Z0-9-]+)$/i)
  if (s2gMatch) return s2gMatch[1].toUpperCase()

  if (/^\d{8,}$/.test(text)) return text

  return text.length >= 3 ? text : null
}
