import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bonsCommandeApi, dossiersApi, missionsApi, type Mission } from '../../api/client'
import Modal from '../../components/Modal'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

type MissionForm = {
  source_type: 'dossier' | 'bon_commande'
  source_id: number | ''
  reference: string
  title: string
  mission_status: string
  notes: string
}

const emptyForm: MissionForm = {
  source_type: 'dossier',
  source_id: '',
  reference: '',
  title: '',
  mission_status: 'g1',
  notes: '',
}

export default function OrdresMissionPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Mission | null>(null)
  const [form, setForm] = useState<MissionForm>(emptyForm)

  const { data: missions = [], isLoading, error } = useQuery({
    queryKey: ['missions', 'all'],
    queryFn: () => missionsApi.listAll(),
  })
  const { data: dossiers = [] } = useQuery({
    queryKey: ['dossiers', 'mission-source'],
    queryFn: () => dossiersApi.list(),
  })
  const { data: bonsCommande = [] } = useQuery({
    queryKey: ['bons-commande', 'mission-source'],
    queryFn: () => bonsCommandeApi.list(),
  })

  const createMut = useMutation({
    mutationFn: () => {
      if (!form.source_id) throw new Error('Sélectionnez une source.')
      return missionsApi.createGlobal({
        source_type: form.source_type,
        source_id: form.source_id,
        reference: form.reference || undefined,
        title: form.title || undefined,
        mission_status: form.mission_status,
        notes: form.notes || undefined,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['missions'] })
      setModal(null)
      setForm(emptyForm)
    },
  })
  const updateMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Ordre de mission introuvable.')
      return missionsApi.update(editing.id, {
        reference: form.reference || undefined,
        title: form.title || undefined,
        mission_status: form.mission_status,
        notes: form.notes || undefined,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['missions'] })
      setModal(null)
      setEditing(null)
      setForm(emptyForm)
    },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => missionsApi.delete(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['missions'] }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModal('create')
  }

  const openEdit = (mission: Mission) => {
    setEditing(mission)
    setForm({
      source_type: mission.bon_commande_id ? 'bon_commande' : 'dossier',
      source_id: mission.bon_commande_id ?? mission.dossier_id ?? '',
      reference: mission.reference ?? '',
      title: mission.title ?? '',
      mission_status: mission.mission_status ?? 'g1',
      notes: mission.notes ?? '',
    })
    setModal('edit')
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Commercial', to: '/crm' },
        { label: 'Ordres de mission' },
      ]}
      moduleBarLabel="Commercial"
      title="Ordres de mission"
      subtitle="Création depuis un dossier ou un bon de commande."
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          Nouvel ordre de mission
        </button>
      }
    >
      {isLoading && <p className="text-muted">Chargement…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {!isLoading && !missions.length && <p className="text-muted">Aucun ordre de mission.</p>}
      {!!missions.length && (
        <div className="table-wrap">
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Titre</th>
                <th>Source</th>
                <th>Chantier</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {missions.map((mission) => (
                <tr key={mission.id}>
                  <td><code>{mission.reference}</code></td>
                  <td>{mission.title || '—'}</td>
                  <td>
                    {mission.bon_commande_id ? (
                      <Link to={`/bons-commande/${mission.bon_commande_id}`} className="link-inline">
                        BC #{mission.bon_commande_id}
                      </Link>
                    ) : mission.dossier_id ? (
                      <Link to={`/dossiers/${mission.dossier_id}`} className="link-inline">
                        Dossier #{mission.dossier_id}
                      </Link>
                    ) : '—'}
                  </td>
                  <td>{mission.site?.name ?? (mission.site_id ? `Chantier #${mission.site_id}` : '—')}</td>
                  <td>{mission.mission_status ?? '—'}</td>
                  <td>
                    <div className="crud-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(mission)}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-outline"
                        onClick={() => {
                          if (window.confirm(`Supprimer l’ordre de mission ${mission.reference} ?`)) deleteMut.mutate(mission.id)
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Nouvel ordre de mission' : 'Modifier l’ordre de mission'} onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (modal === 'create') createMut.mutate()
              else updateMut.mutate()
            }}
          >
            <div className="quote-form-grid">
              <label>
                Source
                <select
                  value={form.source_type}
                  onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value as MissionForm['source_type'], source_id: '' }))}
                  disabled={modal === 'edit'}
                >
                  <option value="dossier">Dossier</option>
                  <option value="bon_commande">Bon de commande</option>
                </select>
              </label>
              <label>
                {form.source_type === 'dossier' ? 'Dossier' : 'Bon de commande'}
                <select
                  value={form.source_id === '' ? '' : String(form.source_id)}
                  onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value ? Number(e.target.value) : '' }))}
                  disabled={modal === 'edit'}
                  required
                >
                  <option value="">Choisir…</option>
                  {form.source_type === 'dossier'
                    ? dossiers.map((dossier) => (
                        <option key={dossier.id} value={dossier.id}>
                          {dossier.reference} — {dossier.titre}
                        </option>
                      ))
                    : bonsCommande.map((bc) => (
                        <option key={bc.id} value={bc.id}>
                          {bc.numero} — dossier #{bc.dossier_id}
                        </option>
                      ))}
                </select>
              </label>
              <label>
                Référence
                <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Auto si vide" />
              </label>
              <label>
                Titre
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </label>
              <label>
                Statut
                <select value={form.mission_status} onChange={(e) => setForm((f) => ({ ...f, mission_status: e.target.value }))}>
                  {['g1', 'g2', 'g3', 'g4', 'g5'].map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}
                </select>
              </label>
            </div>
            <label>
              Notes
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </label>
            {(createMut.isError || updateMut.isError) && (
              <p className="error">{((createMut.error ?? updateMut.error) as Error).message}</p>
            )}
            <div className="crud-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </ModuleEntityShell>
  )
}
