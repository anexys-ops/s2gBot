import { useState } from 'react'
import type { QuoteFormState, ContextMode } from '../QuoteFormFields'
import type { Site, DossierRow } from '../../../api/client'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  clients: { id: number; name: string }[]
  allSites: Site[]
  dossiers: DossierRow[]
}

export default function WizardStep1Context({ form, setForm, clients, allSites, dossiers }: Props) {
  const [search, setSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    form.client_id > 0 ? form.client_id : null,
  )

  const mode: ContextMode = form.contextMode

  const setMode = (m: ContextMode) => {
    setForm((f) => ({ ...f, contextMode: m }))
    setSearch('')
    setSelectedClientId(null)
  }

  const q = search.toLowerCase()

  const filteredClients = clients.filter((c) => c.name.toLowerCase().includes(q))
  const filteredSites = allSites.filter(
    (s) => s.name.toLowerCase().includes(q) || String(s.client_id).includes(q),
  )
  const filteredDossiers = dossiers.filter(
    (d) =>
      d.reference?.toLowerCase().includes(q) ||
      d.titre?.toLowerCase().includes(q) ||
      String(d.client_id).includes(q),
  )

  const sitesForSelectedClient =
    selectedClientId != null
      ? allSites.filter((s) => s.client_id === selectedClientId)
      : []

  return (
    <div className="qw-body">
      <p className="qw-section-title">Client &amp; Chantier</p>
      <p className="qw-section-sub">Sélectionnez le contexte du devis.</p>

      <div className="qw-mode-btns">
        <button
          type="button"
          className={`qw-mode-btn${mode === 'client' ? ' qw-mode-btn--active' : ''}`}
          onClick={() => setMode('client')}
        >
          Client
        </button>
        <button
          type="button"
          className={`qw-mode-btn${mode === 'chantier' ? ' qw-mode-btn--active' : ''}`}
          onClick={() => setMode('chantier')}
        >
          Chantier
        </button>
        <button
          type="button"
          className={`qw-mode-btn${mode === 'dossier' ? ' qw-mode-btn--active' : ''}`}
          onClick={() => setMode('dossier')}
        >
          Dossier
        </button>
      </div>

      <input
        className="qw-search"
        type="search"
        placeholder="Rechercher…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {mode === 'client' && (
        <>
          <div className="qw-tiles">
            {filteredClients.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`qw-tile${form.client_id === c.id ? ' qw-tile--selected' : ''}`}
                onClick={() => {
                  setSelectedClientId(c.id)
                  setForm((f) => ({
                    ...f,
                    client_id: c.id,
                    site_id: undefined,
                    dossier_id: undefined,
                    contextMode: 'client',
                  }))
                }}
              >
                <div className="qw-tile__name">{c.name}</div>
                <div className="qw-tile__sub">#{c.id}</div>
              </button>
            ))}
            {filteredClients.length === 0 && (
              <p style={{ color: '#6b7280', fontSize: '.88rem' }}>Aucun client trouvé.</p>
            )}
          </div>

          {selectedClientId != null && sitesForSelectedClient.length > 0 && (
            <>
              <p style={{ marginTop: '1.5rem', fontWeight: 600, color: '#374151' }}>
                Chantier associé (optionnel)
              </p>
              <div className="qw-tiles">
                <button
                  type="button"
                  className={`qw-tile${!form.site_id ? ' qw-tile--selected' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, site_id: undefined }))}
                >
                  <div className="qw-tile__name">Aucun chantier</div>
                  <div className="qw-tile__sub">Devis au niveau client</div>
                </button>
                {sitesForSelectedClient.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`qw-tile${form.site_id === s.id ? ' qw-tile--selected' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, site_id: s.id }))}
                  >
                    <div className="qw-tile__name">{s.name}</div>
                    <div className="qw-tile__sub">#{s.id}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {mode === 'chantier' && (
        <div className="qw-tiles">
          {filteredSites.map((s) => {
            const clientName = clients.find((c) => c.id === s.client_id)?.name ?? `Client #${s.client_id}`
            return (
              <button
                key={s.id}
                type="button"
                className={`qw-tile${form.site_id === s.id ? ' qw-tile--selected' : ''}`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    site_id: s.id,
                    client_id: s.client_id,
                    dossier_id: undefined,
                    contextMode: 'chantier',
                  }))
                }
              >
                <div className="qw-tile__name">{s.name}</div>
                <div className="qw-tile__sub">{clientName}</div>
              </button>
            )
          })}
          {filteredSites.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '.88rem' }}>Aucun chantier trouvé.</p>
          )}
        </div>
      )}

      {mode === 'dossier' && (
        <div className="qw-tiles">
          {filteredDossiers.map((d) => {
            const clientName = clients.find((c) => c.id === d.client_id)?.name ?? `Client #${d.client_id}`
            return (
              <button
                key={d.id}
                type="button"
                className={`qw-tile${form.dossier_id === d.id ? ' qw-tile--selected' : ''}`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    dossier_id: d.id,
                    client_id: d.client_id,
                    site_id: d.site_id,
                    contextMode: 'dossier',
                  }))
                }
              >
                <div className="qw-tile__name">
                  {d.reference ? `${d.reference} — ` : ''}
                  {d.titre}
                </div>
                <div className="qw-tile__sub">{clientName}</div>
              </button>
            )
          })}
          {filteredDossiers.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '.88rem' }}>Aucun dossier trouvé.</p>
          )}
        </div>
      )}
    </div>
  )
}
