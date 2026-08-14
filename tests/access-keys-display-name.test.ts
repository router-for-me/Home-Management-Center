import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  createAccessKey,
  fetchAccessKeysSnapshot,
  replaceAccessKeys,
  updateAccessKey,
} from '../src/lib/api/management/access-keys'

type CapturedRequest = {
  method: string
  body: unknown
}

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

const session = {
  baseUrl: 'http://management.test',
  managementKey: 'test-management-key',
}

function createManagementAdapter(getData: unknown) {
  const requests: CapturedRequest[] = []
  const adapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
    const method = config.method?.toUpperCase() ?? 'GET'
    requests.push({
      method,
      body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
    })

    return {
      data: method === 'GET' ? getData : {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  axios.defaults.adapter = adapter

  return requests
}

describe('fetchAccessKeysSnapshot display names', () => {
  test('normalizes display_name and detects support', async () => {
    createManagementAdapter({
      api_key_entries: [
        { id: 1, api_key: 'key-1', display_name: ' Production key ' },
        { id: 2, api_key: 'key-2', display_name: null },
      ],
    })

    const snapshot = await fetchAccessKeysSnapshot(session)

    expect(snapshot.supportsDisplayNames).toBe(true)
    expect(snapshot.resources[0]?.displayName).toBe('Production key')
    expect(snapshot.resources[1]?.displayName).toBeNull()
  })

  test('reports no support when older Home entries omit display_name', async () => {
    createManagementAdapter({ api_key_entries: [{ id: 1, api_key: 'key-1' }] })

    const snapshot = await fetchAccessKeysSnapshot(session)

    expect(snapshot.supportsDisplayNames).toBe(false)
    expect(snapshot.resources[0]?.displayName).toBeNull()
  })

  test('keeps the rename UI available for an empty collection', async () => {
    createManagementAdapter({ api_key_entries: [] })

    const snapshot = await fetchAccessKeysSnapshot(session)

    expect(snapshot.supportsDisplayNames).toBe(true)
  })
})

describe('updateAccessKey display names', () => {
  const resource = {
    id: '7',
    index: 0,
    numericId: 7,
    identifier: 'api-key-7',
    displayName: 'Old name',
    value: 'key-7',
    maskedValue: 'key-7***',
    prefix: 'key-7',
    suffix: 'ey-7',
    length: 5,
    userId: 3,
    channelGroupIds: [1],
    modelGroupIds: [2],
    raw: null,
  }

  test('a rename-only update patches display_name without rotating the key', async () => {
    const requests = createManagementAdapter({})

    await updateAccessKey(session, resource, { displayName: 'New name' })

    const patch = requests.find((request) => request.method === 'PATCH')
    expect(patch?.body).toEqual({ id: 7, display_name: 'New name' })
  })

  test('an empty display name clears the stored name', async () => {
    const requests = createManagementAdapter({})

    await updateAccessKey(session, resource, { displayName: '  ' })

    const patch = requests.find((request) => request.method === 'PATCH')
    expect(patch?.body).toEqual({ id: 7, display_name: null })
  })

  test('a rotation without display name changes leaves the stored name alone', async () => {
    const requests = createManagementAdapter({})

    await updateAccessKey(session, resource, { value: 'rotated-key' })

    const patch = requests.find((request) => request.method === 'PATCH')
    expect(patch?.body).toEqual({
      id: 7,
      value: { api_key: 'rotated-key', user_id: 3, channels: [1], model_groups: [2] },
    })
  })

  test('a combined update rotates the key and renames it in one request', async () => {
    const requests = createManagementAdapter({})

    await updateAccessKey(session, resource, { value: 'rotated-key', displayName: 'New name' })

    const patch = requests.find((request) => request.method === 'PATCH')
    expect(patch?.body).toEqual({
      id: 7,
      value: { api_key: 'rotated-key', user_id: 3, channels: [1], model_groups: [2] },
      display_name: 'New name',
    })
  })
})

describe('createAccessKey display names', () => {
  test('sends display_name when the caller provides one', async () => {
    const requests = createManagementAdapter({ api_key_entries: [] })

    await createAccessKey(session, { value: 'new-key', displayName: 'Fresh key' })

    const post = requests.find((request) => request.method === 'POST')
    expect(post?.body).toEqual({
      api_key: 'new-key',
      display_name: 'Fresh key',
      user_id: 0,
      channels: [],
      model_groups: [],
    })
  })

  test('omits display_name when the caller does not set one', async () => {
    const requests = createManagementAdapter({ api_key_entries: [] })

    await createAccessKey(session, { value: 'new-key' })

    const post = requests.find((request) => request.method === 'POST')
    expect(post?.body).toEqual({ api_key: 'new-key', user_id: 0, channels: [], model_groups: [] })
  })
})

describe('replaceAccessKeys display names', () => {
  test('omits display_name so the backend preserves stored names', async () => {
    const requests = createManagementAdapter({})
    const snapshot = {
      fetchedAt: new Date().toISOString(),
      etag: null,
      supportsDisplayNames: true,
      resources: [
        {
          id: '7',
          index: 0,
          numericId: 7,
          identifier: 'api-key-7',
          displayName: 'Named key',
          value: 'key-7',
          maskedValue: 'key-7***',
          prefix: 'key-7',
          suffix: 'ey-7',
          length: 5,
          userId: 3,
          channelGroupIds: [1],
          modelGroupIds: [2],
          raw: null,
        },
      ],
    }

    await replaceAccessKeys(session, ['key-7', 'brand-new-key'], snapshot)

    const put = requests.find((request) => request.method === 'PUT')
    const body = put?.body as { api_key_entries?: Record<string, unknown>[] }
    expect(body.api_key_entries).toHaveLength(2)
    for (const entry of body.api_key_entries ?? []) {
      expect('display_name' in entry).toBe(false)
    }
  })
})
