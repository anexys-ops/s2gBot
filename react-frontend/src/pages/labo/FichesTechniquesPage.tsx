/**
 * v1.2.0 — Aperçu des fiches techniques (FormTemplate).
 *
 * Liste les `report_form_definitions` actives et permet de saisir une fiche
 * en local via le composant DynamicForm. Pas de persistance côté serveur
 * dans cette première itération — c'est un aperçu / sandbox pour valider la
 * définition JSON. La sauvegarde sera branchée à la prochaine étape via
 * MissionTask.measures.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportFormDefinitionsApi, type ReportFormDefinitionRow } from '../../api/client'
import DynamicForm, { type DynamicField, type DynamicFormValues } from '../../components/forms/DynamicForm'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

export default function FichesTechniquesPage() {
  const [serviceKey, setServiceKey] = useState<string>('')
  const [activeSlug, setActiveSlug] = useState<string>('')
  const [values, setValues] = useState<DynamicFormValues>({})

  const { data, isLoading } = useQuery({
    queryKey: ['report-form-definitions', serviceKey],
    queryFn: () => reportFormDefinitionsApi.list(serviceKey || undefined),
  })

  const definitions: ReportFormDefinitionRow[] = data?.data ?? []
  const active = useMemo(
    () => definitions.find((d) => d.slug === activeSlug) ?? definitions[0],
    [definitions, activeSlug],
  )

  return (
    <ModuleEntityShell
      shellClassName="module-shell--labo"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Labo', to: '/labo' },
        { label: 'Fiches techniques' },
      ]}
      moduleBarLabel="Labo"
      title="Fiches techniques (formulaires dynamiques)"
      subtitle="Aperçu des modèles de fiches définis en JSON. Les modèles seedés v1.2.0 incluent compression béton, Proctor (avec courbe), densité in situ et pressiomètre Ménard."
    >
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
          <span>Service</span>
          <select className="form-control" value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
            <option value="">Tous</option>
            <option value="labo">Labo</option>
            <option value="terrain">Terrain</option>
            <option value="ingenieur">Ingénieur</option>
          </select>
        </label>
      </div>

      {isLoading && <p className="text-muted">Chargement…</p>}

      {!isLoading && definitions.length === 0 && (
        <div className="card" style={{ padding: '1rem' }}>
          <p className="text-muted" style={{ margin: 0 }}>
            Aucun modèle actif. Lancez le seeder <code>GeotechniqueV12Seeder</code> pour générer les 4 fiches de démo.
          </p>
        </div>
      )}

      {definitions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem' }}>
          <aside className="card" style={{ padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {definitions.map((d) => {
              const isActive = d.slug === (active?.slug ?? '')
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { setActiveSlug(d.slug); setValues({}) }}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${isActive ? '#3B82F6' : '#e5e7eb'}`,
                    background: isActive ? '#eff6ff' : '#fff',
                    color: '#111827',
                    borderRadius: '0.4rem', padding: '0.5rem 0.6rem',
                    cursor: 'pointer', fontSize: '0.85rem',
                  }}
                >
                  <strong style={{ display: 'block' }}>{d.name}</strong>
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {d.service_key ?? '—'} · {d.fields?.length ?? 0} champs
                  </span>
                </button>
              )
            })}
          </aside>

          <section className="card" style={{ padding: '1rem' }}>
            {active ? (
              <>
                <header style={{ marginBottom: '0.8rem' }}>
                  <h3 style={{ margin: 0 }}>{active.name}</h3>
                  <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                    slug : <code>{active.slug}</code>
                  </span>
                </header>
                <DynamicForm
                  fields={active.fields as DynamicField[]}
                  value={values}
                  onChange={setValues}
                />
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#6b7280' }}>
                    Aperçu JSON (saisie courante)
                  </summary>
                  <pre style={{
                    background: '#f9fafb', padding: '0.6rem', borderRadius: '0.4rem',
                    fontSize: '0.78rem', overflow: 'auto', marginTop: '0.4rem',
                  }}>{JSON.stringify(values, null, 2)}</pre>
                </details>
              </>
            ) : (
              <p className="text-muted">Sélectionnez une fiche.</p>
            )}
          </section>
        </div>
      )}
    </ModuleEntityShell>
  )
}
