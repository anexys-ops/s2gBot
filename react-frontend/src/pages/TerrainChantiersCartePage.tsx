import { useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { sitesApi, type Site } from '../api/client'
import PageBackNav from '../components/PageBackNav'
import 'leaflet/dist/leaflet.css'

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

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    } else {
      map.setView([46.5, 2.5], 6)
    }
  }, [map, bounds])
  return null
}

function parseCoord(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export default function TerrainChantiersCartePage() {
  useFixLeafletIcons()
  const { data: sites = [], isLoading, error } = useQuery({
    queryKey: ['sites', 'terrain-map'],
    queryFn: () => sitesApi.list(),
  })

  const markers = useMemo(() => {
    const out: Array<{ site: Site; lat: number; lng: number }> = []
    for (const s of sites) {
      const lat = parseCoord(s.latitude)
      const lng = parseCoord(s.longitude)
      if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        out.push({ site: s, lat, lng })
      }
    }
    return out
  }, [sites])

  const bounds = useMemo(() => {
    if (markers.length === 0) return null
    const b = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as L.LatLngExpression))
    return b.isValid() ? b : null
  }, [markers])

  return (
    <div>
      <PageBackNav back={{ to: '/terrain', label: 'Terrain' }} />
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h1 style={{ marginTop: 0 }}>Chantiers &amp; carte</h1>
        <p style={{ color: 'var(--color-muted)', marginBottom: 0, lineHeight: 1.5 }}>
          Carte des chantiers disposant de latitude / longitude. Éditez une fiche chantier pour renseigner les
          coordonnées GPS.
        </p>
      </div>
      {isLoading ? <p>Chargement…</p> : null}
      {error ? <p className="error">{(error as Error).message}</p> : null}
      <div className="card terrain-chantiers-map-wrap">
        <MapContainer center={[46.5, 2.5]} zoom={6} className="terrain-chantiers-map" scrollWheelZoom>
          <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds bounds={bounds} />
          {markers.map((m) => (
            <Marker key={m.site.id} position={[m.lat, m.lng]}>
              <Popup>
                <strong>{m.site.name}</strong>
                <div style={{ marginTop: 6 }}>
                  <Link to={`/sites/${m.site.id}`}>Ouvrir la fiche</Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Liste</h2>
        <table>
          <thead>
            <tr>
              <th>Chantier</th>
              <th>Coordonnées</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => {
              const lat = parseCoord(s.latitude)
              const lng = parseCoord(s.longitude)
              const ok = lat !== null && lng !== null
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    {ok ? (
                      <code>
                        {lat.toFixed(5)}, {lng.toFixed(5)}
                      </code>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <Link to={`/sites/${s.id}`}>Fiche</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
