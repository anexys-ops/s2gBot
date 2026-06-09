import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipmentsApi, testTypesApi, type TestType } from '../../api/client'
import Modal from '../Modal'

type Props = {
  onClose: () => void
  onCreated?: () => void
}

export default function EquipmentCreateModal({ onClose, onCreated }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', code: '', test_type_ids: [] as number[] })
  const [typeSearch, setTypeSearch] = useState('')

  const { data: testTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ['test-types'],
    queryFn: () => testTypesApi.list(),
  })

  const filteredTypes = useMemo(() => {
    const term = typeSearch.trim().toLowerCase()
    if (!term) return testTypes
    return testTypes.filter((t) => t.name.toLowerCase().includes(term))
  }, [testTypes, typeSearch])

  const createMutation = useMutation({
    mutationFn: () =>
      equipmentsApi.create({
        name: form.name.trim(),
        code: form.code.trim(),
        test_type_ids: form.test_type_ids,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipments'] })
      onCreated?.()
      onClose()
    },
  })

  const canSubmit = form.name.trim() !== '' && form.code.trim() !== '' && !createMutation.isPending

  function toggleType(id: number, checked: boolean) {
    setForm((f) => ({
      ...f,
      test_type_ids: checked ? [...f.test_type_ids, id] : f.test_type_ids.filter((x) => x !== id),
    }))
  }

  return (
    <Modal title="Nouvel équipement" onClose={createMutation.isPending ? () => {} : onClose}>
      <form
        className="catalogue-article-new-form equipment-create-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          createMutation.mutate()
        }}
      >
        <p className="equipment-create-form__intro text-muted">
          Créez une fiche matériel avec un code unique. Les types d&apos;essai liés permettent de filtrer le parc par
          activité laboratoire.
        </p>

        <section className="catalogue-article-new-form__section">
          <h3 className="catalogue-article-new-form__section-title">Identité</h3>
          <div className="catalogue-article-new-form__grid">
            <label className="catalogue-article-new-form__col-4">
              Code unique *
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="Ex. PRES-001"
                required
                maxLength={64}
                autoFocus
              />
            </label>
            <label className="catalogue-article-new-form__col-8">
              Nom *
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Presse à compression, balance…"
                required
                maxLength={255}
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
          <p className="equipment-create-form__types-hint text-muted">Optionnel — cochez les essais réalisables avec cet équipement.</p>

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

        {createMutation.isError ? <p className="error">{(createMutation.error as Error).message}</p> : null}

        <div className="crud-actions catalogue-article-new-form__actions">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {createMutation.isPending ? 'Création…' : 'Créer l’équipement'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={createMutation.isPending} onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  )
}
