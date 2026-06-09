import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { agencesApi, testTypesApi, type TestType } from '../../api/client'
import type { EquipmentFormState } from './equipmentFormUtils'
import { EQUIPMENT_STATUS_OPTIONS } from './equipmentFormUtils'

type Props = {
  form: EquipmentFormState
  onChange: (next: EquipmentFormState) => void
  codeReadOnly?: boolean
  autoFocusCode?: boolean
}

export default function EquipmentFormFields({
  form,
  onChange,
  codeReadOnly = false,
  autoFocusCode = false,
}: Props) {
  const [typeSearch, setTypeSearch] = useState('')

  const { data: agencies = [] } = useQuery({
    queryKey: ['agences'],
    queryFn: () => agencesApi.list(),
  })

  const { data: testTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ['test-types'],
    queryFn: () => testTypesApi.list(),
  })

  const filteredTypes = useMemo(() => {
    const term = typeSearch.trim().toLowerCase()
    if (!term) return testTypes
    return testTypes.filter((t) => t.name.toLowerCase().includes(term))
  }, [testTypes, typeSearch])

  function toggleType(id: number, checked: boolean) {
    onChange({
      ...form,
      test_type_ids: checked
        ? [...form.test_type_ids, id]
        : form.test_type_ids.filter((x) => x !== id),
    })
  }

  const activeAgencies = agencies.filter((a) => a.active)

  return (
    <>
      <section className="catalogue-article-new-form__section">
        <h3 className="catalogue-article-new-form__section-title">Identité</h3>
        <div className="catalogue-article-new-form__grid">
          <label className="catalogue-article-new-form__col-4">
            Code unique *
            <input
              value={form.code}
              onChange={(e) => onChange({ ...form, code: e.target.value })}
              placeholder="Ex. PRES-001"
              required
              maxLength={64}
              readOnly={codeReadOnly}
              autoFocus={autoFocusCode}
            />
          </label>
          <label className="catalogue-article-new-form__col-8">
            Nom *
            <input
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Presse à compression, balance…"
              required
              maxLength={255}
              autoFocus={codeReadOnly && autoFocusCode}
            />
          </label>
          <label className="catalogue-article-new-form__col-4">
            Type / catégorie
            <input
              value={form.type}
              onChange={(e) => onChange({ ...form, type: e.target.value })}
              placeholder="Presse, balance, étuve…"
              maxLength={128}
            />
          </label>
          <label className="catalogue-article-new-form__col-4">
            Statut
            <select
              value={form.status}
              onChange={(e) =>
                onChange({ ...form, status: e.target.value as EquipmentFormState['status'] })
              }
            >
              {EQUIPMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="catalogue-article-new-form__col-4">
            Agence
            <select
              value={form.agency_id}
              onChange={(e) => onChange({ ...form, agency_id: e.target.value })}
            >
              <option value="">— Aucune —</option>
              {activeAgencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="catalogue-article-new-form__section">
        <h3 className="catalogue-article-new-form__section-title">Caractéristiques techniques</h3>
        <div className="catalogue-article-new-form__grid">
          <label className="catalogue-article-new-form__col-4">
            Marque
            <input
              value={form.brand}
              onChange={(e) => onChange({ ...form, brand: e.target.value })}
              maxLength={128}
            />
          </label>
          <label className="catalogue-article-new-form__col-4">
            Modèle
            <input
              value={form.model}
              onChange={(e) => onChange({ ...form, model: e.target.value })}
              maxLength={128}
            />
          </label>
          <label className="catalogue-article-new-form__col-4">
            N° de série
            <input
              value={form.serial_number}
              onChange={(e) => onChange({ ...form, serial_number: e.target.value })}
              maxLength={128}
            />
          </label>
          <label className="catalogue-article-new-form__col-6 equipment-create-form__location-field">
            <span className="equipment-create-form__field-label">Emplacement</span>
            <input
              value={form.location}
              onChange={(e) => onChange({ ...form, location: e.target.value })}
              placeholder="Labo, local technique…"
              maxLength={255}
            />
          </label>
          <label className="catalogue-article-new-form__col-3 equipment-create-form__purchase-date-field">
            <span className="equipment-create-form__field-label">Date d&apos;achat</span>
            <input
              type="date"
              value={form.purchase_date}
              onChange={(e) => onChange({ ...form, purchase_date: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="catalogue-article-new-form__section">
        <div className="equipment-create-form__types-head">
          <h3 className="catalogue-article-new-form__section-title">Types d&apos;essai liés</h3>
          <span className="badge">
            {form.test_type_ids.length} sélectionné{form.test_type_ids.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="equipment-create-form__types-hint text-muted">
          Optionnel — essais réalisables avec cet équipement.
        </p>

        <label className="equipment-create-form__search">
          <span className="filter-label">Filtrer</span>
          <input
            type="search"
            value={typeSearch}
            onChange={(e) => setTypeSearch(e.target.value)}
            placeholder="Rechercher un type d'essai…"
            autoComplete="off"
          />
        </label>

        <div className="equipment-create-form__types-panel" role="group" aria-label="Types d'essai">
          {typesLoading ? (
            <p className="text-muted equipment-create-form__types-empty">Chargement des types…</p>
          ) : filteredTypes.length === 0 ? (
            <p className="text-muted equipment-create-form__types-empty">
              {testTypes.length === 0 ? 'Aucun type d’essai disponible.' : 'Aucun résultat pour cette recherche.'}
            </p>
          ) : (
            <ul className="equipment-create-form__types-list">
              {filteredTypes.map((t: TestType) => (
                <li key={t.id}>
                  <label className="equipment-create-form__type-option">
                    <input
                      type="checkbox"
                      checked={form.test_type_ids.includes(t.id)}
                      onChange={(e) => toggleType(t.id, e.target.checked)}
                    />
                    <span>{t.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
