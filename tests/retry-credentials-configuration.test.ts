import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { applyConfigChange, normalizeConfigValues } from '../src/lib/api/management/config'
import {
  fetchCredentialSnapshot,
  normalizeCredentialResource,
  updateCredentialMetadata,
} from '../src/lib/api/management/credentials'
import {
  createProviderResource,
  fetchProviderSnapshot,
  updateProviderResource,
} from '../src/lib/api/management/providers'
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
      baseUrl: 'http://management.test',
      managementKey: 'test-management-key',
    },
  }
}

describe('global max-retry-credentials config', () => {
  test('normalizes max-retry-credentials from raw config', () => {
    const config = normalizeConfigValues({
      'max-retry-credentials': 5,
      'request-retry': 2,
      'max-retry-interval': 30,
    })

    expect(config.maxRetryCredentials).toBe(5)
    expect(config.requestRetry).toBe(2)
    expect(config.maxRetryInterval).toBe(30)
  })

  test('handles omitted max-retry-credentials with fallback 0', () => {
    const config = normalizeConfigValues({})
    expect(config.maxRetryCredentials).toBe(0)
  })

  test('applies change via PUT /max-retry-credentials', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await applyConfigChange(session, {
      key: 'maxRetryCredentials',
      previousValue: 0,
      nextValue: 3,
    })

    const request = requests.find(
      (req) => req.method === 'PUT' && req.pathname.endsWith('/max-retry-credentials'),
    )
    expect(request).toBeDefined()
    expect(request?.body).toEqual({ value: 3 })
  })
})

describe('credential request-retry metadata', () => {
  test('normalizes request-retry from credential resource DTO', () => {
    const resourceWithZero = normalizeCredentialResource(
      {
        id: 'cred-01',
        name: 'cred-01.json',
        provider: 'gemini',
        type: 'gemini',
        'request-retry': 0,
      },
      0,
    )
    expect(resourceWithZero.requestRetry).toBe(0)

    const resourceWithPositive = normalizeCredentialResource(
      {
        id: 'cred-02',
        name: 'cred-02.json',
        provider: 'claude',
        type: 'claude',
        'request-retry': 3,
      },
      1,
    )
    expect(resourceWithPositive.requestRetry).toBe(3)

    const resourceWithOmitted = normalizeCredentialResource(
      {
        id: 'cred-03',
        name: 'cred-03.json',
        provider: 'codex',
        type: 'codex',
      },
      2,
    )
    expect(resourceWithOmitted.requestRetry).toBeNull()
  })

  test('reads nested request-retry from metadata object', () => {
    const resource = normalizeCredentialResource(
      {
        id: 'cred-04',
        name: 'cred-04.json',
        provider: 'vertex',
        type: 'vertex',
        metadata: {
          'request-retry': 4,
        },
      },
      3,
    )
    expect(resource.requestRetry).toBe(4)
  })

  test('sends request-retry in credential metadata update', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    const dummyCredential = normalizeCredentialResource(
      {
        id: 'cred-01',
        name: 'cred-01.json',
        provider: 'gemini',
        type: 'gemini',
      },
      0,
    )

    await updateCredentialMetadata(session, dummyCredential, {
      requestRetry: '2',
    })

    const patch = requests.find(
      (req) => req.method === 'PATCH' && req.pathname.endsWith('/auth-files/fields'),
    )
    expect(patch?.body).toMatchObject({
      'request-retry': 2,
    })
  })
})

