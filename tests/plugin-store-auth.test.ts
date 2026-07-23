import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  canRetainPluginStoreAuthCredentials,
  createPluginStoreAuthFormState,
  hasPluginStoreAuthFormErrors,
  toPluginStoreAuthCreateInput,
  toPluginStoreAuthUpdateInput,
  validatePluginStoreAuthForm,
} from '../src/features/plugins/plugin-store-auth-form'
import {
  isPluginInstallActionDisabled,
  matchesPluginStatusFilter,
} from '../src/features/plugins/plugin-store-model'
import { normalizePluginStoreResponse } from '../src/lib/api/management/plugin-store'
import {
  type PluginStoreAuthRule,
  createPluginStoreAuthRule,
  deletePluginStoreAuthRule,
  fetchPluginStoreAuthRule,
  fetchPluginStoreAuthRules,
  updatePluginStoreAuthRule,
} from '../src/lib/api/management/plugin-store-auth'
import { en } from '../src/lib/i18n/locales/en'
import { ru } from '../src/lib/i18n/locales/ru'
import { zhCN } from '../src/lib/i18n/locales/zh-CN'
import { zhTW } from '../src/lib/i18n/locales/zh-TW'

const defaultAxiosAdapter = axios.defaults.adapter
const session = { baseUrl: 'http://management.test', managementKey: 'test-key' }

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

function ruleResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'Private artifacts',
    match: 'https://downloads.example/private/',
    apply_to: ['metadata', 'artifact'],
    auth_type: 'bearer',
    enabled: true,
    version: 3,
    credentials_configured: true,
    ...overrides,
  }
}

function configuredRule(overrides: Partial<PluginStoreAuthRule> = {}): PluginStoreAuthRule {
  return {
    id: 7,
    name: 'Private artifacts',
    match: 'https://downloads.example/private/',
    applyTo: ['metadata', 'artifact'],
    authType: 'bearer',
    headerName: '',
    enabled: true,
    version: 3,
    credentialsConfigured: true,
    ...overrides,
  }
}

function requestBody(config: InternalAxiosRequestConfig) {
  return typeof config.data === 'string'
    ? (JSON.parse(config.data) as Record<string, unknown>)
    : (config.data as Record<string, unknown>)
}

