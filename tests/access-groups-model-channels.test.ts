import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  createAccessGroupDetail,
  fetchAccessGroupsSnapshot,
} from '@/lib/api/management/access-groups'
import { probeManagementRuntime } from '@/lib/api/management/probe'

const defaultAxiosAdapter = axios.defaults.adapter
const session = { baseUrl: 'http://management.test', managementKey: 'test-key' }

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  }
}

describe('access group model channel bindings', () => {
  test('parses channels on model group details and defaults to inherit', async () => {
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === '/channel-groups') return response(config, { channel_groups: [] })
      if (config.url === '/channel-group-details') {
        return response(config, {
          channel_group_details: [{ id: 1, channel_group_id: 1, auth_id: 'auth-1', channels: [9] }],
        })
      }
      if (config.url === '/model-groups') return response(config, { model_groups: [] })
      if (config.url === '/model-group-details') {
        return response(config, {
          model_group_details: [
            { id: 10, model_group_id: 1, model_id: 'gpt-5.5', channels: [2, 3] },
            { id: 11, model_group_id: 1, model_id: 'kimi-k2' },
            { id: 12, model_group_id: 1, model_id: 'claude-sonnet', channels: 'invalid' },
          ],
        })
      }
      return response(config, {}, 404)
    }
    axios.defaults.adapter = adapter

    const snapshot = await fetchAccessGroupsSnapshot(session)

    // Channel details never carry a model-level scope, even if the payload has one.
    expect(snapshot.channelGroupDetails[0]?.channels).toEqual([])
    expect(snapshot.modelGroupDetails.map((detail) => detail.channels)).toEqual([[2, 3], [], []])
  })

  test('sends channels only for model bindings with an explicit scope', async () => {
    const requests: { url?: string; method?: string; body: unknown }[] = []
    const adapter: AxiosAdapter = async (config) => {
      requests.push({
        url: config.url,
        method: config.method,
        body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      })
      return response(config, { status: 'ok' })
    }
    axios.defaults.adapter = adapter

    await createAccessGroupDetail(session, 'model', {
      groupId: 1,
      targetId: 'gpt-5.5',
      channels: [2, 3],
    })
    await createAccessGroupDetail(session, 'model', { groupId: 1, targetId: 'kimi-k2' })
    await createAccessGroupDetail(session, 'model', {
      groupId: 1,
      targetId: 'kimi-k2',
      channels: [],
    })
    await createAccessGroupDetail(session, 'channel', {
      groupId: 7,
      targetId: 'auth-1',
      channels: [2],
    })

    expect(requests[0]).toMatchObject({
      url: '/model-group-details',
      method: 'post',
      body: { model_group_id: 1, model_id: 'gpt-5.5', channels: [2, 3] },
    })
    // Omitted and empty both mean "inherit the API key scope": no channels field is sent.
    expect(requests[1]?.body).toEqual({ model_group_id: 1, model_id: 'kimi-k2' })
    expect(requests[2]?.body).toEqual({ model_group_id: 1, model_id: 'kimi-k2' })
    expect(requests[3]).toMatchObject({
      url: '/channel-group-details',
      method: 'post',
      body: { channel_group_id: 7, auth_id: 'auth-1' },
    })
  })

  test('reads the declared model_channel_bindings capability bit', async () => {
    let declared: boolean | undefined = true
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === '/config') return response(config, { 'config-version': 8 })
      if (config.url === '/capabilities') {
        return response(config, {
          capabilities: declared === undefined ? {} : { model_channel_bindings: declared },
        })
      }
      return response(config, {}, 404)
    }
    axios.defaults.adapter = adapter

    const supported = await probeManagementRuntime(session)
    expect(supported.capabilities.modelChannelBindings).toBe(true)

    declared = false
    const unsupported = await probeManagementRuntime(session)
    expect(unsupported.capabilities.modelChannelBindings).toBe(false)

    declared = undefined
    const undeclared = await probeManagementRuntime(session)
    expect(undeclared.capabilities.modelChannelBindings).toBe(false)
  })
})
