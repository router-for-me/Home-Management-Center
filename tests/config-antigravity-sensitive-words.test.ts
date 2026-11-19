import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { sectionDefinitions } from '../src/features/config/config-workbench-page'
import { isValidAntigravityPauseWindow } from '../src/lib/api/management/antigravity-pause-window'
import {
  applyConfigChange,
  fetchConfigSnapshot,
  isReadOnlyConfigField,
  normalizeConfigValues,
} from '../src/lib/api/management/config'
import {
  parseReplacementDraft,
  replacementIssues,
} from '../src/lib/api/management/sensitive-replacements'
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

describe('Antigravity TOS pause window', () => {
  test('accepts Home disable values and positive Go durations', () => {
    for (const value of [
      '',
      '  ',
      '0',
      ' OFF ',
      'false',
      'None',
      'DISABLED',
      '30m',
      '1h30m',
      '+.5h',
      '1.s',
      '1ns',
      '1us',
      '1µs',
      '1μs',
      '0.000001ms',
      '2562047h47m16.854775807s',
    ]) {
      expect(isValidAntigravityPauseWindow(value)).toBe(true)
    }
  })

  test('rejects malformed, nonpositive, sub-nanosecond and overflowing durations', () => {
    for (const value of [
      '6',
      '-1h',
      '+0',
      '0s',
      '0.5ns0.5ns',
      '1d',
      '1 h',
      '1e3s',
      '1m30',
      '.s',
      '1s!',
      'off1s',
      '9223372036854775808ns',
      '2562047h47m16.854775808s',
    ]) {
      expect(isValidAntigravityPauseWindow(value)).toBe(false)
    }
  })
})

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

  test('OAuth replacements write only their own V8 fields and preserve literal text, regex order and empty replacements', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))
    const words = { ['__proto__']: '$1', ' multi\nline ': '', Case: ' one ', case: 'two' }
    const patterns = [
      { pattern: '(?i)(alpha)', replacement: '$1' },
      { pattern: '(?s)line.*', replacement: '' },
      { pattern: '^drop-implicit$' },
      { replacement: 'skipped until a pattern is configured' },
    ]
    const source = { 'sensitive-words-replace': words, 'sensitive-patterns-replace': patterns }
    const value = normalizeConfigValues({
      oauth: { providers: { antigravity: source, devin: source } },
    })
    const empty = normalizeConfigValues({})
    for (const provider of ['antigravity', 'devin'] as const) {
      const literal = `${provider}LiteralReplacements` as const
      const regex = `${provider}PatternReplacements` as const
      const rows = parseReplacementDraft(value[literal])!
      expect(rows).toEqual(
        Object.entries(words).map(([pattern, replacement]) => ({ pattern, replacement })),
      )
      expect(parseReplacementDraft(value[regex])).toEqual(patterns)
      await applyConfigChange(session, {
        key: literal,
        previousValue: empty[literal],
        nextValue: value[literal],
      })
      await applyConfigChange(session, {
        key: regex,
        previousValue: value[regex],
        nextValue: JSON.stringify([...patterns].reverse()),
      })
      await applyConfigChange(session, {
        key: literal,
        previousValue: value[literal],
        nextValue: empty[literal],
      })
      await applyConfigChange(session, {
        key: regex,
        previousValue: value[regex],
        nextValue: empty[regex],
      })
      const path = `/config/oauth/providers/${provider}/sensitive-`
      expect(requests.splice(0)).toEqual([
        { method: 'PUT', pathname: path + 'words-replace', body: words },
        { method: 'PUT', pathname: path + 'patterns-replace', body: [...patterns].reverse() },
        { method: 'PUT', pathname: path + 'words-replace', body: {} },
        { method: 'PUT', pathname: path + 'patterns-replace', body: [] },
      ])
      const duplicate = [rows[0]!, { ...rows[0]!, replacement: 'second' }]
      expect(replacementIssues('literalReplacements', duplicate)).toEqual([
        'duplicate',
        'duplicate',
      ])
      for (const draft of [duplicate, [{ pattern: '', replacement: 'unfinished' }], null]) {
        await expect(
          applyConfigChange(session, {
            key: literal,
            previousValue: value[literal],
            nextValue: JSON.stringify(draft),
          }),
        ).rejects.toThrow()
      }
      expect(requests).toEqual([])
    }
  })

  test('unknown replacement formats stay read-only and each provider keeps its own fields', () => {
    const values = normalizeConfigValues({
      oauth: {
        providers: {
          devin: {
            'sensitive-patterns-replace': [{ pattern: 'x', replacement: '', future: true }],
            'sensitive-words-replace': { a: false },
          },
          antigravity: { 'sensitive-words-replace': { a: '' } },
        },
      },
    })
    expect(parseReplacementDraft(values.devinPatternReplacements)).toBeNull()
    expect(parseReplacementDraft(values.devinLiteralReplacements)).toBeNull()
    expect(parseReplacementDraft(values.antigravityLiteralReplacements)).toEqual([
      { pattern: 'a', replacement: '' },
    ])
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

  test('groups oauth.providers.codex and oauth.providers.antigravity under oauthProviders (#192)', () => {
    const sectionIds = sectionDefinitions.map((section) => section.id)
    expect(sectionIds).toContain('oauthProviders')
    expect(sectionIds).not.toContain('liveMediaRelay')
    expect(sectionIds).not.toContain('antigravity')
    expect(sectionIds).not.toContain('quota')

    const oauthProvidersSection = sectionDefinitions.find(
      (section) => section.id === 'oauthProviders',
    )
    expect(oauthProvidersSection).toBeDefined()

    const devinFields = oauthProvidersSection?.fields.filter((field) => field.groupId === 'devin')
    const liveMediaRelayFields = oauthProvidersSection?.fields.filter(
      (field) => field.groupId === 'liveMediaRelay',
    )
    const antigravityFields = oauthProvidersSection?.fields.filter(
      (field) => field.groupId === 'antigravity',
    )
    expect(devinFields?.map((field) => field.key)).toEqual([
      'devinSensitiveWordsJson',
      'devinLiteralReplacements',
      'devinPatternReplacements',
    ])
    expect(liveMediaRelayFields?.map((field) => field.key)).toEqual([
      'liveMediaRelayEnabled',
      'liveMediaRelayMaxSessions',
      'liveMediaRelayDisablePrivateRemoteIps',
      'liveMediaRelayPublicIp',
      'liveMediaRelayUdpPortMin',
      'liveMediaRelayUdpPortMax',
      'liveMediaRelayIceServersJson',
    ])
    expect(antigravityFields?.map((field) => field.key)).toEqual([
      'antigravityTosPauseWindow',
      'antigravitySensitiveWordsJson',
      'antigravityLiteralReplacements',
      'antigravityPatternReplacements',
      'antigravityCredits',
      'antigravitySignatureCacheEnabled',
      'antigravitySignatureBypassStrict',
      'antigravityConnPoolEnabled',
      'antigravityConnPoolIdleTimeout',
      'antigravityConnPoolMaxIdleConnsPerHost',
    ])
  })

  test('omits CPA settings that are invalid in Home mode (#194)', () => {
    const removedFieldKeys = [
      'remoteManagementDisableAutoUpdatePanel',
      'remoteManagementPanelGithubRepository',
      'saveCooldownStatus',
      'transientErrorCooldownSeconds',
      'oauthAuthAutoRefreshWorkers',
      'aistudioWsAuth',
      'quotaSwitchProject',
      'quotaSwitchPreviewModel',
    ]
    const allDefinedKeys = sectionDefinitions.flatMap((section) =>
      section.fields.map((field) => field.key),
    )
    const normalizedValues = normalizeConfigValues({}) as Record<string, unknown>

    for (const key of removedFieldKeys) {
      expect(allDefinedKeys).not.toContain(key)
      expect(normalizedValues).not.toHaveProperty(key)
    }
  })

  test('shows the reported usage flag as a read-only observability setting (#194)', () => {
    const fields = sectionDefinitions.find((section) => section.id === 'system')?.fields ?? []
    expect(fields.some((field) => field.key === 'usageStatisticsEnabled')).toBe(true)
    expect(isReadOnlyConfigField('usageStatisticsEnabled')).toBe(true)
    for (const key of ['debug', 'requestLog', 'loggingToFile'] as const) {
      expect(isReadOnlyConfigField(key)).toBe(false)
    }
  })

  test('uses sticky session wording in Chinese locales and preserves configPage locale symmetry (#191)', () => {
    expect(zhCN.common.configPage.fields.sessionAffinity.label).toBe('粘性会话')
    expect(zhCN.common.configPage.fields.sessionAffinityTtl.label).toBe('粘性会话有效期')
    expect(zhCN.common.configPage.fields.sessionAffinitySubagents.label).toBe('子代理粘性会话')
    expect(zhCN.common.configPage.sections.streaming.description).toContain('粘性会话')

    expect(zhTW.common.configPage.fields.sessionAffinity.label).toBe('粘性會話')
    expect(zhTW.common.configPage.fields.sessionAffinityTtl.label).toBe('粘性會話有效期')
    expect(zhTW.common.configPage.fields.sessionAffinitySubagents.label).toBe('子代理粘性會話')

    const expectedKeys = flattenKeys(en.common.configPage)
    for (const locale of [zhCN.common.configPage, zhTW.common.configPage, ru.common.configPage]) {
      expect(flattenKeys(locale)).toEqual(expectedKeys)
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