describe('provider request-retry options', () => {
  test('normalizes request-retry from provider resource snapshot', async () => {
    const { session } = createManagementAdapter((method, pathname) => {
      if (pathname.endsWith('/codex-api-key')) {
        return {
          'codex-api-key': [
            {
              'api-key': 'sk-test-1',
              'base-url': 'https://api.example.com',
              'request-retry': 2,
            },
            {
              'api-key': 'sk-test-2',
              'base-url': 'https://api.example.com',
              'request-retry': 0,
            },
            {
              'api-key': 'sk-test-3',
              'base-url': 'https://api.example.com',
            },
          ],
        }
      }
      return {}
    })

    const snapshot = await fetchProviderSnapshot(session)
    const codexGroup = snapshot.groups.find((g) => g.id === 'codex')
    expect(codexGroup).toBeDefined()
    expect(codexGroup?.resources[0]?.requestRetry).toBe(2)
    expect(codexGroup?.resources[1]?.requestRetry).toBe(0)
    expect(codexGroup?.resources[2]?.requestRetry).toBeNull()
  })

  test('appends request-retry to provider entry payload when saving', async () => {
    const { requests, session } = createManagementAdapter((method, pathname) => {
      if (method === 'GET' && pathname.endsWith('/codex-api-key')) {
        return { 'codex-api-key': [] }
      }
      return {}
    })

    await createProviderResource(session, 'codex', {
      name: 'Test Codex',
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com',
      proxyUrl: '',
      prefix: '',
      disabled: false,
      disableCooling: false,
      websockets: false,
      priority: 0,
      requestRetry: 2,
      models: [],
      headers: [],
      excludedModelsText: '',
    })

    const putRequest = requests.find(
      (req) => req.method === 'PUT' && req.pathname.endsWith('/codex-api-key'),
    )
    expect(putRequest).toBeDefined()
    const payload = (putRequest?.body as unknown[])[0] as Record<string, unknown>
    expect(payload['request-retry']).toBe(2)
  })

  test('handles requestRetry: null when updating provider resource', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    const dummyResource = {
      id: 'codex:0',
      providerId: 'codex' as const,
      index: 0,
      identifier: 'sk-test',
      authIndex: null,
      name: null,
      apiKeyPreview: 'sk***',
      baseUrl: 'https://api.example.com',
      proxyUrl: null,
      prefix: null,
      disabled: false,
      disableCooling: false,
      websockets: false,
      priority: 0,
      requestRetry: 2,
      modelCount: 0,
      headerCount: 0,
      excludedModelCount: 0,
      apiKeyEntryCount: 0,
      selector: { 'api-key': 'sk-test', 'base-url': 'https://api.example.com' },
      raw: {},
    }

    await updateProviderResource(session, dummyResource, {
      name: '',
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com',
      proxyUrl: '',
      prefix: '',
      disabled: false,
      disableCooling: false,
      websockets: false,
      priority: 0,
      requestRetry: null,
      models: [],
      headers: [],
      excludedModelsText: '',
    })

    const patchRequest = requests.find(
      (req) => req.method === 'PATCH' && req.pathname.endsWith('/codex-api-key'),
    )
    expect(patchRequest).toBeDefined()
    const value = (patchRequest?.body as Record<string, unknown>).value as Record<string, unknown>
    expect(value['request-retry']).toBeNull()
  })
})

describe('i18n locale keys for retry settings', () => {
  const locales = [
    { code: 'zh-CN', dict: zhCN },
    { code: 'zh-TW', dict: zhTW },
    { code: 'en', dict: en },
    { code: 'ru', dict: ru },
  ]

  test('all locales define configPage fields for retry configuration', () => {
    for (const { code, dict } of locales) {
      const configFields = dict.common.configPage.fields as Record<
        string,
        { label: string; description: string }
      >
      expect(configFields.maxRetryCredentials?.label).toBeDefined()
      expect(configFields.maxRetryCredentials?.description).toBeDefined()
      expect(configFields.requestRetry?.label).toBeDefined()
      expect(configFields.requestRetry?.description).toBeDefined()
      expect(configFields.maxRetryInterval?.label).toBeDefined()
      expect(configFields.maxRetryInterval?.description).toBeDefined()
    }
  })

  test('all locales define credentialsPage keys for request-retry', () => {
    for (const { code, dict } of locales) {
      const cred = dict.common.credentialsPage
      expect(cred.status.inherited).toBeDefined()
      expect(cred.detail.fields.requestRetry).toBeDefined()
      expect(cred.form.requestRetry).toBeDefined()
      expect(cred.form.requestRetryPlaceholder).toBeDefined()
      expect(cred.form.requestRetryHint).toBeDefined()
      expect(cred.form.requestRetryInvalid).toBeDefined()
    }
  })

  test('all locales define providersPage keys for request-retry', () => {
    for (const { code, dict } of locales) {
      const prov = dict.common.providersPage
      expect(prov.status.inherited).toBeDefined()
      expect(prov.detail.fields.requestRetry).toBeDefined()
      expect(prov.form.requestRetry).toBeDefined()
      expect(prov.form.requestRetryPlaceholder).toBeDefined()
      expect(prov.form.requestRetryHint).toBeDefined()
      expect(prov.form.validation.requestRetryInvalid).toBeDefined()
    }
  })
})
