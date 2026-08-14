import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { fetchAccessKeysSnapshot, replaceAccessKeys } from '../src/lib/api/management/access-keys'

type CapturedRequest = {
  method: string
  headers: AxiosRequestConfig['headers']
}

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

function createManagementAdapter(etag?: string) {
  const requests: CapturedRequest[] = []
  const adapter: AxiosAdapter = async (config) => {
    const method = config.method?.toUpperCase() ?? 'GET'
    requests.push({ method, headers: config.headers })

    return {
      data: method === 'GET' ? { api_key_entries: [{ api_key: 'existing-key' }] } : {},
      status: 200,
      statusText: 'OK',
      headers: method === 'GET' && etag ? { etag } : {},
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

describe('replaceAccessKeys', () => {
  test('sends If-Match when the API key collection response has an ETag', async () => {
    const { requests, session } = createManagementAdapter('"current-etag"')
    const snapshot = await fetchAccessKeysSnapshot(session)

    await replaceAccessKeys(session, ['existing-key'], snapshot)

    const put = requests.find((request) => request.method === 'PUT')
    expect(put?.headers?.get?.('If-Match')).toBe('"current-etag"')
  })

  test('keeps compatibility with older Home responses that have no ETag', async () => {
    const { requests, session } = createManagementAdapter()
    const snapshot = await fetchAccessKeysSnapshot(session)

    await replaceAccessKeys(session, ['existing-key'], snapshot)

    const put = requests.find((request) => request.method === 'PUT')
    expect(put?.headers?.get?.('If-Match')).toBeUndefined()
  })

  test('uses the ETag captured with the edited snapshot without refetching before PUT', async () => {
    const { requests, session } = createManagementAdapter('"edited-snapshot-etag"')
    const snapshot = await fetchAccessKeysSnapshot(session)

    await replaceAccessKeys(session, ['existing-key'], snapshot)

    expect(requests.filter((request) => request.method === 'GET')).toHaveLength(1)
    const put = requests.find((request) => request.method === 'PUT')
    expect(put?.headers?.get?.('If-Match')).toBe('"edited-snapshot-etag"')
  })
})
