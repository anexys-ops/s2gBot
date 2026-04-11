import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
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

type Props = {
  siteId: number
  siteName: string
  latitude: number
  longitude: number
}

/** Carte GPS compacte sur la fiche chantier ; lien vers l’onglet Carte plein écran. */
export default function SiteMiniMap({ siteId, siteName, latitude, longitude }: Props) {
  useFixLeafletIcons()
  const center: [number, number] = [latitude, longitude]

  return (
    <div className="card site-mini-map-card">
      <div className="site-mini-map-card__head">
        <h2 className="site-mini-map-card__title">Carte GPS</h2>
        <Link to={`/sites/${siteId}/carte`} className="site-mini-map-card__link">
          Agrandir (missions & forages)
        </Link>
      </div>
      <div className="site-mini-map-wrap">
        <MapContainer center={center} zoom={15} className="site-mini-map-leaflet" scrollWheelZoom={false}>
          <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={center}>
            <Popup>
              <strong>{siteName}</strong>
              <br />
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  )
}
