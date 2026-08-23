import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { fetchManagementDashboardSnapshot } from '../src/lib/api/management/dashboard'
import {
  type ProviderEntryFormInput,
  createProviderResource,
  fetchProviderDiscoveredModels,
  fetchProviderSnapshot,
  getProviderModelDefinitionChannels,
  updateProviderResource,
  updateProviderStatus,
} from '../src/lib/api/management/providers'
import type { CapabilityMap } from '../src/lib/api/management/types'
import { en } from '../src/lib/i18n/locales/en'
import { ru } from '../src/lib/i18n/locales/ru'
import { zhCN } from '../src/lib/i18n/locales/zh-CN'
import { zhTW } from '../src/lib/i18n/locales/zh-TW'

type CapturedRequest = {
  method: string
  pathname: string
  body: unknown
  headers?: Record<string, string>
}

const defaultAxiosAdapter = axios.defaults.adapter
const noCapabilities: CapabilityMap = {
  nodes: false,
  topology: false,
  usage: false,
  usageQueue: false,
  usageOverview: false,
  usageRecords: false,
  usageRecordDetails: false,
  usageAggregates: false,
  usageExport: false,
  usageProviderHealth: false,
  usageCredentialHealth: false,
  usageRealtime: false,
  usageTokenBreakdownV2: false,
  requestEvents: false,
  requestEventDetails: false,
  requestEventExport: false,
  requestEventFilters: false,
  requestLogIndex: false,
  oauthUsage: false,
  quotaSnapshots: false,
  quotaSnapshotDetails: false,
  quotaRecollect: false,
  logs: false,
  requestErrorLogs: false,
  users: false,
  accessGroups: false,
  credentialInFlight: false,
  credentialInFlightSnapshotCursor: false,
  credentialConcurrencyLimits: false,
}

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
    requests.push({
      method,
      pathname,
      body: readRequestBody(config.data),
      headers: config.headers as Record<string, string> | undefined,
    })

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

function createInteractionsForm(
  overrides: Partial<ProviderEntryFormInput> = {},
): ProviderEntryFormInput {
  return {
    apiKey: 'AIzaSyTestInteractionsKey',
    name: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    proxyUrl: 'socks5://127.0.0.1:1080',
    prefix: 'team-interactions',
    disabled: false,
    disableCooling: true,
    websockets: false,
    priority: 5,
    requestRetry: 2,
    models: [
      {
        name: 'gemini-2.5-pro',
        alias: 'gemini-pro',
        displayName: 'Gemini Pro',
        forceMapping: true,
      },
    ],
    headers: [{ key: 'X-Custom-Header', value: 'custom-val' }],
    excludedModelsText: 'gemini-1.0-*',
    ...overrides,
  }
}

function providerResponseKey(pathname: string) {
  return pathname.slice(pathname.lastIndexOf('/') + 1)
}

