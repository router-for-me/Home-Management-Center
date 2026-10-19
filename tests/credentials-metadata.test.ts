import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  buildCredentialMetadataPatch,
  createMetadataForm,
  isValidCredentialWeightDraft,
  isValidProxyUrl,
} from '../src/features/credentials/credential-detail-drawer'
import {
  type CredentialResource,
  fetchCredentialSnapshot,
  supportsCredentialWebsockets,
  updateCredentialMetadata,
} from '../src/lib/api/management/credentials'

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

function createCredentialResource(
  provider: string,
  overrides: Partial<CredentialResource> = {},
): CredentialResource {
  return {
    id: `${provider}-01`,
    index: 0,
    identifier: `${provider}-01`,
    name: `${provider}-01`,
    authIndex: `${provider}-01`,
    provider,
    type: 'oauth',
    label: null,
    status: 'active',
    statusMessage: null,
    disabled: false,
    unavailable: false,
    runtimeOnly: false,
    source: 'oauth',
    size: null,
    email: null,
    accountType: null,
    account: null,
    createdAt: null,
    updatedAt: null,
    modifiedAt: null,
    lastRefresh: null,
    nextRetryAfter: null,
    success: null,
    failed: null,
    path: null,
    priority: null,
    requestRetry: null,
    note: null,
    prefix: null,
    proxyUrl: null,
    websockets: false,
    metadataAvailability: {
      prefix: true,
      proxyUrl: true,
      websockets: true,
    },
    selector: { name: `${provider}-01` },
    raw: {},
    ...overrides,
  }
}

describe('supportsCredentialWebsockets', () => {
  test('accepts codex and xai credential families', () => {
    expect(supportsCredentialWebsockets({ provider: 'codex', type: 'oauth' })).toBe(true)
    expect(supportsCredentialWebsockets({ provider: 'codex-api-key', type: 'api_key' })).toBe(true)
    expect(supportsCredentialWebsockets({ provider: 'xai', type: 'oauth' })).toBe(true)
    expect(supportsCredentialWebsockets({ provider: 'xai-api-key', type: 'api_key' })).toBe(true)
    expect(supportsCredentialWebsockets({ provider: 'CODEX', type: 'oauth' })).toBe(true)
  })

  test('rejects other providers', () => {
    expect(supportsCredentialWebsockets({ provider: 'gemini', type: 'oauth' })).toBe(false)
    expect(supportsCredentialWebsockets({ provider: 'claude', type: 'oauth' })).toBe(false)
    expect(supportsCredentialWebsockets({ provider: 'kimi', type: 'oauth' })).toBe(false)
    expect(supportsCredentialWebsockets({ provider: 'antigravity', type: 'oauth' })).toBe(false)
  })
})

describe('fetchCredentialSnapshot metadata projection', () => {
  test('normalizes editable metadata returned by the credentials route', async () => {
    const { session } = createManagementAdapter((method, pathname) => {
      if (method === 'GET' && pathname.endsWith('/credentials')) {
        return {
          files: [
            {
              id: 'codex-01',
              name: 'codex-01.json',
              provider: 'codex',
              type: 'codex',
              prefix: 'team-a',
              proxy_url: 'socks5://127.0.0.1:1080',
              priority: 10,
              websockets: true,
            },
          ],
        }
      }
      return {}
    })

    const resource = (await fetchCredentialSnapshot(session)).resources[0]
    expect(resource).toMatchObject({
      prefix: 'team-a',
      proxyUrl: 'socks5://127.0.0.1:1080',
      priority: 10,
      websockets: true,
      metadataAvailability: {
        prefix: true,
        proxyUrl: true,
        websockets: true,
      },
    })
  })

  test('marks metadata omitted by older backends as unavailable', async () => {
    const { session } = createManagementAdapter((method, pathname) => {
      if (method === 'GET' && pathname.endsWith('/credentials')) {
        return {
          files: [{ id: 'codex-01', provider: 'codex', type: 'codex' }],
        }
      }
      return {}
    })

    const resource = (await fetchCredentialSnapshot(session)).resources[0]
    expect(resource?.metadataAvailability).toEqual({
      prefix: false,
      proxyUrl: false,
      websockets: false,
    })
  })
})

