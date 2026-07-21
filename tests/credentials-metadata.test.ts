import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  type CredentialResource,
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
    note: null,
    prefix: null,
    proxyUrl: null,
    websockets: false,
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
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/auth-files/fields'),
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
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/auth-files/fields'),
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
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/auth-files/fields'),
    )
    expect(patch?.body).toMatchObject({ name: 'gemini-01' })
    expect((patch?.body as Record<string, unknown>).websockets).toBeUndefined()
  })

  test('sends an explicit null to clear priority', async () => {
    const { requests, session } = createManagementAdapter(() => ({}))

    await updateCredentialMetadata(session, createCredentialResource('codex'), {
      ...metadata,
      priority: null,
    })

    const patch = requests.find(
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/auth-files/fields'),
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
      (request) => request.method === 'PATCH' && request.pathname.endsWith('/auth-files/fields'),
    )
    expect((patch?.body as Record<string, unknown>).priority).toBeUndefined()
  })
})
