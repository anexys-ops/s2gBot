import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { dossiersApi, sitesApi } from '../../api/client'
import SiteStatusPill from '../SiteStatusPill'
import ModuleEntityShell from '../module/ModuleEntityShell'
import { formatAppDate } from '../../lib/appLocale'
import {
  buildChantierMapItems,
  filterChantierMapItems,
  primaryDossierHref,
  siteDetailHref,
  type ChantierMapFilters,
  type ChantierMapItem,
} from '../../lib/chantiersMapItems'
import { SITE_STATUS_KEYS, SITE_STATUS_LABELS } from '../../lib/siteStatusPresentation'

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
const MAROC_CENTER: L.LatLngExpression = [31.7917, -7.0926]

function useFixLeafletIcons() {
  useEffect(() => {
    L.Marker.prototype.options.icon = L.icon({
      iconUrl: markerIcon,
      iconRetinaUrl: markerIcon2x,
      shadowUrl: markerShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })
  }, [])
}

function FitFilteredBounds({ items }: { items: ChantierMapItem[] }) {
  const map = useMap()
  useEffect(() => {
    const points = items.filter((i) => i.hasGps).map((i) => [i.lat!, i.lng!] as L.LatLngExpression)
    if (points.length === 0) {
      map.setView(MAROC_CENTER, 6)
      return
    }
    if (points.length === 1) {
      map.setView(points[0], 13)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 })
  }, [items, map])
  return null
}

function FlyToSite({ item }: { item: ChantierMapItem | null }) {
  const map = useMap()
  useEffect(() => {
    if (!item?.hasGps) return
    map.flyTo([item.lat!, item.lng!], Math.max(map.getZoom(), 14), { duration: 0.55 })
  }, [item, map])
  return null
}

type ClusterLayerProps = {
  items: ChantierMapItem[]
  selectedSiteId: number | null
  onSelect: (siteId: number) => void
  onInternalNavigate: (path: string) => void
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function MarkerClusterLayer({ items, selectedSiteId, onSelect, onInternalNavigate }: ClusterLayerProps) {
  const map = useMap()
  const groupRef = useRef<L.MarkerClusterGroup | null>(null)

  const buildPopupHtml = useCallback((item: ChantierMapItem) => {
    const d = item.primaryDossier
    const dossierLink = primaryDossierHref(item)
    const address = item.site.address?.trim() || 'Adresse non renseignée'
    return `
      <div class="chantiers-map-popup">
        <strong>${escapeHtml(item.site.name)}</strong>
        ${item.site.reference ? `<div class="chantiers-map-popup__ref">${escapeHtml(item.site.reference)}</div>` : ''}
        <div class="chantiers-map-popup__addr">${escapeHtml(address)}</div>
        ${d ? `<div class="chantiers-map-popup__dossier">Dossier <code>${escapeHtml(d.reference)}</code></div>` : ''}
        <div class="chantiers-map-popup__actions">
          ${dossierLink ? `<a href="${dossierLink}">Ouvrir le dossier →</a>` : ''}
          <a href="${siteDetailHref(item.site.id)}">Fiche chantier</a>
        </div>
      </div>
    `
  }, [])

  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 56,
      spiderfyOnMaxZoom: true,
    })
    groupRef.current = group
    map.addLayer(group)

    const onPopupOpen = (event: L.PopupEvent) => {
      const root = event.popup.getElement()
      if (!root) return
      root.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((anchor) => {
        anchor.addEventListener('click', (ev) => {
          const href = anchor.getAttribute('href')
          if (!href) return
          ev.preventDefault()
          onInternalNavigate(href)
        })
      })
    }
    map.on('popupopen', onPopupOpen)

    return () => {
      map.off('popupopen', onPopupOpen)
      map.removeLayer(group)
      groupRef.current = null
    }
  }, [map, onInternalNavigate])

  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    group.clearLayers()
    for (const item of items) {
      if (!item.hasGps) continue
      const marker = L.marker([item.lat!, item.lng!], {
        title: item.site.name,
      })
      marker.bindPopup(buildPopupHtml(item), { maxWidth: 280 })
      marker.on('click', () => onSelect(item.site.id))
      if (selectedSiteId === item.site.id) {
        marker.openPopup()
      }
      group.addLayer(marker)
    }
  }, [items, selectedSiteId, onSelect, buildPopupHtml])

  return null
}