describe('updateCredentialMetadata websockets payload', () => {
  const metadata = {
    prefix: '',
    proxyUrl: 'socks5://127.0.0.1:1080',
    priority: '10',
    note: '',
  }

  test('includes websockets for xai credentials', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('xai'), {
      ...metadata,
      websockets: true,
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect(patch?.body).toMatchObject({
      name: 'xai-01',
      proxy_url: 'socks5://127.0.0.1:1080',
      priority: 10,
      websockets: true,
    })
  })

  test('keeps codex websockets behavior (regression)', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('codex'), {
      ...metadata,
      websockets: false,
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect(patch?.body).toMatchObject({ websockets: false })
  })

  test('omits websockets for unsupported providers', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('gemini'), {
      ...metadata,
      websockets: true,
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect(patch?.body).toMatchObject({ name: 'gemini-01' })
    expect((patch?.body as Record<string, unknown>).websockets).toBeUndefined()
  })

  test('does not overwrite unrelated metadata during an inline websocket update', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('codex'), {
      websockets: true,
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect(patch?.body).toMatchObject({ name: 'codex-01', websockets: true })
    expect(patch?.body).not.toHaveProperty('prefix')
    expect(patch?.body).not.toHaveProperty('proxy_url')
    expect(patch?.body).not.toHaveProperty('priority')
    expect(patch?.body).not.toHaveProperty('note')
  })

  test('sends an explicit null to clear priority', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('codex'), {
      ...metadata,
      priority: null,
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect(patch?.body).toMatchObject({ priority: null })
  })

  test('leaves priority out when the input is an empty string', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('codex'), {
      ...metadata,
      priority: '',
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect((patch?.body as Record<string, unknown>).priority).toBeUndefined()
  })

  test('includes request-retry when provided as a string or number', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('codex'), {
      ...metadata,
      requestRetry: '3',
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect(patch?.body).toMatchObject({ 'request-retry': 3 })
  })

  test('sends an explicit null for request-retry when clearing or inheriting', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('codex'), {
      ...metadata,
      requestRetry: null,
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect(patch?.body).toMatchObject({ 'request-retry': null })
  })

  test('supports weight, tri-state disable-cooling, headers, excluded-models, direct proxy, and custom fields', async () => {
    const { requests, session } = createManagementAdapter((method, pathname) => {
      if (method === 'GET' && pathname.endsWith('/credentials')) {
        return {
          files: [
            {
              id: 'codex-01',
              name: 'codex-01.json',
              provider: 'codex',
              type: 'codex',
              weight: 50,
              disable_cooling: true,
              excluded_models: ['gpt-4o-mini'],
              headers: { 'X-Custom': 'val' },
            },
          ],
        }
      }
      return {}
    })

    expect(isValidProxyUrl('direct')).toBe(true)
    expect(isValidProxyUrl('DIRECT')).toBe(true)
    expect(isValidCredentialWeightDraft('')).toBe(true)
    expect(isValidCredentialWeightDraft('100')).toBe(true)
    expect(isValidCredentialWeightDraft('-1')).toBe(false)
    expect(isValidCredentialWeightDraft('1000001')).toBe(false)

    const snapshot = await fetchCredentialSnapshot(session)
    const resource = snapshot.resources[0]!
    expect(resource.weight).toBe(50)
    expect(resource.disableCooling).toBe(true)
    expect(resource.disableCoolingOverride).toBe(true)
    expect(resource.excludedModels).toEqual(['gpt-4o-mini'])
    expect(resource.headers).toEqual({ 'X-Custom': 'val' })

    const form = createMetadataForm(resource, null, {
      id: 'codex-01',
      custom: { nested: 'initial', flag: true },
    })
    expect(form.disableCooling).toBe(true)

    const patchInput = buildCredentialMetadataPatch(
      resource,
      {
        ...form,
        proxyUrl: 'direct',
        weight: '',
        disableCooling: null,
        excludedModelsText: 'gpt-4.1\no3-mini',
        headers: [{ key: 'X-Org', value: 'team-1' }],
        customFields: [{ path: 'custom.nested', value: 'updated' }],
      },
      { id: 'codex-01', weight: 50 },
    )

    await updateCredentialMetadata(session, resource, patchInput)

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/credentials/fields'),
    )
    expect(patch?.body).toMatchObject({
      proxy_url: 'direct',
      weight: null,
      'disable-cooling': null,
      disable_cooling: null,
      excluded_models: ['gpt-4.1', 'o3-mini'],
      headers: { 'X-Custom': '', 'X-Org': 'team-1' },
      'custom.nested': 'updated',
    })
  })
})
