import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  applyConfigChange,
  fetchConfigSnapshot,
  normalizeConfigValues,
} from '../src/lib/api/management/config'
import { en } from '../src/lib/i18n/locales/en'
import { ru } from '../src/lib/i18n/locales/ru'
import { zhCN } from '../src/lib/i18n/locales/zh-CN'
import { zhTW } from '../src/lib/i18n/locales/zh-TW'

type CapturedRequest = {
  method: string
  pathname: string
  body: unknown
}

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

function readRequestBody(data: AxiosRequestConfig['data']) {
  if (typeof data !== 'string') return data ?? null

  try {
    return JSON.parse(data) as unknown
  } catch {
    return data
  }
}

function createManagementAdapter(responseFor: (method: string, pathname: string) => unknown) {
  const requests: CapturedRequest[] = []
  const adapter: AxiosAdapter = async (config) => {
    const method = config.method?.toUpperCase() ?? 'GET'
    const pathname = new URL(config.url ?? '', config.baseURL).pathname
    requests.push({ method, pathname, body: readRequestBody(config.data) })

    return {
      data: responseFor(method, pathname),
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
      baseUrl: 'http://127.0.0.1:8317',
      managementKey: 'secret',
    },
  }
}

describe('Antigravity sensitive words configuration', () => {
  test('normalizeConfigValues extracts oauth.providers.antigravity.sensitive-words as JSON array', () => {
    const values = normalizeConfigValues({
      'config-version': 8,
      oauth: {
        providers: {
          antigravity: {
            'sensitive-words': ['API', 'proxy', 'secret'],
          },
        },
      },
    })

    expect(JSON.parse(values.antigravitySensitiveWordsJson as string)).toEqual([
      'API',
      'proxy',
      'secret',
    ])
  })

  test('normalizeConfigValues handles empty or missing antigravity root', () => {
    const values = normalizeConfigValues({})
    expect(JSON.parse(values.antigravitySensitiveWordsJson as string)).toEqual([])
  })

  test('fetchConfigSnapshot reads a single GET /config v8 tree', async () => {
    const { requests, session } = createManagementAdapter((method, pathname) => {
      if (pathname === '/config') {
        return {
          'config-version': 8,
          oauth: {
            providers: {
              antigravity: {
                'sensitive-words': ['API', 'proxy'],
              },
            },
          },
        }
      }
      return {}
    })

    const snapshot = await fetchConfigSnapshot(session)

    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual({ method: 'GET', pathname: '/config', body: null })
    expect(JSON.parse(snapshot.structured.antigravitySensitiveWordsJson as string)).toEqual([
      'API',
      'proxy',
    ])
  })

  test('applyConfigChange sends PUT /config/oauth/providers/antigravity/sensitive-words with a bare array', async () => {
    const { requests, session } = createManagementAdapter(() => ({ status: 'ok' }))

    await applyConfigChange(session, {
      key: 'antigravitySensitiveWordsJson',
      previousValue: '[]',
      nextValue: JSON.stringify(['API', 'proxy']),
    })

    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual({
      method: 'PUT',
      pathname: '/config/oauth/providers/antigravity/sensitive-words',
      body: ['API', 'proxy'],
    })
  })

  test('applyConfigChange writes an empty array when words are cleared', async () => {
    const { requests, session } = createManagementAdapter(() => ({ status: 'ok' }))

    await applyConfigChange(session, {
      key: 'antigravitySensitiveWordsJson',
      previousValue: JSON.stringify(['API']),
      nextValue: '[]',
    })

    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual({
      method: 'PUT',
      pathname: '/config/oauth/providers/antigravity/sensitive-words',
      body: [],
    })
  })

  test('i18n locales define antigravity section and fields across all languages', () => {
    const locales = [
      { name: 'zh-CN', dict: zhCN },
      { name: 'zh-TW', dict: zhTW },
      { name: 'en', dict: en },
      { name: 'ru', dict: ru },
    ]

    for (const { name, dict } of locales) {
      const config = dict.common.configPage
      expect(config.sections.antigravity.title).toBeTruthy()
      expect(config.sections.antigravity.shortTitle).toBeTruthy()
      expect(config.sections.antigravity.description).toBeTruthy()
      expect(config.fields.antigravitySensitiveWordsJson.label).toBeTruthy()
      expect(config.fields.antigravitySensitiveWordsJson.description).toBeTruthy()
      expect(config.fields.antigravitySensitiveWordsJson.placeholder).toBeTruthy()
      expect(config.antigravitySensitiveWords.placeholder).toBeTruthy()
      expect(config.antigravitySensitiveWords.hint).toBeTruthy()
      expect(config.antigravitySensitiveWords.count).toBeTruthy()
    }
  })
})
