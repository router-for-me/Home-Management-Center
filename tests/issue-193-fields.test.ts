import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  normalizeModelAliasRule,
  serializeModelAliasRule,
} from '../src/features/config/config-workbench-page'
import { applyConfigChange, fetchConfigSnapshot } from '../src/lib/api/management/config'
import {
  fetchPluginConfig,
  fetchPluginConfigFields,
  savePluginConfig,
  updatePluginEnabled,
} from '../src/lib/api/management/plugin-store'
import {
  type ProviderEntryFormInput,
  fetchProviderSnapshot,
  getProviderModelDefinitionChannels,
  updateProviderResource,
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
      runtimeMode: 'home-cluster' as const,
      capabilities: noCapabilities,
    },
  }
}

describe('issue #193 provider, model, plugin, and config fields', () => {
  test('registers meta provider and model definition channel', async () => {
    expect(getProviderModelDefinitionChannels('home-cluster')).toContain('meta')

    const { session } = createManagementAdapter((method, pathname) => {
      if (method === 'GET' && pathname.endsWith('/config/api-keys/meta')) {
        return [
          {
            'base-url': 'https://api.meta.ai/v1',
            prefix: 'meta',
            keys: [{ id: 'meta-key-1', 'api-key': 'sk-meta', weight: 10, websockets: true }],
            models: [{ name: 'llama-4-maverick', alias: 'llama-4' }],
          },
        ]
      }
      return []
    })

    const snapshot = await fetchProviderSnapshot(session, 'home-cluster')
    const metaGroup = snapshot.groups.find((group) => group.id === 'meta')
    expect(metaGroup).toBeDefined()
    expect(metaGroup?.resources).toHaveLength(1)
    expect(metaGroup?.resources[0]?.weight).toBe(10)
    expect(metaGroup?.resources[0]?.websockets).toBe(true)
  })

  test('preserves unknown model fields and serializes advanced provider & model fields', async () => {
    const { requests, session } = createManagementAdapter((method, pathname) => {
      if (method === 'GET' && pathname.endsWith('/config/api-keys/openai-compatibility')) {
        return [
          {
            name: 'openrouter',
            'base-url': 'https://openrouter.ai/api/v1',
            'support-prompt-cache-key': true,
            'request-scoped-errors': [
              { status: 400, match: ['context_length_exceeded'], action: 'stop' },
            ],
            keys: [
              { id: 'k1', 'api-key': 'sk-or-1', 'proxy-url': 'direct', weight: 5 },
              { id: 'k2', 'api-key': 'sk-or-2', weight: 15 },
            ],
            models: [
              {
                name: 'anthropic/claude-sonnet-4',
                alias: 'sonnet-4',
                'max-context-length': 200000,
                'custom-future-field': 'keep-me',
                thinking: {
                  levels: ['low', 'high'],
                  min: 1024,
                  max: 32000,
                  'zero-allowed': true,
                },
              },
            ],
          },
        ]
      }
      return []
    })

    const snapshot = await fetchProviderSnapshot(session, 'home-cluster')
    const compat = snapshot.groups.find((group) => group.id === 'openaiCompatibility')!
    const resource = compat.resources[0]!

    expect(resource.apiKeyEntryCount).toBe(2)

    const form: ProviderEntryFormInput = {
      apiKey: '',
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      proxyUrl: 'direct',
      prefix: '',
      disabled: false,
      disableCooling: null,
      websockets: false,
      supportPromptCacheKey: true,
      apiKeyEntries: [
        { id: 'k1', apiKey: '', proxyUrl: 'direct', weight: 5 },
        { id: 'k2', apiKey: '', proxyUrl: '', weight: 20 },
      ],
      requestScopedErrors: [
        {
          status: 400,
          match: ['context_length_exceeded', 'bad_request'],
          action: 'stop',
        },
      ],
      models: [
        {
          name: 'anthropic/claude-sonnet-4',
          alias: 'sonnet-4',
          displayName: '',
          forceMapping: false,
          maxContextLength: '256000',
          useMaxCompletionTokens: true,
          thinkingEnabled: true,
          thinkingLevels: ['low', 'high'],
          thinkingMin: '1024',
          thinkingMax: '32000',
          thinkingZeroAllowed: true,
        },
      ],
      headers: [],
      excludedModelsText: '',
    }

    await updateProviderResource(session, resource, form)

    const put = requests.find(
      (req) =>
        req.method === 'PUT' && req.pathname.endsWith('/config/api-keys/openai-compatibility'),
    )
    expect(put?.body).toMatchObject([
      {
        name: 'openrouter',
        'support-prompt-cache-key': true,
        'request-scoped-errors': [
          {
            status: 400,
            match: ['context_length_exceeded', 'bad_request'],
            action: 'stop',
          },
        ],
        keys: [
          { id: 'k1', 'api-key': 'sk-or-1', 'proxy-url': 'direct', weight: 5 },
          { id: 'k2', 'api-key': 'sk-or-2', weight: 20 },
        ],
        models: [
          {
            name: 'anthropic/claude-sonnet-4',
            alias: 'sonnet-4',
            'max-context-length': 256000,
            'use-max-completion-tokens': true,
            'custom-future-field': 'keep-me',
            thinking: {
              levels: ['low', 'high'],
              min: 1024,
              max: 32000,
              'zero-allowed': true,
            },
          },
        ],
      },
    ])
  })

  test('supports plugin config fields, reading, enable toggle, and saving', async () => {
    const { requests, session } = createManagementAdapter((method, pathname) => {
      if (method === 'GET' && pathname.endsWith('/plugins')) {
        return {
          plugins: [
            {
              id: 'demo-plugin',
              config_fields: [
                {
                  name: 'mode',
                  type: 'enum',
                  description: 'Execution mode',
                  enum_values: ['fast', 'safe'],
                },
              ],
            },
          ],
        }
      }
      if (method === 'GET' && pathname.endsWith('/config/plugins/configs/demo-plugin')) {
        return {
          enabled: true,
          priority: 10,
          'load-in-home': true,
          mode: 'fast',
          oldKey: 'legacy',
        }
      }
      return {}
    })

    const fields = await fetchPluginConfigFields(session, 'demo-plugin')
    expect(fields).toEqual([
      {
        name: 'mode',
        type: 'enum',
        description: 'Execution mode',
        enumValues: ['fast', 'safe'],
      },
    ])

    const cfg = await fetchPluginConfig(session, 'demo-plugin')
    expect(cfg).toMatchObject({
      enabled: true,
      priority: 10,
      'load-in-home': true,
      mode: 'fast',
    })

    await updatePluginEnabled(session, 'demo-plugin', false)
    expect(
      requests.find(
        (req) =>
          req.method === 'PUT' &&
          req.pathname.endsWith('/config/plugins/configs/demo-plugin/enabled'),
      )?.body,
    ).toBe(false)

    await savePluginConfig(session, 'demo-plugin', {
      enabled: true,
      priority: 20,
      loadInHome: false,
      params: { mode: 'safe', customNum: 42 },
      removedKeys: ['oldKey'],
    })

    const lastPut = [...requests]
      .reverse()
      .find(
        (req) =>
          req.method === 'PUT' && req.pathname.endsWith('/config/plugins/configs/demo-plugin'),
      )
    expect(lastPut?.body).toEqual({
      enabled: true,
      priority: 20,
      'load-in-home': false,
      mode: 'safe',
      customNum: 42,
    })
  })

  test('supports streaming.send-keepalive-before-ft and oauth.model-alias display-name', async () => {
    const { requests, session } = createManagementAdapter((method, pathname) => {
      if (method === 'GET' && pathname.endsWith('/config')) {
        return {
          requests: {
            streaming: {
              'keepalive-seconds': 15,
              'send-keepalive-before-ft': true,
            },
          },
        }
      }
      return { status: 'ok' }
    })

    const snapshot = await fetchConfigSnapshot(session)
    expect(snapshot.structured.streamingSendKeepaliveBeforeFt).toBe(true)

    await applyConfigChange(session, {
      key: 'streamingSendKeepaliveBeforeFt',
      previousValue: true,
      nextValue: false,
    })
    const put = requests.find(
      (req) =>
        req.method === 'PUT' &&
        req.pathname.endsWith('/config/requests/streaming/send-keepalive-before-ft'),
    )
    expect(put?.body).toBe(false)

    const rule = normalizeModelAliasRule({
      name: 'claude-sonnet-4',
      alias: 'sonnet',
      'display-name': 'Claude Sonnet 4',
      'force-mapping': true,
    })
    expect(rule).toEqual({
      name: 'claude-sonnet-4',
      alias: 'sonnet',
      displayName: 'Claude Sonnet 4',
      forceMapping: true,
    })
    expect(serializeModelAliasRule(rule)).toEqual({
      name: 'claude-sonnet-4',
      alias: 'sonnet',
      'display-name': 'Claude Sonnet 4',
      'force-mapping': true,
    })
  })
})
