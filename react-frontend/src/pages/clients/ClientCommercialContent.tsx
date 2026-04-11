import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clientsApi,
  clientAddressesApi,
  attachmentsApi,
  commercialLinksApi,
  pdfApi,
  type ClientAddress,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const ADDR_TYPES: Record<string, string> = {
  billing: 'Facturation',
  delivery: 'Livraison',
  site: 'Chantier',
  headquarters: 'Siège',
}

type Props = { clientId: number }

export default function ClientCommercialContent({ clientId: id }: Props) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'lab_admin'
  const queryClient = useQueryClient()
  const [newAddr, setNewAddr] = useState<Partial<ClientAddress>>({
    type: 'billing',
    line1: '',
    city: '',
    postal_code: '',
    country: 'FR',
    is_default: false,
  })
  const [linkForm, setLinkForm] = useState({
    source_type: 'quote',
    source_id: 0,
    target_type: 'invoice',
    target_id: 0,
    relation: 'related',
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-commercial', id],
    queryFn: () => clientsApi.commercialOverview(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  const createAddrMut = useMutation({
    mutationFn: () => clientAddressesApi.create(id, newAddr),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-commercial', id] })
      setNewAddr({ type: 'billing', line1: '', city: '', postal_code: '', country: 'FR', is_default: false })
    },
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(file, 'client', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-commercial', id] })
      queryClient.invalidateQueries({ queryKey: ['client-attachments', id] })
    },
  })

  const linkMut = useMutation({
    mutationFn: () => commercialLinksApi.create(linkForm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-commercial', id] }),
  })

  if (isLoading) return <p>Chargement…</p>
  if (error || !data) return <p className="error">{(error as Error)?.message ?? 'Erreur'}</p>

  const { client, quotes, invoices, stats, document_links: docLinks } = data

  return (
    <>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Synthèse</h2>
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>
            <strong>Montant dû (TTC)</strong> : {stats.amount_due_ttc.toFixed(2)} € (factures non payées, hors
            brouillon)
          </li>
          <li>
            <strong>Total facturé (TTC)</strong> : {stats.total_invoiced_ttc.toFixed(2)} €
          </li>
          <li>
            <strong>Total devis (TTC)</strong> : {stats.total_quotes_ttc.toFixed(2)} €
          </li>
          <li>
            <strong>Devis ouverts</strong> : {stats.open_quotes_count}
          </li>
        </ul>
        <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#64748b' }}>
          Répartition devis : {JSON.stringify(stats.quotes_by_status)} — Factures :{' '}
          {JSON.stringify(stats.invoices_by_status)}
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Adresses (facturation, livraison, chantier…)</h2>
        <ul>
          {(client.addresses ?? []).map((a) => (
            <li key={a.id}>
              <strong>{ADDR_TYPES[a.type] ?? a.type}</strong>
              {a.label ? ` — ${a.label}` : ''} : {a.line1}, {a.postal_code} {a.city}
              {a.is_default ? ' (défaut)' : ''}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem' }}>Ajouter une adresse</h3>
            <div className="form-group">
              <label>Type</label>
              <select
                value={newAddr.type}
                onChange={(e) => setNewAddr((s) => ({ ...s, type: e.target.value }))}
              >
                {Object.entries(ADDR_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Libellé</label>
              <input value={newAddr.label ?? ''} onChange={(e) => setNewAddr((s) => ({ ...s, label: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Ligne 1 *</label>
              <input
                required
                value={newAddr.line1 ?? ''}
                onChange={(e) => setNewAddr((s) => ({ ...s, line1: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>CP / Ville</label>
              <input
                style={{ width: '30%', marginRight: '0.5rem' }}
                value={newAddr.postal_code ?? ''}
                onChange={(e) => setNewAddr((s) => ({ ...s, postal_code: e.target.value }))}
              />
              <input
                style={{ width: '60%' }}
                value={newAddr.city ?? ''}
                onChange={(e) => setNewAddr((s) => ({ ...s, city: e.target.value }))}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                type="checkbox"
                checked={!!newAddr.is_default}
                onChange={(e) => setNewAddr((s) => ({ ...s, is_default: e.target.checked }))}
              />
              Adresse par défaut pour ce type
            </label>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '0.5rem' }}
              disabled={!newAddr.line1?.trim() || createAddrMut.isPending}
              onClick={() => createAddrMut.mutate()}
            >
              Enregistrer l&apos;adresse
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Pièces jointes (aperçu)</h2>
        <p style={{ marginTop: 0, fontSize: '0.9rem', color: '#64748b' }}>
          Gestion complète des fichiers dans l’onglet <strong>Documents</strong>.
        </p>
        <ul>
          {(client.attachments ?? []).slice(0, 5).map((att) => (
            <li key={att.id}>
              <button type="button" className="btn-link" onClick={() => attachmentsApi.download(att.id, att.original_filename)}>
                {att.original_filename}
              </button>{' '}
              ({Math.round(att.size_bytes / 1024)} Ko)
            </li>
          ))}
        </ul>
        {isAdmin && (
          <input
            type="file"
            style={{ marginTop: '0.5rem' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadMut.mutate(f)
              e.target.value = ''
            }}
          />
        )}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Devis</h2>
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Statut</th>
              <th>TTC</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td>{q.number}</td>
                <td>{new Date(q.quote_date).toLocaleDateString('fr-FR')}</td>
                <td>{q.status}</td>
                <td>{Number(q.amount_ttc).toFixed(2)} €</td>
                <td>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => pdfApi.generate('quote', q.id, q.pdf_template_id)}>
                    Télécharger
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Factures</h2>
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Statut</th>
              <th>TTC</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.number}</td>
                <td>{new Date(inv.invoice_date).toLocaleDateString('fr-FR')}</td>
                <td>{inv.status}</td>
                <td>{Number(inv.amount_ttc).toFixed(2)} €</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => pdfApi.generate('invoice', inv.id, inv.pdf_template_id)}
                  >
                    Télécharger
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Liens entre documents (cycle de vie)</h2>
        <ul>
          {docLinks.map((l) => (
            <li key={l.id}>
              {l.source_type} #{l.source_id} → {l.target_type} #{l.target_id} ({l.relation})
            </li>
          ))}
        </ul>
        {isAdmin && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.9rem' }}>Créer un lien (traçabilité)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={linkForm.source_type}
                onChange={(e) => setLinkForm((s) => ({ ...s, source_type: e.target.value }))}
              >
                <option value="quote">Devis</option>
                <option value="invoice">Facture</option>
                <option value="order">Commande</option>
              </select>
              <input
                type="number"
                placeholder="ID source"
                value={linkForm.source_id || ''}
                onChange={(e) => setLinkForm((s) => ({ ...s, source_id: Number(e.target.value) }))}
              />
              <span>→</span>
              <select
                value={linkForm.target_type}
                onChange={(e) => setLinkForm((s) => ({ ...s, target_type: e.target.value }))}
              >
                <option value="quote">Devis</option>
                <option value="invoice">Facture</option>
                <option value="order">Commande</option>
              </select>
              <input
                type="number"
                placeholder="ID cible"
                value={linkForm.target_id || ''}
                onChange={(e) => setLinkForm((s) => ({ ...s, target_id: Number(e.target.value) }))}
              />
              <select
                value={linkForm.relation}
                onChange={(e) => setLinkForm((s) => ({ ...s, relation: e.target.value }))}
              >
                <option value="related">Lié</option>
                <option value="converted_to">Transformé en</option>
                <option value="replaces">Remplace</option>
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => linkMut.mutate()}>
                Créer le lien
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
