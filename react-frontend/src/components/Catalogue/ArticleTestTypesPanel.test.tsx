import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import * as api from '../../api/client'
import ArticleTestTypesPanel from './ArticleTestTypesPanel'

const article = { id: 2871, test_types: [] } as unknown as api.RefArticleRow
const testType = { id: 8, name: 'Essai terrain', context: 'terrain', form_fields: [{ key: 'mesure', label: 'Mesure', type: 'number', required: true }] } as api.TestType

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api.testTypesApi, 'list').mockResolvedValue([testType])
  vi.spyOn(api.articleActionsApi, 'list').mockResolvedValue([])
})

function showPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter><ArticleTestTypesPanel article={article} canEdit /></MemoryRouter></QueryClientProvider>)
}

describe('liaison essai-produit', () => {
  it('ne confirme pas un enregistrement sans essai ajouté', async () => {
    const sync = vi.spyOn(api.catalogueApi, 'syncArticleTestTypes').mockResolvedValue(article)
    showPanel()
    expect(screen.getByRole('button', { name: 'Enregistrer les essais' })).toBeDisabled()
    expect(screen.queryByText('Essais enregistrés.')).not.toBeInTheDocument()
    expect(sync).not.toHaveBeenCalled()
  })

  it('ajoute et enregistre en un clic, puis confirme la réponse du serveur', async () => {
    const sync = vi.spyOn(api.catalogueApi, 'syncArticleTestTypes').mockResolvedValue({
      ...article, test_types: [{ id: 8, name: 'Essai terrain', article_action_id: null }],
    } as api.RefArticleRow)
    showPanel()
    await screen.findByRole('option', { name: 'Essai terrain · Terrain' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Essai à ajouter' }), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter et enregistrer' }))
    await waitFor(() => expect(sync).toHaveBeenCalledWith(2871, [{ test_type_id: 8, article_action_id: null }]))
    expect(await screen.findByText('Essais enregistrés.')).toBeInTheDocument()
  })

  it('explique pourquoi un essai sans formulaire ne peut pas être ajouté', async () => {
    vi.spyOn(api.testTypesApi, 'list').mockResolvedValue([{ ...testType, form_fields: [] }])
    showPanel()
    await screen.findByRole('option', { name: /formulaire à construire/ })
    fireEvent.change(screen.getByRole('combobox', { name: 'Essai à ajouter' }), { target: { value: '8' } })
    expect(screen.getByRole('button', { name: 'Ajouter et enregistrer' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Modifier cet essai' })).toHaveAttribute('href', '/catalogue/essais?edit=8')
  })
})
