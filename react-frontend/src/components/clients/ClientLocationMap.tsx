import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import type { Client } from '../../api/client'

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'

/** Centre Maroc (vue par défaut si pas de résultat géocode). */
const DEFAULT_CENTER: [number, number] = [32.5, -6.5]
const DEFAULT_ZOOM = 5.5

/** Délai entre appels Nominatim (politique d’usage ~1 req/s). */
const NOMINATIM_GAP_MS = 1100

function useFixLeafletIcons() {
  useEffect(() => {
    const icon = L.icon({
      iconUrl: markerIcon,
      iconRetinaUrl: markerIcon2x,
      shadowUrl: markerShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })
    L.Marker.prototype.options.icon = icon
  }, [])
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Évite de répéter CP / ville déjà présents dans le texte d’adresse (ex. adresse déjà « … casablanca 20000 »). */
function wordBoundaryContains(haystack: string, needle: string): boolean {
  if (!needle.trim()) return true
  const re = new RegExp(`\\b${escapeRegex(needle.trim())}\\b`, 'i')
  return re.test(haystack)
}

/** Première ligne de recherche libre, sans doublons CP/ville. */
function buildDedupedFreeform(c: Client): string | null {
  const addr = c.address?.trim() ?? ''
  const pc = c.postal_code?.trim() ?? ''
  const city = c.city?.trim() ?? ''
  const addrForMatch = addr.toLowerCase()

  const extras: string[] = []
  if (pc && !wordBoundaryContains(addrForMatch, pc)) extras.push(pc)
  if (city && !wordBoundaryContains(addrForMatch, city)) extras.push(city)

  const parts: string[] = []
  if (addr) parts.push(addr)
  parts.push(...extras)

  if (parts.length === 0) {
    if (pc && city) return `${city} ${pc}, Morocco`
    if (city) return `${city}, Morocco`
    if (pc) return `${pc}, Morocco`
    return null
  }

  // « Morocco » est souvent mieux reconnu par Nominatim que « Maroc » pour le pays
  return `${parts.join(', ')}, Morocco`
}

function formatAddressLines(c: Client): string[] {
  const line1 = [c.address?.trim(), [c.postal_code, c.city].filter(Boolean).join(' ').trim()]
    .filter(Boolean)
    .join(' — ')
  return line1 ? [line1] : []
}

type GeocodeHit = { lat: number; lon: number; display_name?: string }

function MapViewSync({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate: true })
  }, [map, center[0], center[1], zoom])
  return null
}

async function parseNominatimResponse(r: Response): Promise<GeocodeHit | null> {
  if (!r.ok) return null
  const data: unknown = await r.json()
  if (!Array.isArray(data) || data.length === 0) return null
  const row = data[0] as { lat?: string; lon?: string; display_name?: string }
  const lat = Number(row.lat)
  const lon = Number(row.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon, display_name: row.display_name }
}

async function fetchNominatimFreeform(q: string, countrycodesMa: boolean): Promise<GeocodeHit | null> {
  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    q,
  })
  if (countrycodesMa) params.set('countrycodes', 'ma')
  const url = `https://nominatim.openstreetmap.org/search?${params}`
  const r = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'fr',
      'User-Agent': 's2gBot-LabBTP-Frontend/1.0 (fiche client)',
    },
  })
  return parseNominatimResponse(r)
}

/** Recherche structurée (rue / ville / CP) — mieux adaptée aux adresses composées. */
async function fetchNominatimStructured(c: Client): Promise<GeocodeHit | null> {
  const raw = c.address?.trim() ?? ''
  const city = c.city?.trim() ?? ''
  const postalcode = c.postal_code?.trim() ?? ''
  const street = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
  if (!street && !city) return null

  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    countrycodes: 'ma',
  })
  if (street) params.set('street', street)
  if (city) params.set('city', city)
  if (postalcode) params.set('postalcode', postalcode)

  const url = `https://nominatim.openstreetmap.org/search?${params}`
  const r = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'fr',
      'User-Agent': 's2gBot-LabBTP-Frontend/1.0 (fiche client)',
    },
  })
  return parseNominatimResponse(r)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Plusieurs stratégies : adresse dédoublonnée, sans filtre pays, structurée, puis centre-ville.
 */
