import { useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  boreholesApi,
  lithologyLayersApi,
  missionsApi,
  type Borehole,
  type LithologyLayer,
  type EntityMetaPayload,
  type Mission,
} from '../../api/client'
import EntityMetaCard from '../../components/module/EntityMetaCard'
import Modal from '../../components/Modal'
import { useOutletContext } from 'react-router-dom'
import type { SiteOutletContext } from './SiteLayout'

const MISSION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'g1', label: 'G1 — Étude de sol' },
  { value: 'g2', label: 'G2 — Avant-projet' },
  { value: 'g3', label: 'G3 — Projet' },
  { value: 'g4', label: 'G4 — Dossier de consultation' },
  { value: 'g5', label: 'G5 — Assistance travaux' },
]

function missionStatusLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return MISSION_STATUS_OPTIONS.find((o) => o.value === code)?.label ?? code
}

function numOrEmpty(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

function parseOptNumber(s: string): number | undefined {
  const t = s.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

type MissionFormState = {
  reference: string
  title: string
  mission_status: string
  maitre_ouvrage_name: string
  maitre_ouvrage_email: string
  maitre_ouvrage_phone: string
  notes: string
}

function missionToForm(m: Mission): MissionFormState {
  return {
    reference: m.reference ?? '',
    title: m.title ?? '',
    mission_status: m.mission_status ?? 'g1',
    maitre_ouvrage_name: m.maitre_ouvrage_name ?? '',
    maitre_ouvrage_email: m.maitre_ouvrage_email ?? '',
    maitre_ouvrage_phone: m.maitre_ouvrage_phone ?? '',
    notes: m.notes ?? '',
  }
}

const emptyMissionForm = (): MissionFormState => ({
  reference: '',
  title: '',
  mission_status: 'g1',
  maitre_ouvrage_name: '',
  maitre_ouvrage_email: '',
  maitre_ouvrage_phone: '',
  notes: '',
})

type BoreholeFormState = {
  code: string
  latitude: string
  longitude: string
  ground_level_m: string
  notes: string
}

function boreholeToForm(b: Borehole): BoreholeFormState {
  return {
    code: b.code ?? '',
    latitude: numOrEmpty(b.latitude),
    longitude: numOrEmpty(b.longitude),
    ground_level_m: numOrEmpty(b.ground_level_m),
    notes: b.notes ?? '',
  }
}

const emptyBoreholeForm = (): BoreholeFormState => ({
  code: '',
  latitude: '',
  longitude: '',
  ground_level_m: '',
  notes: '',
})

type LayerFormState = {
  depth_from_m: string
  depth_to_m: string
  description: string
  rqd: string
  sort_order: string
}

function layerToForm(l: LithologyLayer): LayerFormState {
  return {
    depth_from_m: numOrEmpty(l.depth_from_m),
    depth_to_m: numOrEmpty(l.depth_to_m),
    description: l.description ?? '',
    rqd: numOrEmpty(l.rqd),
    sort_order: l.sort_order != null ? String(l.sort_order) : '',
  }
}

const emptyLayerForm = (): LayerFormState => ({
  depth_from_m: '',
  depth_to_m: '',
  description: '',
  rqd: '',
  sort_order: '',
})

export default function SiteMissionsTab() {
  const { siteId, isAdmin } = useOutletContext<SiteOutletContext>()
  const queryClient = useQueryClient()
  const [expandedMissions, setExpandedMissions] = useState<Set<number>>(() => new Set())
  const [expandedBoreholes, setExpandedBoreholes] = useState<Set<number>>(() => new Set())

  const [missionModal, setMissionModal] = useState<{ mode: 'create' } | { mode: 'edit'; mission: Mission } | null>(null)
  const [missionForm, setMissionForm] = useState<MissionFormState>(emptyMissionForm)

  const [boreholeModal, setBoreholeModal] = useState<
    { mode: 'create'; missionId: number } | { mode: 'edit'; borehole: Borehole } | null
  >(null)
  const [boreholeForm, setBoreholeForm] = useState<BoreholeFormState>(emptyBoreholeForm)

  const [layerModal, setLayerModal] = useState<
    { mode: 'create'; boreholeId: number } | { mode: 'edit'; layer: LithologyLayer } | null
  >(null)
  const [layerForm, setLayerForm] = useState<LayerFormState>(emptyLayerForm)

  const { data: missions = [], isLoading, error } = useQuery({
    queryKey: ['site-missions', siteId],
    queryFn: () => missionsApi.list(siteId),
  })

  const boreholeQueries = useQueries({
    queries: missions.map((m) => ({
      queryKey: ['mission-boreholes', m.id],
      queryFn: () => boreholesApi.list(m.id),
      enabled: expandedMissions.has(m.id),
    })),
  })

  const boreholesByMissionId = useMemo(() => {
    const map = new Map<number, Borehole[]>()
    missions.forEach((m, i) => {
      const q = boreholeQueries[i]
      if (q?.data) map.set(m.id, q.data)
    })
    return map
  }, [missions, boreholeQueries])

  const allExpandedBoreholeIds = useMemo(() => {
    const ids: number[] = []
    for (const m of missions) {
      if (!expandedMissions.has(m.id)) continue
      const list = boreholesByMissionId.get(m.id) ?? []
      for (const b of list) {
        if (expandedBoreholes.has(b.id)) ids.push(b.id)
      }
    }
    return ids
  }, [missions, expandedMissions, expandedBoreholes, boreholesByMissionId])

  const layerQueries = useQueries({
    queries: allExpandedBoreholeIds.map((bid) => ({
      queryKey: ['borehole-layers', bid],
      queryFn: () => lithologyLayersApi.list(bid),
      enabled: true,
    })),
  })

  const layersByBoreholeId = useMemo(() => {
    const map = new Map<number, LithologyLayer[]>()
    allExpandedBoreholeIds.forEach((bid, i) => {
      const q = layerQueries[i]
      if (q?.data) {
        const sorted = [...q.data].sort((a, b) => {
          const so = (a.sort_order ?? 0) - (b.sort_order ?? 0)
          if (so !== 0) return so
          return Number(a.depth_from_m ?? 0) - Number(b.depth_from_m ?? 0)
        })
        map.set(bid, sorted)
      }
    })
    return map
  }, [allExpandedBoreholeIds, layerQueries])

  const invalidateMissions = () => queryClient.invalidateQueries({ queryKey: ['site-missions', siteId] })

  const missionCreateMut = useMutation({
    mutationFn: () =>
      missionsApi.create(siteId, {
        reference: missionForm.reference || undefined,
        title: missionForm.title || undefined,
        mission_status: missionForm.mission_status || undefined,
        maitre_ouvrage_name: missionForm.maitre_ouvrage_name || undefined,
        maitre_ouvrage_email: missionForm.maitre_ouvrage_email || undefined,
        maitre_ouvrage_phone: missionForm.maitre_ouvrage_phone || undefined,
        notes: missionForm.notes || undefined,
      }),
    onSuccess: () => {
      invalidateMissions()
      setMissionModal(null)
    },
  })

  const missionUpdateMut = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      missionsApi.update(id, {
        reference: missionForm.reference || undefined,
        title: missionForm.title || undefined,
        mission_status: missionForm.mission_status || undefined,
        maitre_ouvrage_name: missionForm.maitre_ouvrage_name || undefined,
        maitre_ouvrage_email: missionForm.maitre_ouvrage_email || undefined,
        maitre_ouvrage_phone: missionForm.maitre_ouvrage_phone || undefined,
        notes: missionForm.notes || undefined,
      }),
    onSuccess: () => {
      invalidateMissions()
      setMissionModal(null)
    },
  })

  const missionMetaMut = useMutation({
    mutationFn: ({ id, meta }: { id: number; meta: EntityMetaPayload }) => missionsApi.update(id, { meta }),
    onSuccess: (updated, variables) => {
      invalidateMissions()
      setMissionModal((prev) =>
        prev?.mode === 'edit' && prev.mission.id === variables.id ? { mode: 'edit', mission: updated } : prev,
      )
    },
  })

  const missionDeleteMut = useMutation({
    mutationFn: (id: number) => missionsApi.delete(id),
    onSuccess: (_data, deletedId) => {
      invalidateMissions()
      setExpandedMissions((prev) => {
        const next = new Set(prev)
        next.delete(deletedId)
        return next
      })
    },
  })

  const boreholeCreateMut = useMutation({
    mutationFn: (missionId: number) =>
      boreholesApi.create(missionId, {
        code: boreholeForm.code || undefined,
        latitude: parseOptNumber(boreholeForm.latitude),
        longitude: parseOptNumber(boreholeForm.longitude),
        ground_level_m: parseOptNumber(boreholeForm.ground_level_m),
        notes: boreholeForm.notes || undefined,
      }),
    onSuccess: (_d, missionId) => {
      queryClient.invalidateQueries({ queryKey: ['mission-boreholes', missionId] })
      setBoreholeModal(null)
    },
  })

  const boreholeUpdateMut = useMutation({
    mutationFn: (b: Borehole) =>
      boreholesApi.update(b.id, {
        code: boreholeForm.code || undefined,
        latitude: parseOptNumber(boreholeForm.latitude),
        longitude: parseOptNumber(boreholeForm.longitude),
        ground_level_m: parseOptNumber(boreholeForm.ground_level_m),
        notes: boreholeForm.notes || undefined,
      }),
    onSuccess: (_d, b) => {
      queryClient.invalidateQueries({ queryKey: ['mission-boreholes', b.mission_id] })
      setBoreholeModal(null)
    },
  })

  const boreholeDeleteMut = useMutation({
    mutationFn: (b: Borehole) => boreholesApi.delete(b.id),
    onSuccess: (_d, b) => {
      queryClient.invalidateQueries({ queryKey: ['mission-boreholes', b.mission_id] })
      setExpandedBoreholes((prev) => {
        const next = new Set(prev)
        next.delete(b.id)
        return next
      })
    },
  })

  const layerCreateMut = useMutation({
    mutationFn: (boreholeId: number) =>
      lithologyLayersApi.create(boreholeId, {
        depth_from_m: parseOptNumber(layerForm.depth_from_m),
        depth_to_m: parseOptNumber(layerForm.depth_to_m),
        description: layerForm.description || undefined,
        rqd: parseOptNumber(layerForm.rqd),
        sort_order: layerForm.sort_order.trim() === '' ? undefined : parseInt(layerForm.sort_order, 10),
      }),
    onSuccess: (_d, boreholeId) => {
      queryClient.invalidateQueries({ queryKey: ['borehole-layers', boreholeId] })
      setLayerModal(null)
    },
  })

  const layerUpdateMut = useMutation({
    mutationFn: (layer: LithologyLayer) =>
      lithologyLayersApi.update(layer.id, {
        depth_from_m: parseOptNumber(layerForm.depth_from_m),
        depth_to_m: parseOptNumber(layerForm.depth_to_m),
        description: layerForm.description || undefined,
        rqd: parseOptNumber(layerForm.rqd),
        sort_order: layerForm.sort_order.trim() === '' ? undefined : parseInt(layerForm.sort_order, 10),
      }),
    onSuccess: (_d, layer) => {
      queryClient.invalidateQueries({ queryKey: ['borehole-layers', layer.borehole_id] })
      setLayerModal(null)
    },
  })

  const layerDeleteMut = useMutation({
    mutationFn: (layer: LithologyLayer) => lithologyLayersApi.delete(layer.id),
    onSuccess: (_d, layer) => {
      queryClient.invalidateQueries({ queryKey: ['borehole-layers', layer.borehole_id] })
    },
  })

  const toggleMission = (id: number) => {
    setExpandedMissions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleBorehole = (id: number) => {
    setExpandedBoreholes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCreateMission = () => {
    setMissionForm(emptyMissionForm())
    setMissionModal({ mode: 'create' })
  }

  const openEditMission = (m: Mission) => {
    setMissionForm(missionToForm(m))
    setMissionModal({ mode: 'edit', mission: m })
  }

  const submitMission = (e: React.FormEvent) => {
    e.preventDefault()
    if (missionModal?.mode === 'create') missionCreateMut.mutate()
    else if (missionModal?.mode === 'edit') missionUpdateMut.mutate({ id: missionModal.mission.id })
  }

  const openCreateBorehole = (missionId: number) => {
    setBoreholeForm(emptyBoreholeForm())
    setBoreholeModal({ mode: 'create', missionId })
  }

  const openEditBorehole = (b: Borehole) => {
    setBoreholeForm(boreholeToForm(b))
    setBoreholeModal({ mode: 'edit', borehole: b })
  }

  const submitBorehole = (e: React.FormEvent) => {
    e.preventDefault()
    if (boreholeModal?.mode === 'create') boreholeCreateMut.mutate(boreholeModal.missionId)
    else if (boreholeModal?.mode === 'edit') boreholeUpdateMut.mutate(boreholeModal.borehole)
  }

  const openCreateLayer = (boreholeId: number) => {
    setLayerForm(emptyLayerForm())
    setLayerModal({ mode: 'create', boreholeId })
  }

  const openEditLayer = (layer: LithologyLayer) => {
    setLayerForm(layerToForm(layer))
    setLayerModal({ mode: 'edit', layer })
  }

  const submitLayer = (e: React.FormEvent) => {
    e.preventDefault()
    if (layerModal?.mode === 'create') layerCreateMut.mutate(layerModal.boreholeId)
    else if (layerModal?.mode === 'edit') layerUpdateMut.mutate(layerModal.layer)
  }

  if (isLoading) return <p>Chargement des missions…</p>
  if (error) return <p className="error">{(error as Error).message}</p>

  return (
    <>
      <div className="card">
        <div className="crud-actions" style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, flex: 1 }}>Missions terrain & forages</h2>
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateMission}>
              Nouvelle mission
            </button>
          )}
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted, #64748b)', marginTop: 0 }}>
          Gestion des missions géotechniques, forages et couches de lithologie pour ce chantier.
        </p>

        {missions.length === 0 ? (
          <p>Aucune mission enregistrée.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {missions.map((m, mi) => {
              const open = expandedMissions.has(m.id)
              const boreholes = boreholesByMissionId.get(m.id)
              const bhLoading = open && boreholes === undefined && boreholeQueries[mi]?.isLoading

              return (
                <li
                  key={m.id}
                  style={{
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: 8,
                    marginBottom: '0.75rem',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      background: 'var(--surface-2, #f8fafc)',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleMission(m.id)}
                      aria-expanded={open}
                    >
                      {open ? '▼' : '▶'}
                    </button>
                    <strong>{m.title?.trim() || `Mission #${m.id}`}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted, #64748b)' }}>
                      {m.reference?.trim() ? `Réf. ${m.reference}` : ''} · {missionStatusLabel(m.mission_status)}
                    </span>
                    <span style={{ flex: 1 }} />
                    {isAdmin && (
                      <div className="crud-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditMission(m)}>
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => {
                            if (window.confirm('Supprimer cette mission et ses forages ?')) missionDeleteMut.mutate(m.id)
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                  {open && (
                    <div style={{ padding: '0.75rem 1rem' }}>
                      {m.maitre_ouvrage_name || m.maitre_ouvrage_email || m.maitre_ouvrage_phone ? (
                        <p style={{ fontSize: '0.9rem', marginTop: 0 }}>
                          Maître d&apos;ouvrage : {m.maitre_ouvrage_name ?? '—'}
                          {m.maitre_ouvrage_email ? ` · ${m.maitre_ouvrage_email}` : ''}
                          {m.maitre_ouvrage_phone ? ` · ${m.maitre_ouvrage_phone}` : ''}
                        </p>
                      ) : null}
                      {m.notes?.trim() ? (
                        <p style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{m.notes}</p>
                      ) : null}

                      <div className="crud-actions" style={{ marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Forages</h3>
                        {isAdmin && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCreateBorehole(m.id)}>
                            + Forage
                          </button>
                        )}
                      </div>
                      {bhLoading ? (
                        <p>Chargement des forages…</p>
                      ) : !boreholes?.length ? (
                        <p style={{ fontSize: '0.9rem' }}>Aucun forage.</p>
                      ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {boreholes.map((b) => {
                            const bOpen = expandedBoreholes.has(b.id)
                            const layers = layersByBoreholeId.get(b.id)
                            const layerQIndex = allExpandedBoreholeIds.indexOf(b.id)
                            const layersLoading =
                              bOpen && layers === undefined && layerQIndex >= 0 && layerQueries[layerQIndex]?.isLoading

                            return (
                              <li
                                key={b.id}
                                style={{
                                  border: '1px solid var(--border, #e2e8f0)',
                                  borderRadius: 6,
                                  marginBottom: '0.5rem',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.75rem',
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => toggleBorehole(b.id)}
                                    aria-expanded={bOpen}
                                  >
                                    {bOpen ? '▼' : '▶'}
                                  </button>
                                  <span>
                                    <strong>{b.code?.trim() || `Forage #${b.id}`}</strong>
                                    {b.latitude != null && b.longitude != null ? (
                                      <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem', color: 'var(--muted)' }}>
                                        ({b.latitude}, {b.longitude})
                                      </span>
                                    ) : null}
                                    {b.ground_level_m != null && b.ground_level_m !== '' ? (
                                      <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                        TN {b.ground_level_m} m
                                      </span>
                                    ) : null}
                                  </span>
                                  <span style={{ flex: 1 }} />
                                  {isAdmin && (
                                    <div className="crud-actions">
                                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditBorehole(b)}>
                                        Modifier
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm btn-danger-outline"
                                        onClick={() => {
                                          if (window.confirm('Supprimer ce forage ?')) boreholeDeleteMut.mutate(b)
                                        }}
                                      >
                                        Supprimer
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {bOpen && (
                                  <div style={{ padding: '0 0 0.75rem 2rem' }}>
                                    {b.notes?.trim() ? (
                                      <p style={{ fontSize: '0.85rem', marginTop: 0 }}>{b.notes}</p>
                                    ) : null}
                                    <div className="crud-actions" style={{ marginBottom: '0.35rem' }}>
                                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Couches de lithologie</h4>
                                      {isAdmin && (
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCreateLayer(b.id)}>
                                          + Couche
                                        </button>
                                      )}
                                    </div>
                                    {layersLoading ? (
                                      <p style={{ fontSize: '0.85rem' }}>Chargement…</p>
                                    ) : !layers?.length ? (
                                      <p style={{ fontSize: '0.85rem' }}>Aucune couche.</p>
                                    ) : (
                                      <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                        <thead>
                                          <tr>
                                            <th>Prof. haut (m)</th>
                                            <th>Prof. bas (m)</th>
                                            <th>Description</th>
                                            <th>RQD</th>
                                            <th>Ordre</th>
                                            {isAdmin && <th>Actions</th>}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {layers.map((layer) => (
                                            <tr key={layer.id}>
                                              <td>{layer.depth_from_m ?? '—'}</td>
                                              <td>{layer.depth_to_m ?? '—'}</td>
                                              <td>{layer.description ?? '—'}</td>
                                              <td>{layer.rqd ?? '—'}</td>
                                              <td>{layer.sort_order ?? '—'}</td>
                                              {isAdmin && (
                                                <td>
                                                  <div className="crud-actions">
                                                    <button
                                                      type="button"
                                                      className="btn btn-secondary btn-sm"
                                                      onClick={() => openEditLayer(layer)}
                                                    >
                                                      Mod.
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className="btn btn-secondary btn-sm btn-danger-outline"
                                                      onClick={() => {
                                                        if (window.confirm('Supprimer cette couche ?')) layerDeleteMut.mutate(layer)
                                                      }}
                                                    >
                                                      Suppr.
                                                    </button>
                                                  </div>
                                                </td>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {missionModal && isAdmin && (
        <Modal title={missionModal.mode === 'create' ? 'Nouvelle mission' : 'Modifier la mission'} onClose={() => setMissionModal(null)}>
          <>
          <form onSubmit={submitMission}>
            <div className="form-group">
              <label>Référence</label>
              <input value={missionForm.reference} onChange={(e) => setMissionForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Titre</label>
              <input value={missionForm.title} onChange={(e) => setMissionForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Statut</label>
              <select
                value={missionForm.mission_status}
                onChange={(e) => setMissionForm((f) => ({ ...f, mission_status: e.target.value }))}
              >
                {MISSION_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Maître d&apos;ouvrage — nom</label>
              <input
                value={missionForm.maitre_ouvrage_name}
                onChange={(e) => setMissionForm((f) => ({ ...f, maitre_ouvrage_name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Maître d&apos;ouvrage — e-mail</label>
              <input
                type="email"
                value={missionForm.maitre_ouvrage_email}
                onChange={(e) => setMissionForm((f) => ({ ...f, maitre_ouvrage_email: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Maître d&apos;ouvrage — téléphone</label>
              <input
                value={missionForm.maitre_ouvrage_phone}
                onChange={(e) => setMissionForm((f) => ({ ...f, maitre_ouvrage_phone: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={missionForm.notes} onChange={(e) => setMissionForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            {(missionCreateMut.isError || missionUpdateMut.isError) && (
              <p className="error">{((missionCreateMut.error || missionUpdateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary" disabled={missionCreateMut.isPending || missionUpdateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setMissionModal(null)}>
                Annuler
              </button>
            </div>
          </form>
          {missionModal.mode === 'edit' && (
            <div className="mission-modal-meta">
              <EntityMetaCard
                meta={missionModal.mission.meta}
                editable
                onSave={(meta) => missionMetaMut.mutateAsync({ id: missionModal.mission.id, meta })}
                isSaving={missionMetaMut.isPending}
                saveError={missionMetaMut.isError ? (missionMetaMut.error as Error).message : null}
              />
            </div>
          )}
          </>
        </Modal>
      )}

      {boreholeModal && isAdmin && (
        <Modal title={boreholeModal.mode === 'create' ? 'Nouveau forage' : 'Modifier le forage'} onClose={() => setBoreholeModal(null)}>
          <form onSubmit={submitBorehole}>
            <div className="form-group">
              <label>Code / nom</label>
              <input value={boreholeForm.code} onChange={(e) => setBoreholeForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Latitude</label>
              <input value={boreholeForm.latitude} onChange={(e) => setBoreholeForm((f) => ({ ...f, latitude: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input value={boreholeForm.longitude} onChange={(e) => setBoreholeForm((f) => ({ ...f, longitude: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Altitude TN (m)</label>
              <input
                value={boreholeForm.ground_level_m}
                onChange={(e) => setBoreholeForm((f) => ({ ...f, ground_level_m: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={boreholeForm.notes} onChange={(e) => setBoreholeForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            {(boreholeCreateMut.isError || boreholeUpdateMut.isError) && (
              <p className="error">{((boreholeCreateMut.error || boreholeUpdateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary" disabled={boreholeCreateMut.isPending || boreholeUpdateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setBoreholeModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {layerModal && isAdmin && (
        <Modal title={layerModal.mode === 'create' ? 'Nouvelle couche' : 'Modifier la couche'} onClose={() => setLayerModal(null)}>
          <form onSubmit={submitLayer}>
            <div className="form-group">
              <label>Profondeur haut (m)</label>
              <input
                type="number"
                step="any"
                value={layerForm.depth_from_m}
                onChange={(e) => setLayerForm((f) => ({ ...f, depth_from_m: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Profondeur bas (m)</label>
              <input
                type="number"
                step="any"
                value={layerForm.depth_to_m}
                onChange={(e) => setLayerForm((f) => ({ ...f, depth_to_m: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={layerForm.description}
                onChange={(e) => setLayerForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="form-group">
              <label>RQD</label>
              <input type="number" step="any" value={layerForm.rqd} onChange={(e) => setLayerForm((f) => ({ ...f, rqd: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Ordre d&apos;affichage</label>
              <input
                type="number"
                value={layerForm.sort_order}
                onChange={(e) => setLayerForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
            {(layerCreateMut.isError || layerUpdateMut.isError) && (
              <p className="error">{((layerCreateMut.error || layerUpdateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions">
              <button type="submit" className="btn btn-primary" disabled={layerCreateMut.isPending || layerUpdateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setLayerModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
