import { useEffect, useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useOutletContext } from 'react-router-dom'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { boreholesApi, missionsApi } from '../../api/client'
import type { SiteOutletContext } from './SiteLayout'
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
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 })
    }
  }, [map, bounds])
  return null
}

export default function SiteMapTab() {
  const { siteId, site } = useOutletContext<SiteOutletContext>()
  useFixLeafletIcons()

  const { data: missions = [] } = useQuery({
    queryKey: ['site-missions', siteId],
    queryFn: () => missionsApi.list(siteId),
  })

  const boreholeQueries = useQueries({
    queries: missions.map((m) => ({
      queryKey: ['mission-boreholes', m.id],
      queryFn: () => boreholesApi.list(m.id),
      enabled: missions.length > 0,
    })),
  })

  const markers = useMemo(() => {
    const out: Array<{
      id: number
      lat: number
      lng: number
      label: string
      missionRef: string
    }> = []
    missions.forEach((m, idx) => {
      const rows = boreholeQueries[idx]?.data ?? []
      rows.forEach((b) => {
        const lat = b.latitude != null ? Number(b.latitude) : NaN
        const lng = b.longitude != null ? Number(b.longitude) : NaN
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        out.push({
          id: b.id,
          lat,
          lng,
          label: b.code?.trim() || `Forage #${b.id}`,
          missionRef: m.reference?.trim() || `M${m.id}`,
        })
      })
    })
    return out
  }, [missions, boreholeQueries])

  const siteLat = site.latitude != null ? Number(site.latitude) : NaN
  const siteLng = site.longitude != null ? Number(site.longitude) : NaN
  const hasSiteGps = Number.isFinite(siteLat) && Number.isFinite(siteLng)

  const center: [number, number] = useMemo(() => {
    if (markers.length) {
      const sum = markers.reduce(
        (acc, m) => ({ lat: acc.lat + m.lat, lng: acc.lng + m.lng }),
        { lat: 0, lng: 0 },
      )
      return [sum.lat / markers.length, sum.lng / markers.length]
    }
    if (hasSiteGps) return [siteLat, siteLng]
    return [46.603354, 1.888334]
  }, [markers, hasSiteGps, siteLat, siteLng])

  const bounds = useMemo(() => {
    if (markers.length === 0) return null
    const b = L.latLngBounds(markers.map((m) => [m.lat, m.lng]))
    return b
  }, [markers])

  const showMap = markers.length > 0 || hasSiteGps

  return (
    <div className="site-map-panel card">
      <div className="site-map-panel__head">
        <h2 className="site-map-panel__title">Carte chantier</h2>
        <p className="site-map-panel__desc">
          Fond OpenStreetMap. Les repères viennent des forages géolocalisés (onglet Missions) ou du point GPS du chantier.
        </p>
      </div>
      {!showMap && (
        <div className="site-map-empty">
          <p>
            Aucune coordonnée : renseignez la <strong>latitude / longitude</strong> du chantier (fiche chantier) et/ou des
            forages.
          </p>
        </div>
      )}
      {showMap && (
        <div className="site-map-wrap">
          <MapContainer center={center} zoom={markers.length ? 15 : hasSiteGps ? 14 : 6} className="site-map-leaflet" scrollWheelZoom>
            <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {bounds && <FitBounds bounds={bounds} />}
            {hasSiteGps && (
              <Marker position={[siteLat, siteLng]}>
                <Popup>
                  <strong>{site.name}</strong>
                  <br />
                  Chantier (réf. carte)
                </Popup>
              </Marker>
            )}
            {markers.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lng]}>
                <Popup>
                  <strong>{m.label}</strong>
                  <br />
                  Mission {m.missionRef}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  )
}
