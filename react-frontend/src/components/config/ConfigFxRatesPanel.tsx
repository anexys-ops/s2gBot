import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fxRatesApi, moduleSettingsApi } from '../../api/client'
import { formatAppDateTime } from '../../lib/appLocale'
import { CORE_CURRENCIES, type CurrencyRow } from '../../lib/currencies'

type ExtraCurrency = { code: string; label: string; name: string }

function parseFallbackRates(raw: Record<string, number> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [code, value] of Object.entries(raw ?? {})) {
    out[code] = String(value)
  }
  return out
}

export default function ConfigFxRatesPanel() {
  const queryClient = useQueryClient()

  const { data: settingsRow, isLoading: settingsLoading } = useQuery({
    queryKey: ['module-settings', 'fx_rates'],
    queryFn: () => moduleSettingsApi.get('fx_rates'),
  })

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['fx-rates-status'],
    queryFn: () => fxRatesApi.status(),
  })

  const [fxEnabled, setFxEnabled] = useState(true)
  const [fxProvider, setFxProvider] = useState('frankfurter')
  const [fxCacheTtl, setFxCacheTtl] = useState('360')
  const [extraCurrencies, setExtraCurrencies] = useState<ExtraCurrency[]>([])
  const [fallbackRates, setFallbackRates] = useState<Record<string, string>>({})
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (!settingsRow?.settings) return
    const s = settingsRow.settings
    setFxEnabled(s.enabled !== false)
    setFxProvider(String(s.provider ?? 'frankfurter'))
    setFxCacheTtl(String(s.cache_ttl_minutes ?? 360))
    setExtraCurrencies(Array.isArray(s.extra_currencies) ? (s.extra_currencies as ExtraCurrency[]) : [])
    setFallbackRates(parseFallbackRates(s.fallback_rates as Record<string, number> | undefined))
  }, [settingsRow])

  const catalogCodes = useMemo(() => {
    const codes = new Set<string>()
    CORE_CURRENCIES.forEach((c) => codes.add(c.code))
    extraCurrencies.forEach((c) => {
      if (c.code.trim()) codes.add(c.code.trim().toUpperCase())
    })
    status?.rates?.forEach((r) => codes.add(r.code))
    codes.delete('MAD')
    return [...codes].sort()
  }, [extraCurrencies, status?.rates])

  const saveMut = useMutation({
    mutationFn: () => {
      const parsedFallback: Record<string, number> = {}
      for (const code of catalogCodes) {
        const raw = (fallbackRates[code] ?? '').trim()
        if (!raw) continue
        const n = parseFloat(raw.replace(',', '.'))
        if (Number.isFinite(n) && n > 0) parsedFallback[code] = n
      }
      const cache = parseInt(fxCacheTtl, 10)
      return moduleSettingsApi.update('fx_rates', {
        enabled: fxEnabled,
        provider: fxProvider,
        base_currency: 'MAD',
        cache_ttl_minutes: Number.isFinite(cache) && cache >= 5 ? cache : 360,
        extra_currencies: extraCurrencies
          .map((c) => ({
            code: c.code.trim().toUpperCase(),
            label: c.label.trim(),
            name: c.name.trim(),
          }))
          .filter((c) => c.code.length === 3),
        fallback_rates: parsedFallback,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module-settings', 'fx_rates'] })
      queryClient.invalidateQueries({ queryKey: ['fx-rates-status'] })
      queryClient.invalidateQueries({ queryKey: ['currencies'] })
    },
  })

  const refreshMut = useMutation({
    mutationFn: () => fxRatesApi.refresh(),
    onSuccess: (data) => {
      queryClient.setQueryData(['fx-rates-status'], data)
      void refetchStatus()
    },
  })

  const addExtraCurrency = () => {
    const code = newCode.trim().toUpperCase()
    if (code.length !== 3) return
    if ([...CORE_CURRENCIES, ...extraCurrencies].some((c) => c.code === code)) return
    setExtraCurrencies((prev) => [
      ...prev,
      {
        code,
        label: newLabel.trim() || code,
        name: newName.trim() || code,
      },
    ])
    setNewCode('')
    setNewLabel('')
    setNewName('')
  }

  const addPresetXof = () => {
    if (extraCurrencies.some((c) => c.code === 'XOF') || CORE_CURRENCIES.some((c) => c.code === 'XOF')) return
    setExtraCurrencies((prev) => [
      ...prev,
      { code: 'XOF', label: 'FCFA', name: 'Franc CFA (BCEAO)' },
    ])
    setFallbackRates((prev) => ({ ...prev, XOF: prev.XOF ?? '0.0165' }))
  }

  if (settingsLoading) return <p>Chargement…</p>

  return (
    <div className="config-fx-rates">
      <p className="text-muted" style={{ maxWidth: '70ch' }}>
        API gratuite <strong>Frankfurter</strong> (sans clé) pour actualiser les taux vers le dirham (MAD). Les taux de
        repli s&apos;appliquent si l&apos;API est indisponible ou si la devise n&apos;est pas couverte.
      </p>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 className="config-fx-rates__title">Paramètres API</h3>
        <div className="form-group">
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="checkbox" checked={fxEnabled} onChange={(e) => setFxEnabled(e.target.checked)} />
            Activer la récupération automatique des taux
          </label>
        </div>
        <div className="form-group">
          <label>Fournisseur</label>
          <select value={fxProvider} onChange={(e) => setFxProvider(e.target.value)}>
            <option value="frankfurter">Frankfurter (gratuit, sans clé API)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Durée de cache (minutes)</label>
          <input type="number" min={5} value={fxCacheTtl} onChange={(e) => setFxCacheTtl(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="config-fx-rates__header-row">
          <h3 className="config-fx-rates__title">Devises disponibles</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addPresetXof}>
            + Franc CFA (XOF)
          </button>
        </div>
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
          Devises intégrées : MAD, EUR, USD, GBP, CHF, CAD, SAR, AED, XOF, XAF. Ajoutez d&apos;autres codes ISO 4217
          ci-dessous.
        </p>
        {extraCurrencies.length > 0 ? (
          <table className="data-table data-table--compact" style={{ marginTop: '0.75rem' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Symbole</th>
                <th>Nom</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {extraCurrencies.map((row, index) => (
                <tr key={`${row.code}-${index}`}>
                  <td>
                    <input
                      type="text"
                      maxLength={3}
                      value={row.code}
                      onChange={(e) =>
                        setExtraCurrencies((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, code: e.target.value.toUpperCase() } : item)),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setExtraCurrencies((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) =>
                        setExtraCurrencies((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExtraCurrencies((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>
            Aucune devise supplémentaire.
          </p>
        )}
        <div className="quote-form-grid" style={{ marginTop: '0.75rem' }}>
          <label>
            Code ISO (3 lettres)
            <input type="text" maxLength={3} value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="XOF" />
          </label>
          <label>
            Symbole affiché
            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="FCFA" />
          </label>
          <label>
            Nom
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Franc CFA (BCEAO)" />
          </label>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={addExtraCurrency}>
          Ajouter la devise
        </button>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 className="config-fx-rates__title">Taux de repli (1 unité étrangère → MAD)</h3>
        <div className="quote-form-grid">
          {catalogCodes.map((code) => (
            <label key={code}>
              {code} → MAD
              <input
                type="text"
                value={fallbackRates[code] ?? ''}
                onChange={(e) => setFallbackRates((prev) => ({ ...prev, [code]: e.target.value }))}
                placeholder="—"
              />
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button type="button" className="btn btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
          {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer la configuration'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={refreshMut.isPending}
          onClick={() => refreshMut.mutate()}
        >
          {refreshMut.isPending ? 'Actualisation…' : 'Forcer la mise à jour des taux'}
        </button>
      </div>
      {saveMut.isError ? <p className="error">{(saveMut.error as Error).message}</p> : null}
      {refreshMut.isError ? <p className="error">{(refreshMut.error as Error).message}</p> : null}

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 className="config-fx-rates__title">Taux en cache</h3>
        {status?.last_refresh_at ? (
          <p className="text-muted" style={{ marginTop: 0 }}>
            Dernière actualisation forcée : {formatAppDateTime(status.last_refresh_at)}
          </p>
        ) : (
          <p className="text-muted" style={{ marginTop: 0 }}>
            Aucune actualisation forcée enregistrée — les taux se mettent à jour selon le cache ou à l&apos;enregistrement
            d&apos;un document.
          </p>
        )}
        {statusLoading ? (
          <p>Chargement des taux…</p>
        ) : (
          <table className="data-table data-table--compact" style={{ marginTop: '0.75rem' }}>
            <thead>
              <tr>
                <th>Devise</th>
                <th>Taux → MAD</th>
                <th>Dernière MAJ</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(status?.rates ?? []).map((row) => (
                <tr key={row.code}>
                  <td>
                    {row.name} ({row.code})
                  </td>
                  <td>{row.rate != null ? row.rate.toLocaleString('fr-FR', { maximumFractionDigits: 6 }) : '—'}</td>
                  <td>{row.fetched_at ? formatAppDateTime(row.fetched_at) : '—'}</td>
                  <td>{row.source === 'api' ? 'API' : row.source === 'fallback' ? 'Repli' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
