/**
 * ArticleActionsPanel
 *
 * Panneau "Actions & matériel" d'une fiche article (lab_admin / lab_technician).
 * - Liste des actions par type (technicien / ingenieur / labo)
 * - CRUD actions (créer / modifier / supprimer)
 * - Liste des équipements requis
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  articleActionsApi,
  equipmentsApi,
  type ArticleAction,
  type ArticleEquipmentRequirement,
} from '../../api/client'
import ActionMeasureConfigPanel from './ActionMeasureConfigPanel'

const TYPE_META: Record<string, { label: string; color: string }> = {
  technicien: { label: 'Terrain / Technicien', color: '#f59e0b' },
  ingenieur:  { label: 'Ingénieur',            color: '#3b82f6' },
  labo:       { label: 'Laboratoire',          color: '#10b981' },
}

const MATERIEL_META = { label: 'Matériel requis', color: '#8b5cf6' }

const TYPES = ['technicien', 'ingenieur', 'labo'] as const

function ActionRow({
  action,
  articleId,
  onDeleted,
}: {
  action: ArticleAction
  articleId: number
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    libelle: action.libelle,
    description: action.description ?? '',
    duree_heures: action.duree_heures ?? 0,
    ordre: action.ordre ?? 0,
  })
  const qc = useQueryClient()

  const updateMut = useMutation({
    mutationFn: (body: Partial<ArticleAction>) => articleActionsApi.update(articleId, action.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-actions', articleId] })
      setEditing(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => articleActionsApi.delete(articleId, action.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-actions', articleId] })
      onDeleted()
    },
  })

  const meta = TYPE_META[action.type] ?? { label: action.type, color: '#6b7280' }

  if (editing) {
    return (
      <tr>
        <td colSpan={5}>
          <form
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', padding: '0.25rem 0' }}
            onSubmit={(e) => {
              e.preventDefault()
              updateMut.mutate({
                libelle: form.libelle,
                description: form.description || undefined,
                duree_heures: Number(form.duree_heures),
                ordre: Number(form.ordre),
              })
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
              Libellé *
              <input
                value={form.libelle}
                onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
                required
                style={{ minWidth: 160 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
              Description
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                style={{ minWidth: 180 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
              Durée (h)
              <input
                type="number"
                min={0}
                step={0.25}
                value={form.duree_heures}
                onChange={(e) => setForm((f) => ({ ...f, duree_heures: Number(e.target.value) }))}
                style={{ width: 70 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
              Ordre
              <input
                type="number"
                min={0}
                value={form.ordre}
                onChange={(e) => setForm((f) => ({ ...f, ordre: Number(e.target.value) }))}
                style={{ width: 60 }}
              />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={updateMut.isPending}>
              {updateMut.isPending ? '…' : 'OK'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
              Annuler
            </button>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: meta.color,
            marginRight: '0.4rem',
            verticalAlign: 'middle',
          }}
        />
        {action.libelle}
      </td>
      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{action.description || '—'}</td>
      <td style={{ textAlign: 'right' }}>{action.duree_heures ? `${action.duree_heures} h` : '—'}</td>
      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>{action.ordre ?? 0}</td>
      <td style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
          ✏️
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-danger-outline"
          disabled={deleteMut.isPending}
          onClick={() => {
            if (window.confirm('Supprimer cette action ?')) deleteMut.mutate()
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

function NewActionForm({ articleId, type, onCreated }: { articleId: number; type: 'technicien' | 'ingenieur' | 'labo'; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ libelle: '', description: '', duree_heures: 1, ordre: 0 })
  const qc = useQueryClient()

  const createMut = useMutation({
    mutationFn: () =>
      articleActionsApi.create(articleId, {
        type,
        libelle: form.libelle,
        description: form.description || undefined,
        duree_heures: Number(form.duree_heures),
        ordre: Number(form.ordre),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-actions', articleId] })
      setForm({ libelle: '', description: '', duree_heures: 1, ordre: 0 })
      setOpen(false)
      onCreated()
    },
  })

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)} style={{ marginTop: '0.5rem' }}>
        + Nouvelle action
      </button>
    )
  }

  return (
    <form
      style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--color-surface)', borderRadius: 6, border: '1px solid var(--color-border)' }}
      onSubmit={(e) => {
        e.preventDefault()
        createMut.mutate()
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
        Libellé *
        <input
          value={form.libelle}
          onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
          required
          style={{ minWidth: 160 }}
          placeholder="Ex: Essai Proctor"
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
        Description
        <input
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          style={{ minWidth: 180 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
        Durée (h)
        <input
          type="number"
          min={0}
          step={0.25}
          value={form.duree_heures}
          onChange={(e) => setForm((f) => ({ ...f, duree_heures: Number(e.target.value) }))}
          style={{ width: 70 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
        Ordre
        <input
          type="number"
          min={0}
          value={form.ordre}
          onChange={(e) => setForm((f) => ({ ...f, ordre: Number(e.target.value) }))}
          style={{ width: 60 }}
        />
      </label>
      <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending}>
        {createMut.isPending ? 'Création…' : 'Créer'}
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
        Annuler
      </button>
      {createMut.isError && (
        <span className="error" style={{ fontSize: '0.82rem' }}>
          {(createMut.error as Error).message}
        </span>
      )}
    </form>
  )
}

function EquipmentRequirementRow({
  requirement,
  articleId,
}: {
  requirement: ArticleEquipmentRequirement
  articleId: number
}) {
  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: () => articleActionsApi.equipmentRemove(articleId, requirement.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-equipment-requirements', articleId] })
    },
  })
  const eq = requirement.equipment

  return (
    <tr>
      <td>
        {eq ? (
          <Link to={`/materiel/equipements/${eq.id}`} className="link-inline">
            <code>{eq.code ?? `#${eq.id}`}</code> — {eq.name}
          </Link>
        ) : (
          `Équipement #${requirement.equipment_id}`
        )}
      </td>
      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{eq?.type?.trim() || '—'}</td>
      <td style={{ textAlign: 'right' }}>{requirement.quantite ?? 1}</td>
      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{requirement.notes?.trim() || '—'}</td>
      <td style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-danger-outline"
          disabled={deleteMut.isPending}
          onClick={() => {
            if (window.confirm('Retirer cet équipement de la fiche article ?')) deleteMut.mutate()
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

function NewEquipmentForm({
  articleId,
  existingEquipmentIds,
}: {
  articleId: number
  existingEquipmentIds: number[]
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ equipment_id: '', quantite: 1, notes: '' })
  const qc = useQueryClient()

  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments', 'article-requirements'],
    queryFn: () => equipmentsApi.list(),
    enabled: open,
    staleTime: 120_000,
  })

  const available = equipments
    .filter((eq) => !existingEquipmentIds.includes(eq.id))
    .sort((a, b) => a.code.localeCompare(b.code, 'fr'))

  const createMut = useMutation({
    mutationFn: () =>
      articleActionsApi.equipmentAdd(articleId, {
        equipment_id: Number(form.equipment_id),
        quantite: Number(form.quantite) || 1,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['article-equipment-requirements', articleId] })
      setForm({ equipment_id: '', quantite: 1, notes: '' })
      setOpen(false)
    },
  })

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)} style={{ marginTop: '0.5rem' }}>
        + Ajouter un équipement
      </button>
    )
  }

  return (
    <form
      style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        marginTop: '0.5rem',
        padding: '0.5rem',
        background: 'var(--color-surface)',
        borderRadius: 6,
        border: '1px solid var(--color-border)',
      }}
      onSubmit={(e) => {
        e.preventDefault()
        createMut.mutate()
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
        Équipement *
        <select
          value={form.equipment_id}
          onChange={(e) => setForm((f) => ({ ...f, equipment_id: e.target.value }))}
          required
          style={{ minWidth: 220 }}
        >
          <option value="">— Choisir —</option>
          {available.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.code} — {eq.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
        Quantité
        <input
          type="number"
          min={1}
          value={form.quantite}
          onChange={(e) => setForm((f) => ({ ...f, quantite: Number(e.target.value) }))}
          style={{ width: 70 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.82rem' }}>
        Notes
        <input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          style={{ minWidth: 180 }}
          placeholder="Optionnel"
        />
      </label>
      <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending || !form.equipment_id}>
        {createMut.isPending ? 'Ajout…' : 'Ajouter'}
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
        Annuler
      </button>
      {createMut.isError && (
        <span className="error" style={{ fontSize: '0.82rem' }}>
          {(createMut.error as Error).message}
        </span>
      )}
    </form>
  )
}

export default function ArticleActionsPanel({ articleId }: { articleId: number }) {
  const { data: actions = [], isLoading: loadingActions } = useQuery({
    queryKey: ['article-actions', articleId],
    queryFn: () => articleActionsApi.list(articleId),
    staleTime: 60_000,
  })

  const { data: equipmentRequirements = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ['article-equipment-requirements', articleId],
    queryFn: () => articleActionsApi.equipmentList(articleId),
    staleTime: 60_000,
  })

  if (loadingActions || loadingEquipment) return <p className="text-muted">Chargement des actions et matériel…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {TYPES.map((type) => {
        const meta = TYPE_META[type]
        const typeActions = actions.filter((a) => a.type === type)

        return (
          <section key={type} className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: meta.color,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{meta.label}</h3>
              <span className="badge" style={{ marginLeft: 'auto' }}>
                {typeActions.length} action{typeActions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {typeActions.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th>Libellé</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Durée</th>
                      <th style={{ textAlign: 'right' }}>Ordre</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeActions
                      .slice()
                      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
                      .map((action) => (
                        <ActionRow key={action.id} action={action} articleId={articleId} onDeleted={() => {}} />
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.25rem' }}>
                Aucune action définie pour ce type.
              </p>
            )}

            {/* Panneau config des mesures par action */}
            {typeActions.slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((action) => (
              <ActionMeasureConfigPanel
                key={action.id}
                articleId={articleId}
                actionId={action.id}
                actionLabel={action.libelle}
              />
            ))}

            <NewActionForm articleId={articleId} type={type} onCreated={() => {}} />
          </section>
        )
      })}

      <section className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: MATERIEL_META.color,
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{MATERIEL_META.label}</h3>
          <span className="badge" style={{ marginLeft: 'auto' }}>
            {equipmentRequirements.length} équipement{equipmentRequirements.length !== 1 ? 's' : ''}
          </span>
        </div>

        {equipmentRequirements.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Équipement</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Qté</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {equipmentRequirements.map((req) => (
                  <EquipmentRequirementRow key={req.id} requirement={req} articleId={articleId} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.25rem' }}>
            Aucun équipement requis défini pour cet article.
          </p>
        )}

        <NewEquipmentForm
          articleId={articleId}
          existingEquipmentIds={equipmentRequirements.map((r) => r.equipment_id)}
        />
      </section>
    </div>
  )
}
