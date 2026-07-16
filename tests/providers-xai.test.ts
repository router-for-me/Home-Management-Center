import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { getCredentialOAuthProviders } from '../src/lib/api/management/credentials'
import { fetchManagementDashboardSnapshot } from '../src/lib/api/management/dashboard'
import {
  type ProviderEntryFormInput,
  createProviderResource,
  fetchProviderSnapshot,
  getProviderModelDefinitionChannels,
  updateProviderResource,
  updateProviderStatus,
} from '../src/lib/api/management/providers'
import type { CapabilityMap } from '../src/lib/api/management/types'

type CapturedRequest = {
  method: string
  pathname: string
  body: unknown
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
  requestEvents: false,
  requestEventDetails: false,
  requestEventExport: false,
  requestEventFilters: false,
  requestLogIndex: false,
  oauthUsage: false,
  quotaSnapshots: false,
  quotaSnapshotDetails: false,
  logs: false,
  requestErrorLogs: false,
  users: false,
  accessGroups: false,
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

function createXaiForm(overrides: Partial<ProviderEntryFormInput> = {}): ProviderEntryFormInput {
  return {
    apiKey: 'xai-test-key',
    name: '',
    baseUrl: 'https://api.x.ai/v1',
    proxyUrl: 'socks5://127.0.0.1:1080',
    prefix: 'grok',
    disabled: false,
    disableCooling: true,
    websockets: true,
    priority: 7,
    models: [
      {
        name: 'grok-4.5',
        alias: 'grok-latest',
        displayName: 'Grok Latest',
        forceMapping: true,
      },
    ],
    headers: [{ key: 'X-Test', value: 'value' }],
    excludedModelsText: 'grok-3-*',
    ...overrides,
  }
}

function providerResponseKey(pathname: string) {
  return pathname.slice(pathname.lastIndexOf('/') + 1)
}

describe('xAI provider Management API integration', () => {
  test('keeps xAI capabilities scoped to Home runtimes', () => {
    expect(getCredentialOAuthProviders('cpa')).not.toContain('xai')
    expect(getCredentialOAuthProviders('home-standalone')).toContain('xai')
    expect(getProviderModelDefinitionChannels('cpa')).not.toContain('xai')
    expect(getProviderModelDefinitionChannels('home-cluster')).toContain('xai')
  })

  test('filters the xAI provider route from CPA snapshots', async () => {
    const { requests, session } = createManagementAdapter((_method, pathname) => ({
      [providerResponseKey(pathname)]: [],
    }))

    const snapshot = await fetchProviderSnapshot(session, 'cpa')

    expect(snapshot.groups.map((group) => group.id)).not.toContain('xai')
    expect(requests.some((request) => request.pathname.endsWith('/xai-api-key'))).toBe(false)
  })

  test('keeps Dashboard xAI requests and summaries scoped to Home runtimes', async () => {
    const { requests, session } = createManagementAdapter((_method, pathname) => {
      const responseKey = providerResponseKey(pathname)
      if (responseKey === 'config') return { 'api-keys': [] }
      if (responseKey === 'latest-version') return { 'latest-version': 'v1.0.0' }
      if (responseKey === 'auth-files') return { files: [] }
      if (responseKey === 'xai-api-key') {
        return { 'xai-api-key': [{ id: 'xai-auth-id', disabled: false }] }
      }
      return { [responseKey]: [] }
    })

    const cpaSnapshot = await fetchManagementDashboardSnapshot(session, noCapabilities, 'cpa')
    expect(cpaSnapshot.providers.map((provider) => provider.id)).not.toContain('xai')
    expect(requests.some((request) => request.pathname.endsWith('/xai-api-key'))).toBe(false)

    requests.splice(0)
    const homeSnapshot = await fetchManagementDashboardSnapshot(
      session,
      noCapabilities,
      'home-standalone',
    )
    expect(homeSnapshot.providers.find((provider) => provider.id === 'xai')).toMatchObject({
      total: 1,
      active: 1,
      disabled: 0,
    })
    expect(requests.some((request) => request.pathname.endsWith('/xai-api-key'))).toBe(true)
  })

  test('round-trips xAI advanced fields and uses the returned auth ID', async () => {
    const { requests, session } = createManagementAdapter((_method, pathname) => {
      const responseKey = providerResponseKey(pathname)
      if (responseKey !== 'xai-api-key') return { [responseKey]: [] }

      return {
        'xai-api-key': [
          {
            id: 'xai-auth-id',
            uuid: 'xai-auth-id',
            auth_index: 'xai-auth-id',
            'api-key': 'xai-test-key',
            'base-url': 'https://api.x.ai/v1',
            prefix: 'grok',
            websockets: true,
            'disable-cooling': true,
            models: [
              {
                name: 'grok-4.5',
                alias: 'grok-latest',
                'display-name': 'Grok Latest',
                'force-mapping': true,
              },
            ],
          },
        ],
      }
    })

    const snapshot = await fetchProviderSnapshot(session, 'home-cluster')
    const xaiGroup = snapshot.groups.find((group) => group.id === 'xai')
    const resource = xaiGroup?.resources[0]

    expect(xaiGroup).toMatchObject({
      defaultBaseUrl: 'https://api.x.ai/v1',
      modelDefinitionChannel: 'xai',
      supportsModelDiscovery: false,
      supportsConnectivityTest: false,
      supportsWebsockets: true,
      supportsRichModelAliases: true,
    })
    expect(resource).toMatchObject({
      identifier: 'xai-auth-id',
      authIndex: 'xai-auth-id',
      disableCooling: true,
      websockets: true,
    })

    if (!resource) throw new Error('Missing xAI test resource')

    await updateProviderResource(session, resource, createXaiForm({ apiKey: '' }))
    await updateProviderStatus(session, resource, true)

    const updateRequest = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/xai-api-key'),
    )
    expect(updateRequest?.body).toEqual({
      id: 'xai-auth-id',
      value: {
        'base-url': 'https://api.x.ai/v1',
        'proxy-url': 'socks5://127.0.0.1:1080',
        prefix: 'grok',
        priority: 7,
        headers: { 'X-Test': 'value' },
        models: [
          {
            name: 'grok-4.5',
            alias: 'grok-latest',
            'display-name': 'Grok Latest',
            'force-mapping': true,
          },
        ],
        'excluded-models': ['grok-3-*'],
        'disable-cooling': true,
        websockets: true,
      },
    })

    const statusRequest = requests.find((request) =>
      request.pathname.endsWith('/auth-files/status'),
    )
    expect(statusRequest?.body).toEqual({ name: 'xai-auth-id', disabled: true })
  })

  test('creates xAI entries with the audited native payload', async () => {
    const { requests, session } = createManagementAdapter((_method, pathname) => ({
      [providerResponseKey(pathname)]: [],
    }))

    await createProviderResource(session, 'xai', createXaiForm())

    const createRequest = requests.find(
      (request) => request.method === 'PUT' && request.pathname.endsWith('/xai-api-key'),
    )
    expect(createRequest?.body).toEqual([
      {
        'base-url': 'https://api.x.ai/v1',
        'proxy-url': 'socks5://127.0.0.1:1080',
        prefix: 'grok',
        priority: 7,
        headers: { 'X-Test': 'value' },
        models: [
          {
            name: 'grok-4.5',
            alias: 'grok-latest',
            'display-name': 'Grok Latest',
            'force-mapping': true,
          },
        ],
        'excluded-models': ['grok-3-*'],
        'disable-cooling': true,
        websockets: true,
        'api-key': 'xai-test-key',
      },
    ])
  })
})
