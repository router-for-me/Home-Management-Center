import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

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
