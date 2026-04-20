import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as api from '../../api/client'
import ClientCommercialContent from './ClientCommercialContent'
import type { ClientCommercialOverview } from '../../api/client'

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'lab_admin' } }),
}))

const overview: ClientCommercialOverview = {
  client: { id: 1, name: 'Client test', email: 'a@b.c' },
  quotes: [],
  invoices: [],
  stats: {
    quotes_by_status: {},
    invoices_by_status: {},
    amount_due_ttc: 1234.5,
    total_invoiced_ttc: 5000,
    total_quotes_ttc: 2000,
    open_quotes_count: 0,
  },
  document_links: [],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ClientCommercialContent', () => {
  it('affiche le KPI montant dû (TTC) depuis stats', async () => {
    vi.spyOn(api.clientsApi, 'commercialOverview').mockResolvedValue(overview)

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ClientCommercialContent clientId={1} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /synthèse/i })).toBeInTheDocument()
    })
    const kpi = document.querySelector('.client-synthese-kpi')
    expect(kpi).toBeTruthy()
    expect(within(kpi as HTMLElement).getAllByText(/montant dû/i).length).toBeGreaterThan(0)
    expect(within(kpi as HTMLElement).getByText('1.234,50 DH')).toBeInTheDocument()
  })
})