async function geocodeClientAddress(c: Client): Promise<GeocodeHit | null> {
  const city = c.city?.trim() ?? ''
  const pc = c.postal_code?.trim() ?? ''

  const primary = buildDedupedFreeform(c)
  if (primary) {
    const h1 = await fetchNominatimFreeform(primary, true)
    if (h1) return h1
    await sleep(NOMINATIM_GAP_MS)
    const h2 = await fetchNominatimFreeform(primary, false)
    if (h2) return h2
    await sleep(NOMINATIM_GAP_MS)
  }

  const h3 = await fetchNominatimStructured(c)
  if (h3) return h3
  await sleep(NOMINATIM_GAP_MS)

  if (city && pc) {
    const h4 = await fetchNominatimFreeform(`${city} ${pc}, Morocco`, true)
    if (h4) return h4
    await sleep(NOMINATIM_GAP_MS)
  }

  if (city) {
    const h5 = await fetchNominatimFreeform(`${city}, Morocco`, true)
    if (h5) return h5
    await sleep(NOMINATIM_GAP_MS)
    return fetchNominatimFreeform(`${city}, Morocco`, false)
  }

  return null
}

/** Clé stable + libellé pour le cache (résumé de ce qui est géocodé). */
function geocodeCacheKey(c: Client): string | null {
  const q = buildDedupedFreeform(c)
  if (q) return q
  const city = c.city?.trim()
  const pc = c.postal_code?.trim()
  if (city && pc) return `${city}|${pc}`
  if (city) return city
  if (pc) return pc
  return null
}

type Props = { client: Client }

export default function ClientLocationMap({ client }: Props) {
  useFixLeafletIcons()
  const cacheKey = useMemo(() => geocodeCacheKey(client), [client])

  const { data: hit, isLoading, isError } = useQuery({
    queryKey: ['nominatim-client', client.id, cacheKey],
    queryFn: () => geocodeClientAddress(client),
    enabled: !!cacheKey && cacheKey.length >= 2,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const center: [number, number] = hit ? [hit.lat, hit.lon] : DEFAULT_CENTER
  const zoom = hit ? 15 : DEFAULT_ZOOM
  const lines = formatAddressLines(client)
  const mapsQuery = buildDedupedFreeform(client) ?? cacheKey ?? ''
  const mapsHref = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : undefined

  return (
    <div className="card client-location-map-card">
      <h2 className="client-location-map-card__title">Localisation</h2>
      {lines.length > 0 && (
        <p className="client-location-map-card__address">{lines[0]}</p>
      )}
      {!cacheKey && (
        <p className="client-location-map-card__hint">
          Renseignez l’adresse, le code postal ou la ville sur la <strong>Fiche</strong> du client pour afficher la carte.
        </p>
      )}
      {cacheKey && isLoading && <p className="client-location-map-card__hint">Recherche de la position…</p>}
      {cacheKey && !isLoading && isError && (
        <p className="client-location-map-card__hint">Impossible de géolocaliser cette adresse pour le moment.</p>
      )}
      {cacheKey && !isLoading && !hit && !isError && (
        <p className="client-location-map-card__hint">
          Adresse introuvable dans OpenStreetMap (orthographe du quartier / rue, ou données locales incomplètes). La carte
          affiche le Maroc ; utilisez le lien ci-dessous pour une recherche dans Google Maps.
        </p>
      )}
      <div className="client-location-map-wrap">
        <MapContainer center={center} zoom={zoom} className="client-location-map-leaflet" scrollWheelZoom={false}>
          <MapViewSync center={center} zoom={zoom} />
          <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {hit && (
            <Marker position={[hit.lat, hit.lon]}>
              <Popup>
                <strong>{client.name}</strong>
                {hit.display_name && (
                  <>
                    <br />
                    <span style={{ fontSize: '0.85rem' }}>{hit.display_name}</span>
                  </>
                )}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      {mapsHref && (
        <a className="client-location-map-card__link" href={mapsHref} target="_blank" rel="noreferrer">
          Ouvrir dans Google Maps
        </a>
      )}
    </div>
  )
}
