import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { clientsApi, sitesApi, type Site } from '../../api/client'
import Modal from '../../components/Modal'
import type { SiteOutletContext } from './SiteLayout'

const emptyForm = (s: Site): Partial<Site> => ({
  client_id: s.client_id,
  name: s.name,
  address: s.address ?? '',
  reference: s.reference ?? '',
  travel_fee_quote_ht: Number(s.travel_fee_quote_ht ?? 0),
  travel_fee_invoice_ht: Number(s.travel_fee_invoice_ht ?? 0),
  travel_fee_label: s.travel_fee_label ?? '',
})

export default function SiteFicheTab() {
  const { siteId, site, isAdmin } = useOutletContext<SiteOutletContext>()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Partial<Site>>(() => emptyForm(site))

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
    enabled: isAdmin,
  })
  const clients = Array.isArray(clientsData) ? clientsData : []

  useEffect(() => {
    setForm(emptyForm(site))
  }, [site])

  useEffect(() => {
    if (searchParams.get('edit') === '1' && isAdmin) {
      setModalOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, isAdmin])

  const updateMut = useMutation({
    mutationFn: (body: Partial<Site>) => sitesApi.update(siteId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['site', siteId], updated)
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setModalOpen(false)
    },
  })

  const openEdit = () => {
    setForm(emptyForm(site))
    setModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim() || !form.client_id) return
    updateMut.mutate(form)
  }

  return (
    <>
      <div className="card">
        <div className="crud-actions" style={{ marginBottom: '1rem' }}>
          {isAdmin && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={openEdit}>
              Modifier la fiche
            </button>
          )}
          {site.client?.id ? (
            <Link to={`/clients/${site.client.id}/fiche`} className="btn btn-secondary btn-sm">
              Fiche client
            </Link>
          ) : null}
        </div>
        <dl className="module-fiche-grid">
          <div>
            <dt>Client</dt>
            <dd>{site.client?.name ?? `#${site.client_id}`}</dd>
          </div>
          <div>
            <dt>Référence</dt>
            <dd>{site.reference?.trim() ? site.reference : '—'}</dd>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt>Adresse chantier</dt>
            <dd>{site.address?.trim() ? site.address : '—'}</dd>
          </div>
          <div>
            <dt>Forfait déplacement devis (HT)</dt>
            <dd>{Number(site.travel_fee_quote_ht ?? 0).toFixed(2)} €</dd>
          </div>
          <div>
            <dt>Forfait déplacement facture (HT)</dt>
            <dd>{Number(site.travel_fee_invoice_ht ?? 0).toFixed(2)} €</dd>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt>Libellé frais déplacement</dt>
            <dd>{site.travel_fee_label?.trim() ? site.travel_fee_label : '—'}</dd>
          </div>
        </dl>
      </div>

      {modalOpen && isAdmin && (
        <Modal title="Modifier le chantier" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Client *</label>
              <select
                value={form.client_id || ''}
                onChange={(e) => setForm((f) => ({ ...f, client_id: Number(e.target.value) }))}
                required
              >
                <option value="">Choisir…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nom du chantier *</label>
              <input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Référence</label>
              <input value={form.reference ?? ''} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Adresse</label>
              <textarea value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} />
            </div>
            <div className="form-group">
              <label>Libellé frais déplacement</label>
              <input
                value={form.travel_fee_label ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, travel_fee_label: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Forfait déplacement devis (€ HT)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.travel_fee_quote_ht ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, travel_fee_quote_ht: Number(e.target.value) }))}
              />
            </div>
            <div className="form-group">
              <label>Forfait déplacement facture (€ HT)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.travel_fee_invoice_ht ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, travel_fee_invoice_ht: Number(e.target.value) }))}
              />
            </div>
            {updateMut.isError && <p className="error">{(updateMut.error as Error).message}</p>}
            <div className="crud-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={updateMut.isPending}>
                Enregistrer
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
