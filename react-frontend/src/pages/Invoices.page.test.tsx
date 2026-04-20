import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as api from '../api/client'
import Invoices from './Invoices'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'lab_admin' } }),
}))

const emptyPaginator = { data: [], current_page: 1, last_page: 1, per_page: 15, total: 0 }

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Invoices', () => {
  it('affiche le titre et la liste vide', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    vi.spyOn(api.moduleSettingsApi, 'get').mockResolvedValue({ module_key: 'invoices', settings: {} })
    vi.spyOn(api.clientsApi, 'list').mockResolvedValue([])
    vi.spyOn(api.invoicesApi, 'list').mockResolvedValue(emptyPaginator as never)
    vi.spyOn(api.ordersApi, 'list').mockResolvedValue({ data: [] } as never)

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/invoices']}>
          <Routes>
            <Route path="/invoices" element={<Invoices />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /factures/i })).toBeInTheDocument()
    })
    expect(await screen.findByText(/aucune facture/i)).toBeInTheDocument()
  })

  it('passe le filtre statut envoyée à list()', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const listSpy = vi.spyOn(api.invoicesApi, 'list').mockResolvedValue(emptyPaginator as never)
    vi.spyOn(api.moduleSettingsApi, 'get').mockResolvedValue({ module_key: 'invoices', settings: {} })
    vi.spyOn(api.clientsApi, 'list').mockResolvedValue([])
    vi.spyOn(api.ordersApi, 'list').mockResolvedValue({ data: [] } as never)

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/invoices']}>
          <Routes>
            <Route path="/invoices" element={<Invoices />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByRole('heading', { name: /factures/i })
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalled()
    })
    listSpy.mockClear()

    const [statusSelect] = screen.getAllByRole('combobox')
    fireEvent.change(statusSelect, { target: { value: 'sent' } })

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
        }),
      )
    })
  })
})
