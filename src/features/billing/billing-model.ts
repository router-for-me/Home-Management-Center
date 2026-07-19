import type { BillingFilters, BillingPagination } from '@/lib/api/management/billing-types'
import { createDateRangeInTimeZone } from '@/lib/billing/date-range'

export type BillingTab = 'overview' | 'charges' | 'balanceRecords' | 'modelPrices'

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom'

export function createDefaultBillingFilters(timezone = 'UTC', now = new Date()): BillingFilters {
  const range = createDateRangeInTimeZone(6, timezone, now)

  return {
    ...range,
    timezone,
    user: '',
    provider: '',
    model: '',
  }
}

export function createDatePresetRange(
  preset: Exclude<DateRangePreset, 'custom'>,
  timezone: string,
  now = new Date(),
) {
  const days = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  return createDateRangeInTimeZone(days, timezone, now)
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
