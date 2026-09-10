import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fxRatesApi } from '../api/client'
import { CORE_CURRENCIES, setRuntimeCurrencyCatalog, type CurrencyRow } from '../lib/currencies'

export function useCurrencyCatalog(): {
  currencies: CurrencyRow[]
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => fxRatesApi.catalog(),
    staleTime: 5 * 60 * 1000,
  })

  const currencies = data?.currencies?.length ? data.currencies : [...CORE_CURRENCIES]

  useEffect(() => {
    setRuntimeCurrencyCatalog(currencies)
  }, [currencies])

  return {
    currencies,
    isLoading,
    error: error as Error | null,
  }
}