function ChantierListCard({
  item,
  selected,
  onSelect,
  onOpen,
}: {
  item: ChantierMapItem
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}) {
  const dossierHref = primaryDossierHref(item)
  const dateLabel = item.sortDate ? formatAppDate(item.sortDate.slice(0, 10)) : '—'

  return (
    <article
      className={`chantiers-map-card${selected ? ' chantiers-map-card--selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
    >
      <div className="chantiers-map-card__head">
        <h3 className="chantiers-map-card__title">
          {dossierHref ? (
            <Link to={dossierHref} onClick={(e) => e.stopPropagation()}>
              {item.site.name}
            </Link>
          ) : (
            item.site.name
          )}
        </h3>
        <SiteStatusPill status={item.site.status} size="sm" />
      </div>
      {item.site.reference ? (
        <div className="chantiers-map-card__ref">Réf. {item.site.reference}</div>
      ) : null}
      <div className="chantiers-map-card__addr">{item.site.address?.trim() || 'Adresse non renseignée'}</div>
      <div className="chantiers-map-card__meta">
        <span>{item.site.client?.name ?? 'Client —'}</span>
        <span>{dateLabel}</span>
      </div>
      {item.primaryDossier ? (
        <div className="chantiers-map-card__dossier">
          Dossier <code>{item.primaryDossier.reference}</code>
          {item.dossiers.length > 1 ? ` (+${item.dossiers.length - 1})` : ''}
        </div>
      ) : (
        <div className="chantiers-map-card__dossier chantiers-map-card__dossier--muted">Aucun dossier lié</div>
      )}
      {!item.hasGps ? (
        <div className="chantiers-map-card__warn">Coordonnées GPS manquantes — visible dans la liste seulement</div>
      ) : null}
      <div className="chantiers-map-card__actions" onClick={(e) => e.stopPropagation()}>
        {dossierHref ? (
          <Link to={dossierHref} className="btn btn-primary btn-sm" onClick={onOpen}>
            Ouvrir le dossier
          </Link>
        ) : null}
        <Link to={siteDetailHref(item.site.id)} className="btn btn-secondary btn-sm">
          Fiche chantier
        </Link>
      </div>
    </article>
  )
}

export default function ChantiersMapExplorer() {
  useFixLeafletIcons()
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const [filters, setFilters] = useState<ChantierMapFilters>({
    search: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    gpsOnly: false,
  })
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null)

  const { data: sites = [], isLoading: loadingSites, error: sitesError } = useQuery({
    queryKey: ['sites', 'terrain-map'],
    queryFn: () => sitesApi.list(),
  })

  const { data: dossiers = [], isLoading: loadingDossiers, error: dossiersError } = useQuery({
    queryKey: ['dossiers', 'terrain-map'],
    queryFn: () => dossiersApi.list(),
  })

  const allItems = useMemo(() => buildChantierMapItems(sites, dossiers), [sites, dossiers])
  const filteredItems = useMemo(() => filterChantierMapItems(allItems, filters), [allItems, filters])
  const mapItems = useMemo(() => filteredItems.filter((i) => i.hasGps), [filteredItems])
  const selectedItem = useMemo(
    () => filteredItems.find((i) => i.site.id === selectedSiteId) ?? null,
    [filteredItems, selectedSiteId],
  )

  const handleSelect = useCallback((siteId: number) => {
    setSelectedSiteId(siteId)
    requestAnimationFrame(() => {
      const el = cardRefs.current.get(siteId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [])

  const isLoading = loadingSites || loadingDossiers
  const error = sitesError ?? dossiersError

  return (
    <ModuleEntityShell
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Terrain', to: '/terrain' },
        { label: 'Carte des chantiers' },
      ]}
      moduleBarLabel="Terrain — Carte GPS"
      title="Chantiers & carte"
      subtitle="Explorez les chantiers sur la carte, filtrez par nom ou date, puis ouvrez le dossier chantier complet."
      actions={
        <Link to="/sites" className="btn btn-secondary btn-sm">
          Liste des chantiers
        </Link>
      }
    >
      <div className="chantiers-map-explorer">
        <div className="chantiers-map-explorer__filters">
          <input
            type="search"
            className="chantiers-map-explorer__search"
            placeholder="Nom, adresse, client, référence dossier…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <label className="chantiers-map-explorer__filter">
            <span>Début ≥</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </label>
          <label className="chantiers-map-explorer__filter">
            <span>Début ≤</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </label>
          <label className="chantiers-map-explorer__filter">
            <span>Statut</span>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Tous</option>
              {SITE_STATUS_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SITE_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="chantiers-map-explorer__checkbox">
            <input
              type="checkbox"
              checked={filters.gpsOnly}
              onChange={(e) => setFilters((f) => ({ ...f, gpsOnly: e.target.checked }))}
            />
            GPS uniquement
          </label>
          <span className="chantiers-map-explorer__count">
            {isLoading ? 'Chargement…' : `${filteredItems.length} chantier(s) · ${mapItems.length} sur la carte`}
          </span>
        </div>

        {error ? <p className="error">{(error as Error).message}</p> : null}

        <div className="chantiers-map-explorer__body">
          <div className="chantiers-map-explorer__map-pane">
            <MapContainer center={MAROC_CENTER} zoom={6} className="chantiers-map-explorer__map" scrollWheelZoom>
              <TileLayer attribution={OSM_ATTR} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitFilteredBounds items={mapItems} />
              <FlyToSite item={selectedItem?.hasGps ? selectedItem : null} />
              <MarkerClusterLayer
                items={mapItems}
                selectedSiteId={selectedSiteId}
                onSelect={handleSelect}
                onInternalNavigate={navigate}
              />
            </MapContainer>
            {!isLoading && mapItems.length === 0 ? (
              <div className="chantiers-map-explorer__map-empty">
                <p>Aucun chantier géolocalisé pour ces filtres.</p>
                <p className="text-muted">
                  Renseignez latitude / longitude dans la fiche chantier ou élargissez les filtres.
                </p>
              </div>
            ) : null}
          </div>

          <aside className="chantiers-map-explorer__list-pane" ref={listRef}>
            {filteredItems.length === 0 && !isLoading ? (
              <p className="chantiers-map-explorer__list-empty">Aucun chantier ne correspond aux filtres.</p>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.site.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(item.site.id, el)
                    else cardRefs.current.delete(item.site.id)
                  }}
                >
                  <ChantierListCard
                    item={item}
                    selected={selectedSiteId === item.site.id}
                    onSelect={() => handleSelect(item.site.id)}
                    onOpen={() => {
                      const href = primaryDossierHref(item)
                      if (href) navigate(href)
                    }}
                  />
                </div>
              ))
            )}
          </aside>
        </div>
      </div>
    </ModuleEntityShell>
  )
}
