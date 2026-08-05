import { describe, expect, test } from 'bun:test'

import {
  defaultRequestEventFilters,
  getRequestEventOptionFilters,
} from '@/lib/api/management/request-events'
import {
  defaultUsageFilters,
  getUsageOptionFilters,
  hasActiveUsageDropdownFilter,
} from '@/lib/api/management/usage'

// Regression cover for the request log filters collapsing to the value already
// picked, which forced the operator through "all" before reaching a sibling
// option (issue #124).
describe('request event filter option scope', () => {
  const filters = {
    ...defaultRequestEventFilters,
    range: '7d' as const,
    search: 'timeout',
    requestId: 'req-1',
    eventType: 'chat',
    status: 'failed' as const,
    statusCode: '429',
    provider: 'openai',
    model: 'gpt-5',
    homeIp: '10.0.0.2',
    cpaNode: 'cpa-tokyo',
    credentialId: 'cred-1',
    authIndex: '2',
    user: 'alice',
    clientKey: 'key-1',
    minLatencyMs: '100',
    maxLatencyMs: '900',
    limit: 25,
    offset: 50,
  }

  test('drops every dropdown filter that the option lists feed', () => {
    const optionFilters = getRequestEventOptionFilters(filters)

    expect(optionFilters.eventType).toBe('all')
    expect(optionFilters.status).toBe('all')
    expect(optionFilters.statusCode).toBe('all')
    expect(optionFilters.provider).toBe('all')
    expect(optionFilters.model).toBe('all')
    expect(optionFilters.homeIp).toBe('all')
    expect(optionFilters.cpaNode).toBe('all')
  })

  test('keeps the time range and the typed filters', () => {
    const optionFilters = getRequestEventOptionFilters(filters)

    expect(optionFilters.range).toBe('7d')
    expect(optionFilters.search).toBe('timeout')
    expect(optionFilters.requestId).toBe('req-1')
    expect(optionFilters.credentialId).toBe('cred-1')
    expect(optionFilters.authIndex).toBe('2')
    expect(optionFilters.user).toBe('alice')
    expect(optionFilters.clientKey).toBe('key-1')
    expect(optionFilters.minLatencyMs).toBe('100')
    expect(optionFilters.maxLatencyMs).toBe('900')
  })

  test('reads one unpaged sample regardless of the table pagination', () => {
    const optionFilters = getRequestEventOptionFilters(filters)

    expect(optionFilters.limit).toBe(200)
    expect(optionFilters.offset).toBe(0)
  })

  test('stays identical while the operator switches dropdown values', () => {
    expect(getRequestEventOptionFilters({ ...filters, cpaNode: 'cpa-osaka' })).toEqual(
      getRequestEventOptionFilters(filters),
    )
  })
})

describe('usage filter option scope', () => {
  const filters = {
    ...defaultUsageFilters,
    range: '30d' as const,
    search: 'gemini',
    status: 'failed' as const,
    statusCode: '500',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    credentialType: 'oauth' as const,
    homeIp: '10.0.0.3',
    endpoint: '/v1/messages',
    executorType: 'stream',
    user: 'bob',
    minAmount: '1',
    maxAmount: '20',
    limit: 25,
    offset: 100,
  }

  test('drops every dropdown filter that the option lists feed', () => {
    const optionFilters = getUsageOptionFilters(filters)

    expect(optionFilters.status).toBe('all')
    expect(optionFilters.statusCode).toBe('all')
    expect(optionFilters.provider).toBe('all')
    expect(optionFilters.model).toBe('all')
    expect(optionFilters.credentialType).toBe('all')
    expect(optionFilters.homeIp).toBe('all')
    expect(optionFilters.endpoint).toBe('all')
    expect(optionFilters.executorType).toBe('all')
  })

  test('keeps the time range and the typed filters', () => {
    const optionFilters = getUsageOptionFilters(filters)

    expect(optionFilters.range).toBe('30d')
    expect(optionFilters.search).toBe('gemini')
    expect(optionFilters.user).toBe('bob')
    expect(optionFilters.minAmount).toBe('1')
    expect(optionFilters.maxAmount).toBe('20')
    expect(optionFilters.limit).toBe(200)
    expect(optionFilters.offset).toBe(0)
  })

  test('stays identical while the operator switches dropdown values', () => {
    expect(getUsageOptionFilters({ ...filters, provider: 'openai' })).toEqual(
      getUsageOptionFilters(filters),
    )
  })

  test('only asks for a dedicated option sample once a dropdown narrows the data', () => {
    expect(hasActiveUsageDropdownFilter(defaultUsageFilters)).toBe(false)
    expect(hasActiveUsageDropdownFilter({ ...defaultUsageFilters, search: 'gemini' })).toBe(false)
    expect(hasActiveUsageDropdownFilter({ ...defaultUsageFilters, provider: 'openai' })).toBe(true)
    expect(hasActiveUsageDropdownFilter({ ...defaultUsageFilters, statusCode: '500' })).toBe(true)
  })
})
