/**
 * ClientsMapPage
 *
 * Vue carte de tous les clients qui ont des coordonnées GPS.
 * Filtres :
 *  - Commercial S2G assigné (select)
 *  - Recherche texte (nom, ville)
 *
 * Leaflet est déjà une dépendance du projet.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { clientsApi, adminUsersApi, type Client } from '../../api/client'

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'

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

/** Recentre la carte dynamiquement sur les bounds des clients visibles */
function MapBoundsUpdater({ clients }: { clients: Client[] }) {
  const map = useMap()
  useEffect(() => {
    const points = clients
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => [c.lat!, c.lng!] as [number, number])
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 10)
    } else {
      map.fitBounds(points, { padding: [40, 40] })
    }
  }, [clients, map])
  return null
}

const MAROC_CENTER: [number, number] = [31.7917, -7.0926]

export default function ClientsMapPage() {
  useFixLeafletIcons()

  const [search, setSearch] = useState('')
  const [commercialFilter, setCommercialFilter] = useState<number | ''>('')

  // Tous les clients avec GPS
  const { data: allClients = [], isLoading } = useQuery({
    queryKey: ['clients-map'],
    queryFn: () => clientsApi.list({ with_gps: true }),
    staleTime: 3 * 60 * 1000,
  })

  // Liste des commerciaux S2G (extraits des clients chargés)
  const commerciaux = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of allClients) {
      if (c.commercial_id && c.commercial?.name) {
        map.set(c.commercial_id, c.commercial.name)
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [allClients])

  // Filtrage
  const filtered = useMemo(() => {
    let list = allClients
    if (commercialFilter) {
      list = list.filter((c) => c.commercial_id === commercialFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.city ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [allClients, commercialFilter, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Barre de filtres */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <input
          type="search"
          placeholder="Rechercher un client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', maxWidth: 280 }}
        />
        <select
          value={commercialFilter}
          onChange={(e) => setCommercialFilter(e.target.value ? Number(e.target.value) : '')}
          style={{ flex: '1 1 180px', maxWidth: 220 }}
        >
          <option value="">— Tous les commerciaux —</option>
          {commerciaux.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <span className="text-muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          {isLoading ? 'Chargement…' : `${filtered.length} client${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''}`}
        </span>
        <Link to="/clients" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
          Vue liste
        </Link>
      </div>

      {/* Légende par commercial */}
      {commerciaux.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
            fontSize: '0.82rem',
          }}
        >
          {commerciaux.map(([id, name]) => {
            const count = allClients.filter((c) => c.commercial_id === id).length
            return (
              <button
                key={id}
                onClick={() => setCommercialFilter(commercialFilter === id ? '' : id)}
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: 20,
                  border: '1px solid var(--color-border)',
                  background: commercialFilter === id ? 'var(--color-primary)' : 'var(--color-background)',
                  color: commercialFilter === id ? '#fff' : 'inherit',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                }}
              >
                {name} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Carte Leaflet */}
      <div style={{ flex: 1, minHeight: 400 }}>
        <MapContainer
          center={MAROC_CENTER}
          zoom={6}
          style={{ height: '100%', width: '100%', minHeight: 400 }}
          scrollWheelZoom
        >
          <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapBoundsUpdater clients={filtered} />
          {filtered
            .filter((c) => c.lat != null && c.lng != null)
            .map((c) => (
              <Marker key={c.id} position={[c.lat!, c.lng!]}>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong style={{ fontSize: '0.95rem' }}>{c.name}</strong>
                    {c.city && (
                      <div style={{ color: '#666', fontSize: '0.85rem', marginTop: 2 }}>{c.city}</div>
                    )}
                    {c.commercial?.name && (
                      <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                        <span style={{ color: '#888' }}>Commercial :</span> {c.commercial.name}
                      </div>
                    )}
                    {c.phone && (
                      <div style={{ fontSize: '0.82rem' }}>
                        <a href={`tel:${c.phone}`}>{c.phone}</a>
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <a
                        href={`/clients/${c.id}`}
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          background: 'var(--color-primary, #2563eb)',
                          color: '#fff',
                          borderRadius: 4,
                          textDecoration: 'none',
                          fontSize: '0.82rem',
                        }}
                      >
                        Ouvrir la fiche →
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* Message si aucun client avec GPS */}
      {!isLoading && filtered.filter((c) => c.lat && c.lng).length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.9)',
            padding: '1.5rem 2rem',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <p className="text-muted">Aucun client avec coordonnées GPS.</p>
          <p style={{ fontSize: '0.85rem', color: '#888' }}>
            Ajoutez la latitude / longitude dans la fiche client pour voir le client sur la carte.
          </p>
        </div>
      )}
    </div>
  )
}
