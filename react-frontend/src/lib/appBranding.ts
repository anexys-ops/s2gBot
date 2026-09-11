/** Logo S2G par défaut (public/s2g-logo.png) — servi par le frontend, fiable au chargement. */
export const DEFAULT_APP_LOGO_SRC = '/s2g-logo.png'

export const DEFAULT_APP_LOGO_ALT = 'S2G Laboratoire'

export type BrandingLogoResponse = {
  logo_url?: string | null
  logo_is_custom?: boolean
}

/**
 * Logo en-tête : asset statique sauf upload personnalisé (évite le flash / URL API cassée).
 */
export function resolveAppLogoSrc(branding?: BrandingLogoResponse | null): string {
  const url = branding?.logo_url?.trim()
  if (branding?.logo_is_custom && url) {
    return url
  }
  return DEFAULT_APP_LOGO_SRC
}
