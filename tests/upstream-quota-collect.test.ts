import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { triggerQuotaCollection } from '../src/lib/api/management/quota'

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
      status: 202,
      statusText: 'Accepted',
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

describe('triggerQuotaCollection', () => {
  test('posts empty body for a full collection round and parses the response', async () => {
    const { requests, session } = createManagementAdapter(() => ({ accepted: 3, running: true }))

    const result = await triggerQuotaCollection(session)

    expect(result).toEqual({ accepted: 3, running: true })
    const post = requests.find(
      (request) => request.method === 'POST' && request.pathname.endsWith('/quota/collect'),
    )
    expect(post).toBeTruthy()
    expect(post?.body).toEqual({})
  })

  test('forwards credential id and provider filters', async () => {
    const { requests, session } = createManagementAdapter(() => ({ accepted: 1, running: true }))

    const result = await triggerQuotaCollection(session, {
      credentialIds: ['auth-a'],
      providers: ['xai'],
    })

    expect(result.accepted).toBe(1)
    const post = requests.find((request) => request.method === 'POST')
    expect(post?.body).toEqual({ credential_ids: ['auth-a'], providers: ['xai'] })
  })
})
