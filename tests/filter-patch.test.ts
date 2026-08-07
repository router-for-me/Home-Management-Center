import { describe, expect, test } from 'bun:test'

import { defaultRequestEventFilters } from '@/lib/api/management/request-events'
import { defaultRuntimeLogFilters, defaultUsageFilters } from '@/lib/api/management/usage-logs'
import { applyFilterPatch } from '@/lib/filter-patch'

// Switching the search field rewrote every search key to the empty string it
// already held, and the fresh object put a new query key in front of TanStack
// Query and re-reconciled the whole table for a change that was not one. The
// contract here is identity: a patch that changes nothing hands the current
// object back so React bails out of the render.
describe('applyFilterPatch', () => {
  test('keeps the current object when the patch repeats the values in effect', () => {
    const searchFieldSwitch = {
      search: '',
      requestId: '',
      user: '',
      clientKey: '',
      credentialId: '',
      authIndex: '',
      offset: 0,
    }

    expect(applyFilterPatch(defaultRequestEventFilters, searchFieldSwitch)).toBe(
      defaultRequestEventFilters,
    )
  })

  test('keeps the current object for an empty patch', () => {
    expect(applyFilterPatch(defaultRequestEventFilters, {})).toBe(defaultRequestEventFilters)
  })

  test('keeps the current object when clearing filters that are already cleared', () => {
    expect(applyFilterPatch(defaultRuntimeLogFilters, defaultRuntimeLogFilters)).toBe(
      defaultRuntimeLogFilters,
    )
  })

  test('returns a new object as soon as one key differs', () => {
    const filters = { ...defaultRequestEventFilters, requestId: 'req-1' }
    const next = applyFilterPatch(filters, { requestId: 'req-2', offset: 0 })

    expect(next).not.toBe(filters)
    expect(next.requestId).toBe('req-2')
  })

  test('carries a search value from one field to another in a single change', () => {
    const filters = { ...defaultRequestEventFilters, requestId: 'req-1' }
    const next = applyFilterPatch(filters, { requestId: '', user: 'req-1', offset: 0 })

    expect(next).not.toBe(filters)
    expect(next.requestId).toBe('')
    expect(next.user).toBe('req-1')
  })

  test('leaves untouched keys alone', () => {
    const filters = { ...defaultUsageFilters, search: 'timeout', provider: 'openai' }
    const next = applyFilterPatch(filters, { search: 'overloaded' })

    expect(next.provider).toBe('openai')
    expect(next.limit).toBe(filters.limit)
  })
})
