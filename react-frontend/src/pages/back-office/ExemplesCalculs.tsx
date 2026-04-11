import { useQuery, useMutation } from '@tanstack/react-query'
import { btpCalculationsApi, type BtpExempleCalcul } from '../../api/client'
import { useState } from 'react'

function ExempleCard({ ex }: { ex: BtpExempleCalcul }) {
  const [valeurs, setValeurs] = useState<Record<string, string>>({})
  const calculMutation = useMutation({
    mutationFn: (vals: Record<string, unknown>) => btpCalculationsApi.calculer(ex.id, vals),
  })

  const handleCalculer = () => {
    const parsed: Record<string, unknown> = {}
    if (ex.id === 'resistance_caracteristique_beton') {
      const raw = valeurs['resistances_MPa'] ?? ''
      parsed['resistances_MPa'] = raw.split(/[\s,;]+/).map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n))
      if (valeurs['k']) parsed['k'] = parseFloat(valeurs['k'])
    } else if (ex.id === 'module_finesse') {
      const raw = valeurs['refus_cumules'] ?? ''
      parsed['refus_cumules'] = raw.split(/[\s,;]+/).map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n))
    } else if (ex.id === 'equivalent_sable') {
      parsed['h_sable'] = parseFloat(valeurs['h_sable'] ?? '0')
      parsed['h_total'] = parseFloat(valeurs['h_total'] ?? '0')
    } else if (ex.id === 'cbr') {
      parsed['force_kN'] = parseFloat(valeurs['force_kN'] ?? '0')
      parsed['section_mm2'] = parseFloat(valeurs['section_mm2'] ?? '1963.5')
    } else if (ex.id === 'masse_volumique_apparente') {
      parsed['m_kg'] = parseFloat(valeurs['m_kg'] ?? '0')
      parsed['V_m3'] = parseFloat(valeurs['V_m3'] ?? '0')
    } else if (ex.id === 'teneur_eau') {
      parsed['m_humide'] = parseFloat(valeurs['m_humide'] ?? '0')
      parsed['m_sec'] = parseFloat(valeurs['m_sec'] ?? '0')
    } else if (ex.id === 'indice_plasticite') {
      parsed['WL'] = parseFloat(valeurs['WL'] ?? '0')
      parsed['WP'] = parseFloat(valeurs['WP'] ?? '0')
    }
    calculMutation.mutate(parsed)
  }

  const renderInputs = () => {
    if (ex.id === 'resistance_caracteristique_beton') {
      return (
        <>
          <div className="form-group">
            <label>Résistances (MPa), séparées par des espaces ou virgules</label>
            <input
              placeholder="28.2 30.1 29.5 27.8 31.0"
              value={valeurs['resistances_MPa'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, resistances_MPa: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>k (optionnel, défaut 1.48)</label>
            <input
              type="number"
              step="0.01"
              placeholder="1.48"
              value={valeurs['k'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, k: e.target.value }))}
            />
          </div>
        </>
      )
    }
    if (ex.id === 'module_finesse') {
      return (
        <div className="form-group">
          <label>Refus cumulés (%), 9 valeurs : 0.063 à 16 mm, séparés par espaces/virgules</label>
          <input
            placeholder="2 5 12 25 42 58 72 85 98"
            value={valeurs['refus_cumules'] ?? ''}
            onChange={(e) => setValeurs((v) => ({ ...v, refus_cumules: e.target.value }))}
          />
        </div>
      )
    }
    if (ex.id === 'equivalent_sable') {
      return (
        <>
          <div className="form-group">
            <label>Hauteur sable (mm)</label>
            <input
              type="number"
              value={valeurs['h_sable'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, h_sable: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Hauteur totale (mm)</label>
            <input
              type="number"
              value={valeurs['h_total'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, h_total: e.target.value }))}
            />
          </div>
        </>
      )
    }
    if (ex.id === 'cbr') {
      return (
        <>
          <div className="form-group">
            <label>Force (kN)</label>
            <input
              type="number"
              step="0.01"
              value={valeurs['force_kN'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, force_kN: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Section (mm²)</label>
            <input
              type="number"
              value={valeurs['section_mm2'] ?? '1963.5'}
              onChange={(e) => setValeurs((v) => ({ ...v, section_mm2: e.target.value }))}
            />
          </div>
        </>
      )
    }
    if (ex.id === 'masse_volumique_apparente') {
      return (
        <>
          <div className="form-group">
            <label>Masse (kg)</label>
            <input
              type="number"
              step="0.001"
              value={valeurs['m_kg'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, m_kg: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Volume (m³)</label>
            <input
              type="number"
              step="0.0001"
              value={valeurs['V_m3'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, V_m3: e.target.value }))}
            />
          </div>
        </>
      )
    }
    if (ex.id === 'teneur_eau') {
      return (
        <>
          <div className="form-group">
            <label>Masse humide (g ou kg)</label>
            <input
              type="number"
              value={valeurs['m_humide'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, m_humide: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Masse sèche (g ou kg)</label>
            <input
              type="number"
              value={valeurs['m_sec'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, m_sec: e.target.value }))}
            />
          </div>
        </>
      )
    }
    if (ex.id === 'indice_plasticite') {
      return (
        <>
          <div className="form-group">
            <label>Limite de liquidité WL</label>
            <input
              type="number"
              value={valeurs['WL'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, WL: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Limite de plasticité WP</label>
            <input
              type="number"
              value={valeurs['WP'] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, WP: e.target.value }))}
            />
          </div>
        </>
      )
    }
    return null
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3>{ex.titre}</h3>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{ex.norme}</p>
      <p><strong>Formule :</strong> <code style={{ background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: 4 }}>{ex.formule}</code></p>
      <p style={{ fontSize: '0.9rem' }}>{ex.description}</p>
      <p><strong>Exemple :</strong> entrée = {JSON.stringify(ex.exemple_entree)} → résultat = <strong>{ex.exemple_sortie} {ex.unite}</strong></p>
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
        <p style={{ marginBottom: '0.5rem' }}>Calculer avec vos valeurs :</p>
        {renderInputs()}
        <button type="button" className="btn btn-primary" onClick={handleCalculer} disabled={calculMutation.isPending}>
          {calculMutation.isPending ? 'Calcul...' : 'Calculer'}
        </button>
        {calculMutation.data && (
          <span style={{ marginLeft: '1rem', fontWeight: 600 }}>
            Résultat : {calculMutation.data.resultat} {ex.unite}
          </span>
        )}
        {calculMutation.isError && <span className="error"> {(calculMutation.error as Error).message}</span>}
      </div>
    </div>
  )
}

export default function ExemplesCalculs() {
  const { data: exemples, isLoading, error } = useQuery({
    queryKey: ['btp-calculations-exemples'],
    queryFn: () => btpCalculationsApi.exemples(),
  })

  if (isLoading) return <p>Chargement...</p>
  if (error) return <p className="error">Erreur : {String(error)}</p>

  return (
    <div>
      <p style={{ color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.55 }}>
        Formules courantes pour aller vite sans se tromper. Référentiels NF EN, DTU.
      </p>
      {exemples?.map((ex) => (
        <ExempleCard key={ex.id} ex={ex} />
      ))}
    </div>
  )
}
