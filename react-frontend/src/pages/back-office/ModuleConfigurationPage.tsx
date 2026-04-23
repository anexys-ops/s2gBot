import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  extrafieldDefinitionsApi,
  moduleSettingsApi,
  type ExtrafieldDefinitionRow,
  type ExtrafieldEntityType,
  type ExtrafieldSelectOption,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { canManageAppConfig } from '../../lib/settingsAccess'
import Modal from '../../components/Modal'

const ENTITY_TABS: { type: ExtrafieldEntityType; label: string }[] = [
  { type: 'client', label: 'Clients' },
  { type: 'site', label: 'Chantiers' },
  { type: 'order', label: 'Dossiers / commandes' },
  { type: 'invoice', label: 'Factures' },
  { type: 'quote', label: 'Devis' },
]

const FIELD_TYPES: { value: string; label: string }[] = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'number', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Oui / Non' },
  { value: 'select', label: 'Liste déroulante' },
]

const ORDER_STATUSES: { value: string; label: string }[] = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'submitted', label: 'Soumise' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminée' },
]

const MODULE_KEYS = [
  { key: 'invoices', label: 'Factures — listes déroulantes' },
  { key: 'quotes', label: 'Devis — listes' },
  { key: 'orders', label: 'Commandes — listes' },
  { key: 'commercial_catalog', label: 'Catalogue commercial / matériel' },
] as const

type MainTab = 'extrafields' | 'modules'

export default function ModuleConfigurationPage() {
  const { user } = useAuth()
  const canConfigure = canManageAppConfig(user)
  const queryClient = useQueryClient()
  const [mainTab, setMainTab] = useState<MainTab>('extrafields')
  const [entityTab, setEntityTab] = useState<ExtrafieldEntityType>('invoice')
  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<ExtrafieldDefinitionRow | null>(null)

  const { data: defsRes, isLoading } = useQuery({
    queryKey: ['extrafield-definitions', entityTab],
    queryFn: () => extrafieldDefinitionsApi.list(entityTab),
    enabled: canConfigure,
  })

  const definitions = defsRes?.data ?? []

  const deleteMut = useMutation({
    mutationFn: (id: number) => extrafieldDefinitionsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['extrafield-definitions'] }),
  })

  if (!canConfigure) {
    return <p className="error">Réservé aux administrateurs ou aux comptes avec le droit « configuration ».</p>
  }

  return (
    <div className="module-configuration-page">
      <div className="module-configuration-page__tabs">
        <button
          type="button"
          className={`btn btn-sm ${mainTab === 'extrafields' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMainTab('extrafields')}
        >
          Champs personnalisés (extrafields)
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mainTab === 'modules' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMainTab('modules')}
        >
          Listes par module
        </button>
      </div>

      {mainTab === 'extrafields' && (
        <>
          <p style={{ color: 'var(--color-muted)', maxWidth: '70ch', lineHeight: 1.5 }}>
            Définissez des champs structurés par entité (clients, chantiers, dossiers, factures, devis). Les valeurs sont
            stockées en base ; les écrans métier affichent des listes déroulantes ou champs adaptés au type.
          </p>
          <div className="module-configuration-page__entity-tabs">
            {ENTITY_TABS.map((t) => (
              <button
                key={t.type}
                type="button"
                className={`btn btn-sm ${entityTab === t.type ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEntityTab(t.type)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="crud-actions" style={{ marginBottom: '1rem' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
              + Nouveau champ
            </button>
          </div>
          {isLoading ? (
            <p>Chargement…</p>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="module-configuration-page__table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Libellé</th>
                    <th>Type</th>
                    <th>Obligatoire</th>
                    <th>Ordre</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {definitions.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <code>{d.code}</code>
                      </td>
                      <td>{d.label}</td>
                      <td>{FIELD_TYPES.find((f) => f.value === d.field_type)?.label ?? d.field_type}</td>
                      <td>{d.required ? 'Oui' : 'Non'}</td>
                      <td>{d.sort_order}</td>
                      <td>
                        <div className="crud-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditRow(d)}>
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-danger-outline"
                            onClick={() => {
                              if (window.confirm(`Supprimer le champ « ${d.label} » ?`)) deleteMut.mutate(d.id)
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
              {definitions.length === 0 && <p style={{ padding: '1rem' }}>Aucun champ pour cette entité.</p>}
            </div>
          )}
        </>
      )}

      {mainTab === 'modules' && <ModuleListsSection />}

      {createOpen && (
        <ExtrafieldDefinitionModal
          entityType={entityTab}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            queryClient.invalidateQueries({ queryKey: ['extrafield-definitions'] })
          }}
        />
      )}
      {editRow && (
        <ExtrafieldDefinitionModal
          entityType={entityTab}
          initial={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null)
            queryClient.invalidateQueries({ queryKey: ['extrafield-definitions'] })
          }}
        />
      )}
    </div>
  )
}