describe('plugin store authentication contract', () => {
  test('normalizes list and entry responses while keeping secrets write-only', async () => {
    const adapter: AxiosAdapter = async (config) => ({
      data: config.url === '/plugin-store-auth' ? { items: [ruleResponse()] } : ruleResponse(),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
    axios.defaults.adapter = adapter

    await expect(fetchPluginStoreAuthRules(session)).resolves.toEqual({
      items: [configuredRule()],
    })
    await expect(fetchPluginStoreAuthRule(session, 7)).resolves.toEqual(configuredRule())
  })

  test('rejects malformed authentication responses', async () => {
    const responses = [
      { items: [ruleResponse({ credentials_configured: undefined })] },
      { items: [ruleResponse({ apply_to: ['registry', 'unknown'] })] },
      { items: [ruleResponse({ id: 0 })] },
    ]

    for (const data of responses) {
      const adapter: AxiosAdapter = async (config) => ({
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
      axios.defaults.adapter = adapter
      await expect(fetchPluginStoreAuthRules(session)).rejects.toThrow(
        'invalid plugin store auth response',
      )
    }
  })

  test('sends real create secrets and never legacy environment-variable fields', async () => {
    let captured: InternalAxiosRequestConfig | null = null
    const adapter: AxiosAdapter = async (config) => {
      captured = config
      return {
        data: ruleResponse(),
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      }
    }
    axios.defaults.adapter = adapter

    await createPluginStoreAuthRule(session, {
      name: 'Private artifacts',
      match: 'https://downloads.example/private/',
      applyTo: ['artifact'],
      authType: 'bearer',
      token: 'actual-secret-token',
      enabled: true,
    })

    expect(captured?.method).toBe('post')
    expect(captured?.url).toBe('/plugin-store-auth')
    const body = requestBody(captured!)
    expect(body.token).toBe('actual-secret-token')
    expect(body).not.toHaveProperty('token-env')
    expect(body).not.toHaveProperty('token_env')
    expect(body).not.toHaveProperty('allow-insecure')
  })

  test('omits blank secrets during edits so Home retains configured credentials', async () => {
    const currentRule = configuredRule()
    const state = createPluginStoreAuthFormState(currentRule)
    state.name = 'Renamed artifacts'

    expect(
      hasPluginStoreAuthFormErrors(validatePluginStoreAuthForm(state, currentRule)),
    ).toBeFalse()
    expect(canRetainPluginStoreAuthCredentials(state, currentRule)).toBeTrue()
    const input = toPluginStoreAuthUpdateInput(state)
    expect(input.token).toBeUndefined()

    let captured: InternalAxiosRequestConfig | null = null
    const adapter: AxiosAdapter = async (config) => {
      captured = config
      return {
        data: ruleResponse({ name: state.name }),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    axios.defaults.adapter = adapter

    await updatePluginStoreAuthRule(session, currentRule.id, input)
    const body = requestBody(captured!)
    expect(body.name).toBe('Renamed artifacts')
    expect(body).not.toHaveProperty('token')
  })

  test('requires replacement credentials when the authentication type changes', () => {
    const currentRule = configuredRule()
    const state = createPluginStoreAuthFormState(currentRule)
    state.authType = 'basic'

    expect(canRetainPluginStoreAuthCredentials(state, currentRule)).toBeFalse()
    expect(validatePluginStoreAuthForm(state, currentRule)).toMatchObject({
      username: 'credentialsRequired',
      password: 'credentialsRequired',
    })

    state.username = 'operator'
    state.password = 'new-password'
    expect(
      hasPluginStoreAuthFormErrors(validatePluginStoreAuthForm(state, currentRule)),
    ).toBeFalse()
    expect(toPluginStoreAuthUpdateInput(state)).toMatchObject({
      authType: 'basic',
      username: 'operator',
      password: 'new-password',
    })
  })

  test('builds Basic and custom-header credential payloads', () => {
    const basic = createPluginStoreAuthFormState(null)
    basic.name = 'Private metadata'
    basic.match = 'https://metadata.example/'
    basic.authType = 'basic'
    basic.username = 'release-bot'
    basic.password = 'basic-secret'
    expect(toPluginStoreAuthCreateInput(basic)).toMatchObject({
      authType: 'basic',
      username: 'release-bot',
      password: 'basic-secret',
    })

    const header = createPluginStoreAuthFormState(null)
    header.name = 'Private registry'
    header.match = 'https://registry.example/'
    header.authType = 'header'
    header.headerName = 'Bad Header'
    header.headerValue = 'header-secret'
    expect(validatePluginStoreAuthForm(header, null).headerName).toBe('invalidHeaderName')

    header.headerName = 'X-Plugin-Token'
    expect(hasPluginStoreAuthFormErrors(validatePluginStoreAuthForm(header, null))).toBeFalse()
    expect(toPluginStoreAuthCreateInput(header)).toMatchObject({
      authType: 'header',
      headerName: 'X-Plugin-Token',
      headerValue: 'header-secret',
    })
  })

  test('accepts only absolute HTTPS match prefixes without URL credentials or suffix data', () => {
    const state = createPluginStoreAuthFormState(null)
    state.name = 'Private registry'
    state.token = 'secret'

    const matchError = (match: string) => {
      state.match = match
      return validatePluginStoreAuthForm(state, null).match
    }

    expect(matchError('https://registry.example/private/')).toBeUndefined()
    expect(matchError('http://registry.example/private/')).toBe('httpsRequired')
    expect(matchError('registry.example/private/')).toBe('httpsRequired')
    expect(matchError('https://user:pass@registry.example/private/')).toBe('httpsRequired')
    expect(matchError('https://registry.example/private/?channel=stable')).toBe('httpsRequired')
    expect(matchError('https://registry.example/private/#release')).toBe('httpsRequired')
    expect(matchError('https://registry.example/private/?')).toBe('httpsRequired')
    expect(matchError('https://registry.example/private/#')).toBe('httpsRequired')
  })

  test('treats auth_required as a hint without requiring auth_configured or blocking install', () => {
    const store = normalizePluginStoreResponse({
      plugins_enabled: true,
      plugins_dir: 'plugins',
      sources: [],
      source_errors: [],
      plugins: [
        {
          id: 'private-provider',
          name: 'Private provider',
          auth_required: true,
          installed: false,
          update_available: false,
        },
      ],
    })
    const plugin = store.plugins[0]!

    expect(plugin.authRequired).toBeTrue()
    expect(matchesPluginStatusFilter(plugin, 'authRequired')).toBeTrue()
    expect(isPluginInstallActionDisabled(null)).toBeFalse()
    expect(isPluginInstallActionDisabled('private-provider')).toBeTrue()
  })

  test('uses the current CRUD routes for update and delete', async () => {
    const requests: Array<{ method: string | undefined; url: string | undefined }> = []
    const adapter: AxiosAdapter = async (config) => {
      requests.push({ method: config.method, url: config.url })
      return {
        data: config.method === 'delete' ? { status: 'ok' } : ruleResponse(),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    axios.defaults.adapter = adapter

    await updatePluginStoreAuthRule(session, 7, { enabled: false })
    await deletePluginStoreAuthRule(session, 7)
    expect(requests).toEqual([
      { method: 'patch', url: '/plugin-store-auth/7' },
      { method: 'delete', url: '/plugin-store-auth/7' },
    ])
  })

  test('keeps plugin authentication locale keys aligned across all supported languages', () => {
    const leafKeys = (value: unknown, prefix = ''): string[] => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]
      return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        leafKeys(child, prefix ? `${prefix}.${key}` : key),
      )
    }

    const expected = leafKeys(en.common.pluginPage.auth).sort()
    expect(leafKeys(zhCN.common.pluginPage.auth).sort()).toEqual(expected)
    expect(leafKeys(zhTW.common.pluginPage.auth).sort()).toEqual(expected)
    expect(leafKeys(ru.common.pluginPage.auth).sort()).toEqual(expected)
  })
})
