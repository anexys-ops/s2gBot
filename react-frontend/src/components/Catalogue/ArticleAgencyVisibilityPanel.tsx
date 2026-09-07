import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agencesApi, catalogueApi, type Agency } from '../../api/client'

type Props = {
  articleId: number
  isMultiSite?: boolean
  visibleLabAgencies?: Pick<Agency, 'id' | 'name' | 'code'>[]
  canEdit: boolean
}

export default function ArticleAgencyVisibilityPanel({
  articleId,
  isMultiSite: initialMultiSite = true,
  visibleLabAgencies = [],
  canEdit,
}: Props) {
  const queryClient = useQueryClient()
  const [multiSite, setMultiSite] = useState(initialMultiSite)
  const [selected, setSelected] = useState<number[]>([])
  const [dirty, setDirty] = useState(false)

  const { data: agences = [], isLoading } = useQuery({
    queryKey: ['agences'],
    queryFn: () => agencesApi.list(),
  })

  const labAgences = agences.filter((a) => a.active !== false)

  useEffect(() => {
    setMultiSite(initialMultiSite)
    setSelected(visibleLabAgencies.map((a) => a.id))
    setDirty(false)
  }, [initialMultiSite, visibleLabAgencies])

  const saveMut = useMutation({
    mutationFn: () =>
      catalogueApi.syncArticleLabVisibility(articleId, {
        is_multi_site: multiSite,
        lab_agency_ids: multiSite ? [] : selected,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogue-article', articleId] })
      setDirty(false)
    },
  })

  const toggleAgency = (id: number) => {
    setDirty(true)
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  if (isLoading) {
    return <p className="text-muted">Chargement des agences…</p>
  }

  return (
    <div className="card extrafields-form" style={{ marginBottom: '1rem' }}>
      <h3 className="ds-form-section__title" style={{ marginTop: 0 }}>
        Visibilité agences
      </h3>
      <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
        Définissez si cet article est disponible sur toutes les agences ou uniquement sur certaines.
      </p>

      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <input
          type="checkbox"
          checked={multiSite}
          disabled={!canEdit}
          onChange={(e) => {
            setDirty(true)
            setMultiSite(e.target.checked)
            if (e.target.checked) setSelected([])
          }}
        />
        Multi-site (visible par toutes les agences)
      </label>

      {!multiSite && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 240, overflow: 'auto' }}>
          {labAgences.length === 0 ? (
            <p className="text-muted">Aucune agence labo configurée.</p>
          ) : (
            labAgences.map((a: Agency) => (
              <label key={a.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(a.id)}
                  disabled={!canEdit}
                  onChange={() => toggleAgency(a.id)}
                />
                {a.name}
                {a.code ? ` (${a.code})` : ''}
              </label>
            ))
          )}
        </div>
      )}

      {canEdit && (
        <div className="crud-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!dirty || saveMut.isPending || (!multiSite && selected.length === 0)}
            onClick={() => saveMut.mutate()}
          >
            Enregistrer visibilité
          </button>
          {!multiSite && selected.length === 0 && (
            <p className="text-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
              Sélectionnez au moins une agence, ou cochez « Multi-site ».
            </p>
          )}
          {saveMut.isError && <p className="error">{(saveMut.error as Error).message}</p>}
        </div>
      )}
    </div>
  )
}
