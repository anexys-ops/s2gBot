import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as api from '../api/client'
import OrderDetail from './OrderDetail'
import type { Order } from '../api/client'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'lab_admin' } }),
}))

const order: Order = {
  id: 1,
  reference: 'CMD-TEST',
  client_id: 1,
  status: 'draft',
  order_date: '2024-06-01',
  order_items: [
    {
      id: 10,
      order_id: 1,
      test_type_id: 1,
      quantity: 1,
      test_type: {
        id: 1,
        name: 'Granulo',
        unit_price: 100,
        params: [{ id: 99, name: 'Fines', expected_type: 'number' }],
      },
      samples: [
        {
          id: 5,
          order_item_id: 10,
          reference: 'E-001',
          status: 'tested',
          test_results: [],
          order_item: {
            id: 10,
            order_id: 1,
            test_type_id: 1,
            quantity: 1,
            test_type: {
              id: 1,
              name: 'Granulo',
              unit_price: 100,
              params: [{ id: 99, name: 'Fines', expected_type: 'number' }],
            },
          },
        },
      ],
    },
  ],
  reports: [],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('OrderDetail', () => {
  it('affiche la référence commande et la ligne échantillon', async () => {
    vi.spyOn(api.ordersApi, 'get').mockResolvedValue(order)
    vi.spyOn(api.reportPdfTemplatesApi, 'list').mockResolvedValue({ data: [] })
    vi.spyOn(api.reportFormDefinitionsApi, 'list').mockResolvedValue({ data: [] })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/orders/1']}>
          <Routes>
            <Route path="/orders/:id" element={<OrderDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /commande cmd-test/i })).toBeInTheDocument()
    })
    expect(screen.getByText('E-001')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /échantillon/i })).toBeInTheDocument()
  })

  it('ouvre la saisie des résultats depuis le bouton Résultats', async () => {
    vi.spyOn(api.ordersApi, 'get').mockResolvedValue(order)
    vi.spyOn(api.reportPdfTemplatesApi, 'list').mockResolvedValue({ data: [] })
    vi.spyOn(api.reportFormDefinitionsApi, 'list').mockResolvedValue({ data: [] })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/orders/1']}>
          <Routes>
            <Route path="/orders/:id" element={<OrderDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByRole('heading', { name: /commande cmd-test/i })
    fireEvent.click(screen.getByRole('button', { name: /^résultats$/i }))
    expect(await screen.findByRole('heading', { name: /saisie des résultats/i })).toBeInTheDocument()
    expect(screen.getByText(/^fines$/i)).toBeInTheDocument()
  })
})
