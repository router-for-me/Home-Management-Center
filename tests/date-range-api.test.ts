import axios from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  defaultRequestEventFilters,
  fetchRequestEvents,
  isRequestEventDateRangeValid,
} from '@/lib/api/management/request-events'
import {
  defaultUsageFilters,
  fetchUsageOverview,
  fetchUsageRecords,
  isUsageDateRangeValid,
} from '@/lib/api/management/usage-logs'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const originalAdapter = axios.defaults.adapter
afterEach(() => {
  axios.defaults.adapter = originalAdapter
})
const session = { baseUrl: 'http://date-range.test', managementKey: 'fixture-only' }
function captureRequests() {
  const requests: { path: string; params: Record<string, unknown> }[] = []
  axios.defaults.adapter = async (config) => {
    requests.push({ path: config.url || '', params: config.params })
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  return requests
}

describe('time range API boundaries', () => {
  test('keeps complete calendar days and timezone for usage overview and records', async () => {
    const requests = captureRequests()
    for (const day of ['2026-03-08', '2026-11-01', '9999-12-31']) {
      const filters = {
        ...defaultUsageFilters,
        range: 'custom' as const,
        customFrom: day,
        customTo: day,
      }
      await fetchUsageOverview(session, filters)
      await fetchUsageRecords(session, filters)
      for (const request of requests.slice(-2)) {
        expect(request.params.from).toBe(day)
        expect(request.params.to).toBe(day)
        expect(request.params.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
      }
    }
  })

  test('preserves exact event timestamps and legacy inclusive calendar dates', async () => {
    const requests = captureRequests()
    await fetchRequestEvents(session, {
      ...defaultRequestEventFilters,
      range: 'custom',
      customFrom: '2026-10-15T09:00',
      customTo: '2026-10-15T18:00',
    })
    expect(requests[0].params.from).toBe(new Date('2026-10-15T09:00').toISOString())
    expect(requests[0].params.to).toBe(new Date('2026-10-15T18:00').toISOString())
    await fetchRequestEvents(session, {
      ...defaultRequestEventFilters,
      range: 'custom',
      customFrom: '2026-11-01',
      customTo: '2026-11-01',
    })
    expect(requests[1].params.from).toBe('2026-11-01')
    expect(requests[1].params.to).toBe('2026-11-01')
    expect(requests[1].params.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  test('omits both boundaries after clearing, leaving backend defaults intact', async () => {
    const requests = captureRequests()
    await fetchUsageOverview(session, {
      ...defaultUsageFilters,
      range: 'custom',
      customFrom: '',
      customTo: '',
    })
    await fetchRequestEvents(session, {
      ...defaultRequestEventFilters,
      range: 'custom',
      customFrom: '',
      customTo: '',
    })
    for (const request of requests) {
      expect(request.params.from).toBeUndefined()
      expect(request.params.to).toBeUndefined()
    }
  })

  test('rejects invalid or reversed calendar dates before querying', () => {
    for (const validate of [isUsageDateRangeValid, isRequestEventDateRangeValid]) {
      expect(validate({ range: 'custom', customFrom: '2026-02-30', customTo: '' })).toBe(false)
      expect(validate({ range: 'custom', customFrom: '2026-10-16', customTo: '2026-10-15' })).toBe(
        false,
      )
      expect(validate({ range: 'custom', customFrom: '2026-10-15', customTo: '2026-10-15' })).toBe(
        true,
      )
    }
  })
})

test('date picker copy has matching keys and no empty translations in all four locales', () => {
  const expected = Object.keys(en.common.dateRangePicker).sort()
  for (const locale of [en, zhCN, zhTW, ru]) {
    expect(Object.keys(locale.common.dateRangePicker).sort()).toEqual(expected)
    expect(Object.values(locale.common.dateRangePicker).every((value) => value.trim())).toBe(true)
  }
})