describe('Google Interactions provider Management API integration', () => {
  test('registers gemini-interactions model definition channel', () => {
    expect(getProviderModelDefinitionChannels('home-standalone')).toContain('gemini-interactions')
    expect(getProviderModelDefinitionChannels('cpa')).toContain('gemini-interactions')
  })

  test('fetches and normalizes interactions provider group in snapshot', async () => {
    const { requests, session } = createManagementAdapter((_method, pathname) => {
      const responseKey = providerResponseKey(pathname)
      if (responseKey !== 'interactions-api-key') return { [responseKey]: [] }

      return {
        'interactions-api-key': [
          {
            id: 'interactions-auth-id',
            uuid: 'interactions-auth-id',
            auth_index: 'interactions-auth-id',
            'api-key': 'AIzaSyTestInteractionsKey',
            'base-url': 'https://generativelanguage.googleapis.com',
            prefix: 'team-interactions',
            'disable-cooling': true,
            'request-retry': 2,
            models: [
              {
                name: 'gemini-2.5-pro',
                alias: 'gemini-pro',
                'display-name': 'Gemini Pro',
                'force-mapping': true,
              },
            ],
          },
        ],
      }
    })

    const snapshot = await fetchProviderSnapshot(session, 'home-cluster')
    const interactionsGroup = snapshot.groups.find((group) => group.id === 'interactions')
    const resource = interactionsGroup?.resources[0]

    expect(interactionsGroup).toMatchObject({
      id: 'interactions',
      path: '/interactions-api-key',
      responseKey: 'interactions-api-key',
      modelDefinitionChannel: 'gemini-interactions',
      supportsModelDiscovery: true,
      supportsRichModelAliases: true,
    })
    expect(resource).toMatchObject({
      identifier: 'interactions-auth-id',
      authIndex: 'interactions-auth-id',
      disableCooling: true,
      requestRetry: 2,
    })
    expect(requests.some((request) => request.pathname.endsWith('/interactions-api-key'))).toBe(
      true,
    )
  })

  test('includes interactions provider in dashboard snapshot and summaries', async () => {
    const { requests, session } = createManagementAdapter((_method, pathname) => {
      const responseKey = providerResponseKey(pathname)
      if (responseKey === 'config') return { 'api-keys': [] }
      if (responseKey === 'latest-version') return { 'latest-version': 'v1.0.0' }
      if (responseKey === 'auth-files') return { files: [] }
      if (responseKey === 'interactions-api-key') {
        return { 'interactions-api-key': [{ id: 'interactions-auth-id', disabled: false }] }
      }
      return { [responseKey]: [] }
    })

    const dashboardSnapshot = await fetchManagementDashboardSnapshot(
      session,
      noCapabilities,
      'home-standalone',
    )
    expect(dashboardSnapshot.providers.find((p) => p.id === 'interactions')).toMatchObject({
      id: 'interactions',
      path: '/interactions-api-key',
      responseKey: 'interactions-api-key',
      total: 1,
      active: 1,
      disabled: 0,
    })
    expect(requests.some((request) => request.pathname.endsWith('/interactions-api-key'))).toBe(
      true,
    )
  })

  test('creates interactions entries with the expected payload', async () => {
    const { requests, session } = createManagementAdapter((_method, pathname) => ({
      [providerResponseKey(pathname)]: [],
    }))

    await createProviderResource(session, 'interactions', createInteractionsForm())

    const createRequest = requests.find(
      (request) => request.method === 'PUT' && request.pathname.endsWith('/interactions-api-key'),
    )
    expect(createRequest?.body).toEqual([
      {
        'api-key': 'AIzaSyTestInteractionsKey',
        'base-url': 'https://generativelanguage.googleapis.com',
        'proxy-url': 'socks5://127.0.0.1:1080',
        prefix: 'team-interactions',
        priority: 5,
        'request-retry': 2,
        headers: { 'X-Custom-Header': 'custom-val' },
        models: [
          {
            name: 'gemini-2.5-pro',
            alias: 'gemini-pro',
            'display-name': 'Gemini Pro',
            'force-mapping': true,
          },
        ],
        'excluded-models': ['gemini-1.0-*'],
        'disable-cooling': true,
      },
    ])
  })

  test('updates and patches interactions entries correctly', async () => {
    const { requests, session } = createManagementAdapter((_method, pathname) => {
      const responseKey = providerResponseKey(pathname)
      if (responseKey !== 'interactions-api-key') return { [responseKey]: [] }

      return {
        'interactions-api-key': [
          {
            id: 'interactions-auth-id',
            'api-key': 'AIzaSyTestInteractionsKey',
          },
        ],
      }
    })

    const snapshot = await fetchProviderSnapshot(session, 'home-cluster')
    const resource = snapshot.groups.find((g) => g.id === 'interactions')?.resources[0]
    if (!resource) throw new Error('Missing resource')

    await updateProviderResource(session, resource, createInteractionsForm({ apiKey: '' }))
    await updateProviderStatus(session, resource, true)

    const updateRequest = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/interactions-api-key'),
    )
    expect(updateRequest?.body).toEqual({
      id: 'interactions-auth-id',
      value: {
        'base-url': 'https://generativelanguage.googleapis.com',
        'proxy-url': 'socks5://127.0.0.1:1080',
        prefix: 'team-interactions',
        priority: 5,
        'request-retry': 2,
        headers: { 'X-Custom-Header': 'custom-val' },
        models: [
          {
            name: 'gemini-2.5-pro',
            alias: 'gemini-pro',
            'display-name': 'Gemini Pro',
            'force-mapping': true,
          },
        ],
        'excluded-models': ['gemini-1.0-*'],
        'disable-cooling': true,
      },
    })

    const statusRequest = requests.find((request) =>
      request.pathname.endsWith('/auth-files/status'),
    )
    expect(statusRequest?.body).toEqual({ name: 'interactions-auth-id', disabled: true })
  })

  test('discovers models using x-goog-api-key header', async () => {
    let passedHeaders: Record<string, unknown> = {}
    const adapter: AxiosAdapter = async (config) => {
      const body = readRequestBody(config.data) as { header?: Record<string, unknown> }
      passedHeaders = body?.header ?? {}
      return {
        data: {
          status_code: 200,
          body: JSON.stringify({
            models: [
              {
                name: 'models/gemini-2.5-pro',
                displayName: 'Gemini 2.5 Pro',
                description: 'Next generation multimodal model',
              },
            ],
          }),
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    axios.defaults.adapter = adapter

    const models = await fetchProviderDiscoveredModels(
      { baseUrl: 'http://management.test', managementKey: 'test-key' },
      {
        providerId: 'interactions',
        baseUrl: '',
        apiKey: 'test-goog-key',
        headers: [],
      },
    )

    expect(passedHeaders['x-goog-api-key']).toBe('test-goog-key')
    expect(models).toEqual([
      {
        name: 'gemini-2.5-pro',
        alias: 'Gemini 2.5 Pro',
        description: 'Next generation multimodal model',
      },
    ])
  })

  test('maintains i18n locale symmetry for interactions provider across all 4 locales', () => {
    const locales = [zhCN, zhTW, en, ru]

    for (const locale of locales) {
      expect(locale.common.dashboard.providerNames.interactions).toBeDefined()
      expect(locale.common.dashboard.issueScopes.interactions).toBeDefined()
      expect(locale.common.providersPage.providerNames.interactions).toBeDefined()
      expect(locale.common.providersPage.modelCatalog.channels['gemini-interactions']).toBeDefined()
      expect(locale.common.configPage.oauthExcluded.channels['gemini-interactions']).toBeDefined()
    }
  })
})
