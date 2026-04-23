import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { quotesApi, pdfApi, type EntityMetaPayload } from '../api/client'
import EntityMetaCard from '../components/module/EntityMetaCard'
import ModuleEntityShell from '../components/module/ModuleEntityShell'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import ListTableToolbar, { PaginationBar } from '../components/ListTableToolbar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePersistedColumnVisibility } from '../hooks/usePersistedColumnVisibility'
import { formatMoney, MONEY_UNIT_LABEL } from '../lib/appLocale'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validé',
  signed: 'Signé',
  sent: 'Envoyé',
  relanced: 'Relancé',
  lost: 'Perdu',
  invoiced: 'Facturé',
  accepted: 'Accepté',
  rejected: 'Refusé',
}

export default function Devis() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [statusModalId, setStatusModalId] = useState<number | null>(null)
  const [metaModalQuote, setMetaModalQuote] = useState<{ id: number; number: string; meta: unknown } | null>(null)
  const [statusValue, setStatusValue] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const { visible, toggle } = usePersistedColumnVisibility('quotes', {
    number: true,
    client: true,
    date: true,
    ttc: true,
    travel: true,
    status: true,
    pdf: true,
    actions: true,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', debouncedSearch, statusFilter, page],
    queryFn: () =>
      quotesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        page,
      }),
  })

  const quoteMetaMut = useMutation({
    mutationFn: ({ id, meta }: { id: number; meta: EntityMetaPayload }) => quotesApi.update(id, { meta }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', v.id] })
      setMetaModalQuote(null)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => quotesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setStatusModalId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  })

  const quotes = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

  if (isLoading) {
    return (
      <ModuleEntityShell
        shellClassName="module-shell--crm"
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Devis' },
        ]}
        moduleBarLabel="Commercial — Devis"
        title="Devis"
        subtitle="Chargement…"
      >
        <p className="text-muted">Chargement des devis…</p>
      </ModuleEntityShell>
    )
  }
  if (error) {
    return (
      <ModuleEntityShell
        shellClassName="module-shell--crm"
        breadcrumbs={[
          { label: 'Accueil', to: '/' },
          { label: 'Devis' },
        ]}
        moduleBarLabel="Commercial — Devis"
        title="Devis"
      >
        <p className="error">Erreur : {String(error)}</p>
      </ModuleEntityShell>
    )
  }

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Devis' },
      ]}
      moduleBarLabel="Commercial — Devis"
      title="Devis"
      subtitle="Propositions commerciales : brouillons, signature, suivi des montants TTC et frais de déplacement."
      actions={
        isLab ? (
          <>
            <Link to="/devis/nouveau" className="btn btn-primary btn-sm">
              Nouveau devis
            </Link>
            <Link to="/back-office/offres" className="btn btn-secondary btn-sm">
              Offres (catalogue)
            </Link>
          </>
        ) : null
      }
    >
      <ListTableToolbar
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v)
          setPage(1)
        }}
        searchPlaceholder="Numéro, notes…"
        statusValue={statusFilter}
        onStatusChange={(v) => {
          setStatusFilter(v)
          setPage(1)
        }}
        statusOptions={statusOptions}
        columns={[
          { id: 'number', label: 'Numéro' },
          { id: 'client', label: 'Client' },
          { id: 'date', label: 'Date' },
          { id: 'ttc', label: 'Montant TTC' },
          { id: 'travel', label: 'Dépl. HT' },
          { id: 'status', label: 'Statut' },
          ...(isLab ? [{ id: 'pdf', label: 'PDF' }] : []),
          ...(isLab ? [{ id: 'actions', label: 'Actions' }] : []),
        ]}
        visibleColumns={visible}
        onToggleColumn={toggle}
      />
      <div className="card">
        <table>
          <thead>
            <tr>
              {visible.number !== false && <th>Numéro</th>}
              {visible.client !== false && <th>Client</th>}
              {visible.date !== false && <th>Date</th>}
              {visible.ttc !== false && <th>Montant TTC ({MONEY_UNIT_LABEL})</th>}
              {visible.travel !== false && <th>Dépl. HT ({MONEY_UNIT_LABEL})</th>}
              {visible.status !== false && <th>Statut</th>}
              {isLab && visible.pdf !== false && <th>PDF</th>}
              {isLab && visible.actions !== false && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                {visible.number !== false && <td>{q.number}</td>}
                {visible.client !== false && <td>{q.client?.name}</td>}
                {visible.date !== false && <td>{new Date(q.quote_date).toLocaleDateString('fr-FR')}</td>}
                {visible.ttc !== false && <td>{formatMoney(Number(q.amount_ttc))}</td>}
                {visible.travel !== false && <td>{formatMoney(Number(q.travel_fee_ht ?? 0))}</td>}
                {visible.status !== false && <td>{STATUS_LABELS[q.status] ?? q.status}</td>}
                {isLab && visible.pdf !== false && (
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => pdfApi.generate('quote', q.id, q.pdf_template_id)}
                    >
                      PDF
                    </button>
                  </td>
                )}
                {isLab && visible.actions !== false && (
                  <td>
                    <div className="crud-actions">
                      {q.status === 'draft' && (
                        <Link to={`/devis/${q.id}/editer`} className="btn btn-secondary btn-sm">
                          Modifier
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setStatusModalId(q.id)
                          setStatusValue(q.status)
                        }}
                      >
                        Statut
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setMetaModalQuote({ id: q.id, number: q.number, meta: q.meta })}
                      >
                        Métadonnées
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-danger-outline"
                          onClick={() => {
                            if (window.confirm(`Supprimer le devis ${q.number} ?`)) deleteMutation.mutate(q.id)
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {quotes.length === 0 && <p style={{ padding: '1rem' }}>Aucun devis.</p>}
        <PaginationBar page={data?.current_page ?? 1} lastPage={lastPage} onPage={setPage} />
      </div>

      {statusModalId !== null && (
        <Modal title="Changer le statut" onClose={() => setStatusModalId(null)}>
          <div className="form-group">
            <label>Statut</label>
            <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="crud-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: statusModalId, status: statusValue })}
            >
              Enregistrer
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStatusModalId(null)}>
              Annuler
            </button>
          </div>
          {statusMutation.isError && <p className="error">{(statusMutation.error as Error).message}</p>}
        </Modal>
      )}

      {metaModalQuote && (
        <Modal title={`Métadonnées — ${metaModalQuote.number}`} onClose={() => setMetaModalQuote(null)}>
          <EntityMetaCard
            meta={metaModalQuote.meta}
            editable
            onSave={(meta) => quoteMetaMut.mutateAsync({ id: metaModalQuote.id, meta })}
            isSaving={quoteMetaMut.isPending}
            saveError={quoteMetaMut.isError ? (quoteMetaMut.error as Error).message : null}
          />
        </Modal>
      )}
    </ModuleEntityShell>
  )
}