function ModuleListsSection() {
  const queryClient = useQueryClient()
  const [activeKey, setActiveKey] = useState<(typeof MODULE_KEYS)[number]['key']>('invoices')

  const { data, isLoading } = useQuery({
    queryKey: ['module-settings', activeKey],
    queryFn: () => moduleSettingsApi.get(activeKey),
  })

  const [tvaRates, setTvaRates] = useState<string>('')
  const [travelTva, setTravelTva] = useState<string>('')
  const [orderStatuses, setOrderStatuses] = useState<string[]>([])
  const [quotesTva, setQuotesTva] = useState<string>('')
  const [ordersPriority, setOrdersPriority] = useState<string>('')
  const [linkEquipmentToProducts, setLinkEquipmentToProducts] = useState(true)
  const [showEquipmentOnQuotePdf, setShowEquipmentOnQuotePdf] = useState(true)

  useEffect(() => {
    if (!data?.settings) return
    const s = data.settings
    if (activeKey === 'invoices') {
      setTvaRates(((s.tva_rate_options as number[]) ?? []).join(', '))
      setTravelTva(((s.travel_tva_rate_options as number[]) ?? []).join(', '))
      setOrderStatuses([...((s.order_picker_statuses as string[]) ?? [])])
    }
    if (activeKey === 'quotes') {
      setQuotesTva(((s.tva_rate_options as number[]) ?? []).join(', '))
    }
    if (activeKey === 'orders') {
      setOrdersPriority(((s.default_priority_options as string[]) ?? []).join(', '))
    }
    if (activeKey === 'commercial_catalog') {
      setLinkEquipmentToProducts(s.link_equipment_to_products !== false)
      setShowEquipmentOnQuotePdf(s.show_equipment_on_quote_pdf !== false)
    }
  }, [data, activeKey])

  const saveMut = useMutation({
    mutationFn: () => {
      if (activeKey === 'invoices') {
        const tva_rate_options = tvaRates
          .split(/[,;]+/)
          .map((x) => parseFloat(x.trim()))
          .filter((n) => !Number.isNaN(n))
        const travel_tva_rate_options = travelTva
          .split(/[,;]+/)
          .map((x) => parseFloat(x.trim()))
          .filter((n) => !Number.isNaN(n))
        return moduleSettingsApi.update('invoices', {
          tva_rate_options,
          travel_tva_rate_options,
          order_picker_statuses: orderStatuses,
        })
      }
      if (activeKey === 'quotes') {
        const tva_rate_options = quotesTva
          .split(/[,;]+/)
          .map((x) => parseFloat(x.trim()))
          .filter((n) => !Number.isNaN(n))
        return moduleSettingsApi.update('quotes', { tva_rate_options })
      }
      if (activeKey === 'orders') {
        const default_priority_options = ordersPriority
          .split(/[,;]+/)
          .map((x) => x.trim())
          .filter(Boolean)
        return moduleSettingsApi.update('orders', { default_priority_options })
      }
      if (activeKey === 'commercial_catalog') {
        return moduleSettingsApi.update('commercial_catalog', {
          link_equipment_to_products: linkEquipmentToProducts,
          show_equipment_on_quote_pdf: showEquipmentOnQuotePdf,
        })
      }
      return Promise.reject(new Error('Module de configuration non géré.'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module-settings', activeKey] })
    },
  })

  return (
    <div>
      <p style={{ color: 'var(--color-muted)', maxWidth: '70ch', lineHeight: 1.5 }}>
        Valeurs proposées dans les listes déroulantes (TVA, statuts de commandes visibles lors de la création de facture,
        etc.). Séparez les nombres par des virgules.
      </p>
      <div className="module-configuration-page__entity-tabs" style={{ marginBottom: '1rem' }}>
        {MODULE_KEYS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`btn btn-sm ${activeKey === m.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveKey(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p>Chargement…</p>
      ) : (
        <div className="card">
          {activeKey === 'invoices' && (
            <>
              <div className="form-group">
                <label>Taux de TVA facture (liste)</label>
                <input
                  type="text"
                  value={tvaRates}
                  onChange={(e) => setTvaRates(e.target.value)}
                  placeholder="20, 10, 5.5, 0"
                />
              </div>
              <div className="form-group">
                <label>Taux de TVA sur déplacements (liste)</label>
                <input
                  type="text"
                  value={travelTva}
                  onChange={(e) => setTravelTva(e.target.value)}
                  placeholder="20, 10, 5.5, 0"
                />
              </div>
              <div className="form-group">
                <label>Statuts de commande proposés pour regrouper en facture</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {ORDER_STATUSES.map((s) => (
                    <label key={s.value} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={orderStatuses.includes(s.value)}
                        onChange={() => {
                          setOrderStatuses((prev) =>
                            prev.includes(s.value) ? prev.filter((x) => x !== s.value) : [...prev, s.value],
                          )
                        }}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          {activeKey === 'quotes' && (
            <div className="form-group">
              <label>Taux de TVA devis (liste)</label>
              <input
                type="text"
                value={quotesTva}
                onChange={(e) => setQuotesTva(e.target.value)}
                placeholder="20, 10, 5.5, 0"
              />
            </div>
          )}
          {activeKey === 'orders' && (
            <div className="form-group">
              <label>Options de priorité (texte, séparées par virgules)</label>
              <input
                type="text"
                value={ordersPriority}
                onChange={(e) => setOrdersPriority(e.target.value)}
                placeholder="normal, urgent, basse"
              />
            </div>
          )}
          {activeKey === 'commercial_catalog' && (
            <>
              <p className="text-muted" style={{ maxWidth: '64ch' }}>
                Contrôle l&apos;association d&apos;une fiche <strong>matériel / inventaire</strong> à une référence du
                catalogue produits, et l&apos;affichage de cette mention sur le <strong>PDF devis</strong> (désignation
                de ligne).
              </p>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={linkEquipmentToProducts}
                    onChange={(e) => setLinkEquipmentToProducts(e.target.checked)}
                  />
                  Proposer le choix du matériel sur les fiches catalogue
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={showEquipmentOnQuotePdf}
                    onChange={(e) => setShowEquipmentOnQuotePdf(e.target.checked)}
                  />
                  Afficher le matériel lié sur le PDF devis
                </label>
              </div>
            </>
          )}
          <button type="button" className="btn btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saveMut.isError && <p className="error">{(saveMut.error as Error).message}</p>}
        </div>
      )}
    </div>
  )
}

function ExtrafieldDefinitionModal({
  entityType,
  initial,
  onClose,
  onSaved,
}: {
  entityType: ExtrafieldEntityType
  initial?: ExtrafieldDefinitionRow
  onClose: () => void
  onSaved: () => void
}) {
  const [code, setCode] = useState(initial?.code ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [fieldType, setFieldType] = useState(initial?.field_type ?? 'text')
  const [required, setRequired] = useState(initial?.required ?? false)
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0))
  const [optRows, setOptRows] = useState<ExtrafieldSelectOption[]>(
    initial?.select_options?.length ? initial.select_options : [{ value: '', label: '' }],
  )

  const createMut = useMutation({
    mutationFn: () =>
      extrafieldDefinitionsApi.create({
        entity_type: entityType,
        code: code.trim(),
        label: label.trim(),
        field_type: fieldType,
        required,
        sort_order: Number(sortOrder) || 0,
        select_options:
          fieldType === 'select'
            ? optRows.filter((r) => r.value.trim() && r.label.trim()).map((r) => ({ value: r.value.trim(), label: r.label.trim() }))
            : undefined,
      }),
    onSuccess: () => onSaved(),
  })

  const updateMut = useMutation({
    mutationFn: () =>
      extrafieldDefinitionsApi.update(initial!.id, {
        label: label.trim(),
        field_type: fieldType,
        required,
        sort_order: Number(sortOrder) || 0,
        select_options:
          fieldType === 'select'
            ? optRows.filter((r) => r.value.trim() && r.label.trim()).map((r) => ({ value: r.value.trim(), label: r.label.trim() }))
            : null,
      }),
    onSuccess: () => onSaved(),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (initial) updateMut.mutate()
    else createMut.mutate()
  }

  const pending = createMut.isPending || updateMut.isPending
  const err = (createMut.error || updateMut.error) as Error | undefined

  return (
    <Modal title={initial ? 'Modifier le champ' : 'Nouveau champ personnalisé'} onClose={onClose}>
      <form onSubmit={submit}>
        {!initial && (
          <div className="form-group">
            <label>Code technique (a-z, 0-9, _)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required pattern="[a-z0-9_]+" />
          </div>
        )}
        <div className="form-group">
          <label>Libellé affiché</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value)}>
            {FIELD_TYPES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Ordre d’affichage</label>
          <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </div>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Obligatoire
        </label>
        {fieldType === 'select' && (
          <div className="form-group">
            <label>Options (valeur + libellé)</label>
            {optRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <input
                  placeholder="valeur"
                  value={row.value}
                  onChange={(e) => setOptRows(optRows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                />
                <input
                  placeholder="libellé"
                  value={row.label}
                  onChange={(e) => setOptRows(optRows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setOptRows(optRows.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOptRows([...optRows, { value: '', label: '' }])}>
              + Option
            </button>
          </div>
        )}
        {err && <p className="error">{err.message}</p>}
        <div className="crud-actions">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? '…' : 'Enregistrer'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  )
}
