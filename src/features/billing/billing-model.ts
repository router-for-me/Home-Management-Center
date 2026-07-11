import type { BillingFilters, BillingPagination } from '@/lib/api/management/billing-types'
import { createLocalDateRange } from '@/lib/billing/date-range'

export type BillingTab = 'overview' | 'charges' | 'balanceRecords' | 'modelPrices'

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom'

export function createDefaultBillingFilters(): BillingFilters {
  const range = createLocalDateRange(6)

  return {
    ...range,
    user: '',
    provider: '',
    model: '',
  }
}

export function createDatePresetRange(preset: Exclude<DateRangePreset, 'custom'>) {
  const days = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  return createLocalDateRange(days)
}

export const defaultBillingPagination: BillingPagination = {
  limit: 50,
  offset: 0,
}

export const billingPageSizes = [50, 100, 200] as const

export function getNextOffset(pagination: BillingPagination, total: number) {
  const nextOffset = pagination.offset + pagination.limit
  return nextOffset >= total ? pagination.offset : nextOffset
}

export function getPreviousOffset(pagination: BillingPagination) {
  return Math.max(0, pagination.offset - pagination.limit)
}
