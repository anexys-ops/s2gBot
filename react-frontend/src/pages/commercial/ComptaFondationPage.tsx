import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clientsApi,
  comptaV1Api,
  dossiersApi,
  invoicesApi,
} from '../../api/client'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import Modal from '../../components/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { formatMoney } from '../../lib/appLocale'

const PAYMENT_MODES = [
  { value: 'virement', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'especes', label: 'Espèces' },
  { value: 'carte', label: 'Carte' },
  { value: 'autre', label: 'Autre' },
]

export default function ComptaFondationPage() {
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<'reglement' | 'situation' | 'avoir' | null>(null)

  const { data: regs, isLoading: lr } = useQuery({
    queryKey: ['compta-reglements'],
    queryFn: () => comptaV1Api.reglements.list(),
  })
  const { data: sit, isLoading: ls } = useQuery({
    queryKey: ['compta-situations'],
    queryFn: () => comptaV1Api.situations.list(),
  })
  const { data: av, isLoading: la } = useQuery({
    queryKey: ['compta-avoirs'],
    queryFn: () => comptaV1Api.avoirs.list(),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'compta-forms'],
    queryFn: () => clientsApi.list(),
    enabled: isLab && (modal === 'reglement' || modal === 'avoir'),
  })
  const { data: dossiers = [] } = useQuery({
    queryKey: ['dossiers', 'compta-situation'],
    queryFn: () => dossiersApi.list(),
    enabled: isLab && modal === 'situation',
  })

  const [regClient, setRegClient] = useState(0)
  const [avoirClient, setAvoirClient] = useState(0)
  const clientForInvoices = modal === 'reglement' ? regClient : modal === 'avoir' ? avoirClient : 0
  const { data: invPage } = useQuery({
    queryKey: ['invoices', 'compta', clientForInvoices, modal],
    queryFn: () => invoicesApi.list({ client_id: clientForInvoices, page: 1 }),
    enabled: isLab && (modal === 'reglement' || modal === 'avoir') && clientForInvoices > 0,
  })
  const invList = invPage?.data ?? []

  const invalidateCompta = () => {
    void queryClient.invalidateQueries({ queryKey: ['compta-reglements'] })
    void queryClient.invalidateQueries({ queryKey: ['compta-situations'] })
    void queryClient.invalidateQueries({ queryKey: ['compta-avoirs'] })
  }

  const mutReg = useMutation({
    mutationFn: comptaV1Api.reglements.create,
    onSuccess: () => {
      invalidateCompta()
      setModal(null)
    },
  })
  const mutSit = useMutation({
    mutationFn: comptaV1Api.situations.create,
    onSuccess: () => {
      invalidateCompta()
      setModal(null)
    },
  })
  const mutAv = useMutation({
    mutationFn: comptaV1Api.avoirs.create,
    onSuccess: () => {
      invalidateCompta()
      setModal(null)
    },
  })

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Commercial', to: '/crm' },
        { label: 'Compta (fondation)' },
      ]}
      moduleBarLabel="Comptabilité"
      title="Règlements, situations et avoirs"
      actions={
        isLab ? (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal('reglement')}>
              + Règlement
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal('situation')}>
              + Situation
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal('avoir')}>
              + Avoir
            </button>
          </span>
        ) : null
      }
    >
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Tables d’appui BDC-139 : suivi comptable (règlements, situations de travaux, avoirs).{' '}
        {isLab ? 'Création réservée au rôle lab.' : 'Lecture selon vos droits.'}
      </p>

      <h2 className="h2" style={{ fontSize: '1.1rem' }}>
        Règlements
      </h2>
      {lr && <p className="text-muted">Chargement…</p>}
      {!lr && !regs?.length && <p className="text-muted" style={{ marginBottom: '1.25rem' }}>Aucun règlement.</p>}
      {!!regs?.length && (
        <div className="table-wrap" style={{ marginBottom: '2rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Facture</th>
                <th>Mode</th>
                <th>Date</th>
                <th>Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.numero}</code>
                  </td>
                  <td>#{r.client_id}</td>
                  <td>{r.invoice_id ?? '—'}</td>
                  <td>{r.payment_mode}</td>
                  <td>{String(r.payment_date).slice(0, 10)}</td>
                  <td>{formatMoney(Number(r.amount_ttc))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="h2" style={{ fontSize: '1.1rem' }}>
        Situations de travaux
      </h2>
      {ls && <p className="text-muted">Chargement…</p>}
      {!ls && !sit?.length && <p className="text-muted" style={{ marginBottom: '1.25rem' }}>Aucune situation.</p>}
      {!!sit?.length && (
        <div className="table-wrap" style={{ marginBottom: '2rem' }}>
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Dossier</th>
                <th>Libellé</th>
                <th>%</th>
                <th>HT</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {sit.map((s) => (
                <tr key={s.id}>
                  <td>
                    <code>{s.numero}</code>
                  </td>
                  <td>#{s.dossier_id}</td>
                  <td>{s.label}</td>
                  <td>{s.percent_complete}</td>
                  <td>{formatMoney(Number(s.amount_ht))}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="h2" style={{ fontSize: '1.1rem' }}>
        Avoirs (credits)
      </h2>
      {la && <p className="text-muted">Chargement…</p>}
      {!la && !av?.length && <p className="text-muted">Aucun avoir.</p>}
      {!!av?.length && (
        <div className="table-wrap">
          <table className="data-table data-table--compact" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Facture source</th>
                <th>TTC</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {av.map((a) => (
                <tr key={a.id}>
                  <td>
                    <code>{a.numero}</code>
                  </td>
                  <td>#{a.client_id}</td>
                  <td>#{a.source_invoice_id}</td>
                  <td>{formatMoney(Number(a.amount_ttc))}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isLab && modal === 'reglement' && (
        <Modal
          title="Nouveau règlement"
          onClose={() => {
            setModal(null)
            setRegClient(0)
          }}
        >
          <form
            className="quote-form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const clientId = Number(fd.get('client_id'))
              const invRaw = fd.get('invoice_id')
              const invoiceId = invRaw && String(invRaw) !== '' ? Number(invRaw) : null
              mutReg.mutate({
                client_id: clientId,
                invoice_id: invoiceId,
                amount_ttc: Number(fd.get('amount_ttc')),
                payment_mode: String(fd.get('payment_mode') || 'virement'),
                payment_date: String(fd.get('payment_date')),
                notes: (fd.get('notes') as string) || null,
              })
            }}
          >
            <label>
              Client *
              <select
                name="client_id"
                required
                value={regClient || ''}
                onChange={(e) => setRegClient(Number(e.target.value) || 0)}
              >
                <option value="">Choisir…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Facture (optionnel)
              <select name="invoice_id" disabled={regClient <= 0}>
                <option value="">—</option>
                {invList.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} — {String(i.invoice_date).slice(0, 10)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Montant TTC (DH) *
              <input name="amount_ttc" type="number" min={0} step={0.01} required />
            </label>
            <label>
              Mode de paiement
              <select name="payment_mode" defaultValue="virement">
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date de paiement *
              <input name="payment_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Notes
              <textarea name="notes" rows={2} />
            </label>
            {mutReg.isError && <p className="error" style={{ gridColumn: '1 / -1' }}>{(mutReg.error as Error).message}</p>}
            <div className="crud-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={mutReg.isPending}>
                {mutReg.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isLab && modal === 'situation' && (
        <Modal title="Nouvelle situation de travaux" onClose={() => setModal(null)}>
          <form
            className="quote-form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const invRaw = fd.get('invoice_id')
              mutSit.mutate({
                dossier_id: Number(fd.get('dossier_id')),
                invoice_id: invRaw && String(invRaw) !== '' ? Number(invRaw) : null,
                label: String(fd.get('label')),
                percent_complete: Number(fd.get('percent_complete') || 0),
                amount_ht: Number(fd.get('amount_ht') || 0),
                status: String(fd.get('status') || 'brouillon'),
              })
            }}
          >
            <label>
              Dossier *
              <select name="dossier_id" required>
                <option value="">Choisir…</option>
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.reference} — {d.titre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Libellé *
              <input name="label" required maxLength={255} placeholder="ex. Situ. n°2 — gros œuvre" />
            </label>
            <label>
              % avancement
              <input name="percent_complete" type="number" min={0} max={100} step={0.1} defaultValue={0} />
            </label>
            <label>
              Montant HT (DH)
              <input name="amount_ht" type="number" min={0} step={0.01} defaultValue={0} />
            </label>
            <label>
              Statut
              <input name="status" type="text" defaultValue="brouillon" maxLength={32} />
            </label>
            <label>
              Facture liée (optionnel)
              <input name="invoice_id" type="number" min={1} placeholder="ID facture" />
            </label>
            {mutSit.isError && <p className="error" style={{ gridColumn: '1 / -1' }}>{(mutSit.error as Error).message}</p>}
            <div className="crud-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={mutSit.isPending}>
                {mutSit.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isLab && modal === 'avoir' && (
        <Modal
          title="Nouvel avoir"
          onClose={() => {
            setModal(null)
            setAvoirClient(0)
          }}
        >
          <form
            className="quote-form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              mutAv.mutate({
                client_id: Number(fd.get('client_id')),
                source_invoice_id: Number(fd.get('source_invoice_id')),
                amount_ttc: Number(fd.get('amount_ttc')),
                reason: (fd.get('reason') as string) || null,
                status: String(fd.get('status') || 'brouillon'),
              })
            }}
          >
            <label>
              Client *
              <select
                name="client_id"
                required
                value={avoirClient || ''}
                onChange={(e) => setAvoirClient(Number(e.target.value) || 0)}
              >
                <option value="">Choisir…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Facture source *
              <select name="source_invoice_id" required disabled={avoirClient <= 0}>
                <option value="">Choisir…</option>
                {invList.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} — {formatMoney(Number(i.amount_ttc))} TTC
                  </option>
                ))}
              </select>
            </label>
            <label>
              Montant TTC (DH) *
              <input name="amount_ttc" type="number" min={0} step={0.01} required />
            </label>
            <label>
              Statut
              <input name="status" type="text" defaultValue="brouillon" maxLength={32} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Motif
              <textarea name="reason" rows={2} />
            </label>
            {mutAv.isError && <p className="error" style={{ gridColumn: '1 / -1' }}>{(mutAv.error as Error).message}</p>}
            <div className="crud-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={mutAv.isPending}>
                {mutAv.isPending ? 'Enregistrement…' : 'Enregistrer'}
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
