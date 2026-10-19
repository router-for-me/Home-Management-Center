import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { normalizeAccessKey, updateAccessKeyBindings } from '../src/lib/api/management/access-keys'

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

const session = {
  baseUrl: 'http://management.test',
  managementKey: 'test-management-key',
}

describe('updateAccessKeyBindings ownership patches', () => {
  for (const scenario of [
    { name: 'preserves an unchanged owner', original: 2, next: 2, patch: {} },
    { name: 'preserves an omitted owner', original: 2, next: undefined, patch: {} },
    { name: 'preserves an unassigned key', original: null, next: null, patch: {} },
    { name: 'reassigns an owner', original: 2, next: 3, patch: { user_id: 3 } },
    { name: 'assigns an unassigned key', original: null, next: 3, patch: { user_id: 3 } },
    { name: 'explicitly unassigns an owner', original: 2, next: null, patch: { user_id: 0 } },
  ]) {
    test(scenario.name, async () => {
      const requests: unknown[] = []
      const adapter: AxiosAdapter = async (config) => {
        requests.push({ method: config.method, url: config.url, body: JSON.parse(config.data) })
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }
      axios.defaults.adapter = adapter
      const resource = normalizeAccessKey(
        { id: 7, api_key: 'key-7', user_id: scenario.original, channels: [1], model_groups: [2] },
        0,
      )

      await updateAccessKeyBindings(session, resource, {
        userId: scenario.next,
        channelGroupIds: [4],
        modelGroupIds: [5],
      })

      expect(requests).toEqual([
        {
          method: 'patch',
          url: '/access/api-keys',
          body: { id: 7, channels: [4], model_groups: [5], ...scenario.patch },
        },
      ])
    })
  }
})
