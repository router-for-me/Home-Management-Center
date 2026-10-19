import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  mergeIncomingTailRuntimeLogs,
  mergeOlderRuntimeLogs,
} from '../src/features/logs/use-logs-workbench'
import {
  formatDateTime,
  isRuntimeLogScrollNearBottom,
  isRuntimeLogScrollNearTop,
  restoreRuntimeLogPrependScroll,
  scrollRuntimeLogContainerToBottom,
} from '../src/features/observability/observability-components'
import { defaultRuntimeLogFilters, fetchRuntimeLogs } from '../src/lib/api/management/usage-logs'
import { en } from '../src/lib/i18n/locales/en'
import { ru } from '../src/lib/i18n/locales/ru'
import { zhCN } from '../src/lib/i18n/locales/zh-CN'
import { zhTW } from '../src/lib/i18n/locales/zh-TW'

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

type CapturedRequest = {
  url: string
  params: Record<string, unknown>
}

function createLogsAdapter(payload: unknown) {
  const requests: CapturedRequest[] = []
  const adapter: AxiosAdapter = async (config) => {
    const basePath = new URL(config.baseURL ?? '').pathname.replace(/\/$/, '')
    const urlPath = new URL(config.url ?? '', config.baseURL).pathname
    requests.push({
      url: `${basePath}${urlPath}`,
      params: (config.params ?? {}) as Record<string, unknown>,
    })
    return {
      data: payload,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  axios.defaults.adapter = adapter

  return {
    requests,
    session: {
      baseUrl: 'http://management.test',
      managementKey: 'test-management-key',
    },
  }
}

describe('runtime log content search Management API integration', () => {
  test('sends the trimmed search filter and reads back the applied echo', async () => {
    const { requests, session } = createLogsAdapter({
      logs: [],
      total: 0,
      limit: 50,
      offset: 0,
      search: 'timeout',
    })

    const snapshot = await fetchRuntimeLogs(session, {
      ...defaultRuntimeLogFilters,
      search: '  timeout  ',
      limit: 50,
      offset: 0,
    })

    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('/v8/management/observability/logs')
    expect(requests[0].params.search).toBe('timeout')
    expect(snapshot.appliedSearch).toBe('timeout')
  })

  test('omits the search parameter when the filter is blank', async () => {
    const { requests, session } = createLogsAdapter({
      logs: [],
      total: 0,
      limit: 50,
      offset: 0,
    })

    const snapshot = await fetchRuntimeLogs(session, {
      ...defaultRuntimeLogFilters,
      limit: 50,
      offset: 0,
    })

    expect(requests[0].params).not.toHaveProperty('search')
    expect(snapshot.appliedSearch).toBeNull()
  })

  test('leaves appliedSearch null when the backend does not echo the filter', async () => {
    const { session } = createLogsAdapter({
      logs: [],
      total: 0,
      limit: 50,
      offset: 0,
    })

    const snapshot = await fetchRuntimeLogs(session, {
      ...defaultRuntimeLogFilters,
      search: 'timeout',
      limit: 50,
      offset: 0,
    })

    expect(snapshot.appliedSearch).toBeNull()
  })

  test('maintains i18n locale symmetry for the new runtime log keys across all 4 locales', () => {
    const locales = [zhCN.common, zhTW.common, en.common, ru.common]
    const expected = flattenKeys({
      searchFields: en.common.usageLogsPage.logs.filters.searchFields,
      pagination: en.common.usageLogsPage.logs.pagination,
      searchUnsupported: en.common.usageLogsPage.logs.searchUnsupported,
    })

    for (const locale of locales) {
      expect(
        flattenKeys({
          searchFields: locale.usageLogsPage.logs.filters.searchFields,
          pagination: locale.usageLogsPage.logs.pagination,
          searchUnsupported: locale.usageLogsPage.logs.searchUnsupported,
        }),
      ).toEqual(expected)
    }
  })

  test('scrolls the runtime log container to the bottom when records load', () => {
    const container = { scrollTop: 0, scrollHeight: 1280 }

    scrollRuntimeLogContainerToBottom(container)
    expect(container.scrollTop).toBe(1280)

    scrollRuntimeLogContainerToBottom(null)
  })

  test('detects bottom/top scroll proximity and restores scroll anchor on upward history prepend', () => {
    expect(
      isRuntimeLogScrollNearBottom({ scrollTop: 980, scrollHeight: 1400, clientHeight: 400 }),
    ).toBe(true)
    expect(
      isRuntimeLogScrollNearBottom({ scrollTop: 800, scrollHeight: 1400, clientHeight: 400 }),
    ).toBe(false)
    expect(isRuntimeLogScrollNearTop({ scrollTop: 12 })).toBe(true)
    expect(isRuntimeLogScrollNearTop({ scrollTop: 48 })).toBe(false)

    const container = { scrollTop: 10, scrollHeight: 1800 }
    restoreRuntimeLogPrependScroll(container, { scrollTop: 10, scrollHeight: 1200 })
    expect(container.scrollTop).toBe(610)
  })

  test('sends anchor_id, before_id, and after_id cursors and merges tail/older log snapshots cleanly', async () => {
    const { requests, session } = createLogsAdapter({
      logs: [
        { id: 104, timestamp: '2026-05-29T01:02:04Z', line: 'line-104' },
        { id: 103, timestamp: '2026-05-29T01:02:03Z', line: 'line-103' },
      ],
      total: 104,
      limit: 2,
      offset: 2,
      anchor_id: 106,
      before_id: 105,
    })

    const snapshot = await fetchRuntimeLogs(session, {
      ...defaultRuntimeLogFilters,
      limit: 2,
      offset: 2,
      anchorId: 106,
      beforeId: 105,
    })

    expect(requests[0].params).toMatchObject({
      limit: 2,
      offset: 2,
      anchor_id: 106,
      before_id: 105,
    })
    expect(snapshot.anchorId).toBe(106)
    expect(snapshot.beforeId).toBe(105)

    const incoming = {
      ...snapshot,
      records: [
        { ...snapshot.records[0]!, id: '106', line: 'line-106' },
        { ...snapshot.records[0]!, id: '105', line: 'line-105' },
      ],
    }
    const tailMerged = mergeIncomingTailRuntimeLogs(snapshot, incoming, 3)
    expect(tailMerged.records.map((r) => r.id)).toEqual(['106', '105', '104'])

    const older = {
      ...snapshot,
      records: [
        { ...snapshot.records[0]!, id: '102', line: 'line-102' },
        { ...snapshot.records[0]!, id: '101', line: 'line-101' },
      ],
    }
    const olderMerged = mergeOlderRuntimeLogs(snapshot, older, 10)
    expect(olderMerged.records.map((r) => r.id)).toEqual(['104', '103', '102', '101'])
  })

  test('formats runtime log timestamps completely across double-digit dates and all locales', () => {
    const timestamp = '2026-10-15T00:12:08Z'

    for (const language of ['zh-CN', 'zh-TW', 'en', 'ru']) {
      const formatted = formatDateTime(timestamp, {
        language,
        resolvedLanguage: language,
      } as Parameters<typeof formatDateTime>[1])

      expect(formatted).toBeTruthy()
      expect(formatted).toContain('2026')
      expect(formatted).toContain('12')
    }
  })
})

function flattenKeys(value: unknown, prefix = '', output: string[] = []) {
  if (value === null || typeof value !== 'object') {
    output.push(prefix)
    return output
  }
  for (const [key, nested] of Object.entries(value)) {
    flattenKeys(nested, prefix ? `${prefix}.${key}` : key, output)
  }
  return output.sort()
}
