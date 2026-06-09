import type { BillingFilters, BillingPagination } from '@/lib/api/management/billing-types'

export type BillingTab = 'overview' | 'charges' | 'balanceRecords' | 'modelPrices' | 'proxyPools'

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom'

const dayInMs = 24 * 60 * 60 * 1000

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function createDefaultBillingFilters(): BillingFilters {
  const now = new Date()
  const from = new Date(now.getTime() - 6 * dayInMs)

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(now),
    user: '',
    provider: '',
    model: '',
  }
}

export function createDatePresetRange(preset: Exclude<DateRangePreset, 'custom'>) {
  const now = new Date()
  const days = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  const from = new Date(now.getTime() - days * dayInMs)

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(now),
  }
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
