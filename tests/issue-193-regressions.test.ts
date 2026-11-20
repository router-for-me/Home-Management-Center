import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { createFormState } from '../src/features/providers/providers-panel'
import {
  fetchCredentialRawMetadata,
  normalizeCredentialResource,
  updateCredentialMetadata,
} from '../src/lib/api/management/credentials'
import {
  connectionPoolIssues,
  readConnectionPool,
} from '../src/lib/api/management/provider-connection-pool'
import {
  createProviderResource,
  fetchProviderSnapshot,
  updateProviderResource,
} from '../src/lib/api/management/providers'
import { en } from '../src/lib/i18n/locales/en'
import { ru } from '../src/lib/i18n/locales/ru'
import { zhCN } from '../src/lib/i18n/locales/zh-CN'
import { zhTW } from '../src/lib/i18n/locales/zh-TW'

type RecordValue = Record<string, any>
const originalAdapter = axios.defaults.adapter
const session = { baseUrl: 'http://issue-193.test', managementKey: 'synthetic-key' }
afterEach(() => {
  axios.defaults.adapter = originalAdapter
})

async function setup(family: RecordValue[], provider = 'openaiCompatibility') {
  let current = family
  const writes: RecordValue[][] = []
  const apiFamily = provider === 'openaiCompatibility' ? 'openai-compatibility' : provider
  const adapter: AxiosAdapter = async (config) => {
    if (config.method === 'put') writes.push(JSON.parse(config.data))
    return {
      data: config.url?.endsWith(`/api-keys/${apiFamily}`) ? current : [],
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
    }
  }
  axios.defaults.adapter = adapter
  const snapshot = await fetchProviderSnapshot(session, 'home-cluster')
  const group = snapshot.groups.find((group) => group.id === provider)!
  const resource = group.resources[0]!
  return {
    group,
    form: createFormState(resource, group),
    writes,
    setCurrent: (value: RecordValue[]) => {
      current = value
    },
    save: (form: ReturnType<typeof createFormState>) =>
      updateProviderResource(session, resource, form),
  }
}
const groupWith = (keys: RecordValue[], models: RecordValue[] = []) => [
  {
    name: 'fixture',
    'base-url': 'https://example.test/v1',
    keys,
    models,
  },
]

describe('Vertex execution options and model overrides', () => {
  const native = { name: 'shared', alias: 'native', openapi: false, thinking: {} }
  const compatible = { name: 'shared', alias: 'chat', openapi: true, thinking: null }
  const automatic = { name: 'auto', openapi: null, 'future-field': 0 }
  const key = { id: 'A', 'api-key': 'fake-A', openapi: null }
  const sibling = { id: 'B', 'api-key': 'fake-B', interactions: false, models: [automatic] }
  const group = {
    name: 'fixture',
    interactions: true,
    openapi: false,
    'openapi-location': 'global',
    models: [native, compatible, automatic],
    keys: [key, sibling],
  }

  test('editing an inheriting key or its group preserves both model lists and the other key', async () => {
    const { form, save, writes } = await setup([group], 'vertex')
    expect(form.groupVertexOptions).toEqual({
      interactions: true,
      openapi: false,
      location: 'global',
    })
    expect(form.keyVertexOptions).toEqual({ interactions: null, openapi: null, location: '' })
    form.keyVertexOptions!.interactions = false
    form.keyVertexOptions!.location = ' us-central1 '
    await save(form)
    expect(writes[0]).toEqual([
      {
        ...group,
        keys: [{ ...key, interactions: false, 'openapi-location': 'us-central1' }, sibling],
      },
    ])
    form.groupVertexOptions!.openapi = true
    await save(form)
    expect(writes[1]).toEqual([{ ...writes[0][0], openapi: true }])
  })

  test('restoring group inheritance removes only the explicit key overrides', async () => {
    const original = {
      ...group,
      keys: [{ ...key, openapi: true, interactions: false, 'openapi-location': 'eu' }, sibling],
    }
    const { form, save, writes } = await setup([original], 'vertex')
    form.keyVertexOptions = { openapi: null, interactions: null, location: '' }
    await save(form)
    expect(writes[0]).toEqual([{ ...group, keys: [{ id: 'A', 'api-key': 'fake-A' }, sibling] }])
  })

  test('per-row protocol edits follow row identity and leave credential and sibling settings intact', async () => {
    const { form, save, writes } = await setup([group], 'vertex')
    expect(form.models.map((model) => model.openapi)).toEqual([false, true, null])
    const [first, second, third] = form.models
    form.models = [
      { ...second, openapi: null },
      { ...first, name: 'renamed', openapi: true },
      third,
    ]
    await save(form)
    expect(writes[0]).toEqual([
      {
        ...group,
        keys: [
          {
            ...key,
            models: [
              { name: 'shared', alias: 'chat', thinking: null },
              { ...native, name: 'renamed', openapi: true },
              automatic,
            ],
          },
          sibling,
        ],
      },
    ])
  })

  test('creating a Vertex credential keeps an automatic row absent and explicit native false', async () => {
    const { group: descriptor, writes } = await setup([group], 'vertex')
    const form = createFormState(null, descriptor)
    form.apiKey = 'fake-new'
    form.groupVertexOptions = { interactions: false, openapi: true, location: ' global ' }
    const row = { raw: null, name: 'first', alias: '', displayName: '', forceMapping: false }
    form.models = [row, { ...row, name: 'second', openapi: false }]
    await createProviderResource(session, descriptor.id, form)
    const created = writes[0].at(-1)!
    expect(created).toMatchObject({
      interactions: false,
      openapi: true,
      'openapi-location': 'global',
      models: [{ name: 'first' }, { name: 'second', openapi: false }],
    })
    expect(created.models[0]).not.toHaveProperty('openapi')
    expect(created.keys[0]).not.toHaveProperty('openapi')
  })

  test('changing group defaults checks membership and retains the draft on a conflict', async () => {
    const { form, save, writes, setCurrent } = await setup([group], 'vertex')
    setCurrent([{ ...group, keys: [...group.keys, { id: 'C', 'api-key': 'fake-C' }] }])
    form.groupVertexOptions!.location = 'global-test'
    await expect(save(form)).rejects.toThrow()
    expect(writes).toHaveLength(0)
    expect(form.groupVertexOptions!.location).toBe('global-test')
  })

  test('Claude thinking.type can be set or removed independently of the rest of a model', async () => {
    const models = [
      {
        name: 'claude',
        thinking: { 'disable-type': 'between_tools', 'zero-allowed': false, custom: 0 },
      },
      { name: 'other', thinking: {} },
    ]
    const { form, save, writes } = await setup(groupWith([key], models), 'claude')
    expect(form.models[0].thinkingDisableType).toBe('between_tools')
    form.models[0].thinkingDisableType = ''
    form.models[1].thinkingDisableType = 'custom_type'
    form.models[1].openapi = true
    form.groupVertexOptions = { interactions: false, openapi: true, location: 'eu' }
    await save(form)
    expect(writes[0]).toEqual(
      groupWith(
        [key],
        [
          { name: 'claude', thinking: { 'zero-allowed': false, custom: 0 } },
          { name: 'other', thinking: { 'disable-type': 'custom_type' } },
        ],
      ),
    )
  })
})

describe('provider connection pool scopes', () => {
  for (const provider of [
    'gemini',
    'interactions',
    'vertex',
    'codex',
    'xai',
    'meta',
    'claude',
    'openaiCompatibility',
  ]) {
    test(`${provider} writes the group and one key independently`, async () => {
      const sibling = { id: 'B', 'api-key': 'fake-B', 'connection-pool': { enabled: false } }
      const first = {
        id: 'A',
        'api-key': 'fake-A',
        'connection-pool': { enabled: null, extra: { retain: true } },
      }
      const [initial] = groupWith([first, sibling])
      const other = { name: 'other', keys: [{ id: 'C' }] }
      const { form, save, writes } = await setup(
        [{ ...initial, 'connection-pool': null }, other],
        provider,
      )
      expect(form.groupConnectionPool?.mode).toBe('absent')
      const key = form.keyConnectionPool ?? form.apiKeyEntries![0].connectionPool!
      expect(key).toEqual({ mode: 'configured', idleTimeout: '', maxIdle: '' })
      form.groupConnectionPool!.mode = 'configured'
      key.maxIdle = '0'
      await save(form)
      expect(writes[0]).toEqual([
        {
          ...initial,
          'connection-pool': {},
          keys: [
            {
              ...first,
              'connection-pool': { ...first['connection-pool'], 'max-idle-conns-per-host': 0 },
            },
            sibling,
          ],
        },
        other,
      ])
    })
  }

  test('removing a group and clearing one inherited field keep sibling overrides and nulls intact', async () => {
    const sibling = { id: 'B', 'api-key': 'fake-B', 'connection-pool': null }
    const key = {
      id: 'A',
      'api-key': 'fake-A',
      'connection-pool': { enabled: true, 'idle-conn-timeout': null, 'max-idle-conns-per-host': 0 },
    }
    const [group] = groupWith([key, sibling])
    const { form, save, writes } = await setup(
      [{ ...group, 'connection-pool': { enabled: false, 'idle-conn-timeout': '2m' } }],
      'codex',
    )
    expect(form.keyConnectionPool?.idleTimeout).toBe('')
    form.groupConnectionPool!.mode = 'absent'
    form.keyConnectionPool!.maxIdle = ''
    await save(form)
    expect(writes[0]).toEqual([
      {
        ...group,
        keys: [
          { ...key, 'connection-pool': { enabled: true, 'idle-conn-timeout': null } },
          sibling,
        ],
      },
    ])
  })

  test('group edits apply to both sides of a native base URL split', async () => {
    const keys = [
      { id: 'A', 'api-key': 'fake-A' },
      { id: 'B', 'api-key': 'fake-B' },
    ]
    const [group] = groupWith(keys)
    const { form, save, writes } = await setup([group], 'vertex')
    form.baseUrl = 'https://new.test'
    form.groupConnectionPool = readConnectionPool({ enabled: true, 'idle-conn-timeout': '1m30s' })
    form.keyConnectionPool = readConnectionPool({ enabled: false })
    await save(form)
    const pooled = { ...group, 'connection-pool': { enabled: true, 'idle-conn-timeout': '1m30s' } }
    expect(writes[0]).toEqual([
      { ...pooled, keys: [keys[1]] },
      {
        ...pooled,
        'base-url': form.baseUrl,
        keys: [{ ...keys[0], 'connection-pool': { enabled: false } }],
      },
    ])
  })

  test('a native group edit rejects changed membership, while a key edit preserves a newly added sibling', async () => {
    const [group] = groupWith([{ id: 'A', 'api-key': 'fake-A' }])
    const { form, save, writes, setCurrent } = await setup([group], 'codex')
    const sibling = { id: 'B', 'api-key': 'fake-B' }
    setCurrent([{ ...group, keys: [...group.keys, sibling] }])
    form.groupConnectionPool = readConnectionPool({})
    await expect(save(form)).rejects.toThrow()
    expect(writes).toEqual([])
    form.groupConnectionPool = readConnectionPool()
    form.keyConnectionPool = readConnectionPool({ enabled: false })
    await save(form)
    expect(writes[0][0].keys).toEqual([
      { ...group.keys[0], 'connection-pool': { enabled: false } },
      sibling,
    ])
  })

  test('a regrouped compatibility record is selected by stable member IDs, including after a secret rotation', async () => {
    const [group] = groupWith([
      { id: 'A', 'api-key': 'fake-A' },
      { id: 'B', 'api-key': 'fake-B' },
    ])
    const [other] = groupWith([
      { id: 'C', 'api-key': 'fake-C' },
      { id: 'D', 'api-key': 'fake-D' },
    ])
    const { form, save, writes, setCurrent, group: descriptor } = await setup([group, other])
    expect(new Set(descriptor.resources.map((resource) => resource.id)).size).toBe(2)
    const latest = { ...group, keys: [{ ...group.keys[0], 'api-key': 'rotated' }, group.keys[1]] }
    setCurrent([other, latest])
    form.apiKeyEntries!.reverse()
    form.apiKeyEntries![0].connectionPool = readConnectionPool({ enabled: true })
    await save(form)
    expect(writes[0]).toEqual([
      other,
      {
        ...latest,
        keys: [{ ...group.keys[1], 'connection-pool': { enabled: true } }, latest.keys[0]],
      },
    ])
    setCurrent([latest, latest])
    await expect(save(form)).rejects.toThrow()
    expect(writes.length).toBe(1)
  })

  for (const provider of ['codex', 'openaiCompatibility'] as const) {
    test(`${provider} creates an empty group pool and a disabled key, then removes just the key override`, async () => {
      const { group, writes } = await setup(groupWith([{ id: 'A', 'api-key': 'old' }]), provider)
      const draft = createFormState(null, group)
      draft.name = 'new'
      draft.baseUrl = 'https://new.test'
      draft.groupConnectionPool = readConnectionPool({})
      const optOut = readConnectionPool({ enabled: false })
      draft.apiKey = 'fake-new'
      if (draft.apiKeyEntries)
        Object.assign(draft.apiKeyEntries[0], { apiKey: draft.apiKey, connectionPool: optOut })
      else draft.keyConnectionPool = optOut
      await createProviderResource(session, provider, draft)
      const created = writes[0][1]
      expect(created['connection-pool']).toEqual({})
      expect(created.keys[0]['connection-pool']).toEqual({ enabled: false })
      const reopened = await setup([created], provider)
      const override =
        reopened.form.keyConnectionPool ?? reopened.form.apiKeyEntries![0].connectionPool!
      override.mode = 'absent'
      await reopened.save(reopened.form)
      expect(reopened.writes[0][0]['connection-pool']).toEqual({})
      expect(reopened.writes[0][0].keys[0]).not.toHaveProperty('connection-pool')
    })
  }

  test('unrecognized blocks survive unrelated edits, and invalid drafts never write', async () => {
    const [initial] = groupWith([{ id: 'A', 'api-key': 'fake', 'connection-pool': [] }])
    const { form, writes, save } = await setup(
      [{ ...initial, 'connection-pool': { enabled: 'future' } }],
      'codex',
    )
    expect(form.groupConnectionPool?.mode).toBe('unsupported')
    expect(form.keyConnectionPool?.mode).toBe('unsupported')
    form.prefix = 'new'
    await save(form)
    expect(writes[0]).toEqual([
      { ...initial, prefix: 'new', 'connection-pool': { enabled: 'future' } },
    ])
    const other = await setup([initial], 'codex')
    other.form.groupConnectionPool = { mode: 'enabled', idleTimeout: '12d', maxIdle: '' }
    await expect(other.save(other.form)).rejects.toThrow()
    expect(other.writes).toEqual([])
  })

  test('validates the signed Go duration boundary and preserves nonpositive limits', () => {
    const draft = readConnectionPool({})
    for (const idleTimeout of ['0', '-0', '+0', '0s', '-1m30s', '.25s', '-9223372036854775808ns']) {
      expect(connectionPoolIssues({ ...draft, idleTimeout, maxIdle: '-2' })).toEqual({
        idleTimeout: false,
        maxIdle: false,
      })
    }
    for (const idleTimeout of [
      '+',
      '-',
      '4',
      '0d',
      '-9223372036854775809ns',
      '9223372036854775808ns',
    ]) {
      expect(connectionPoolIssues({ ...draft, idleTimeout, maxIdle: '2.5' })).toEqual({
        idleTimeout: true,
        maxIdle: true,
      })
    }
  })
})

describe('compatibility key identities', () => {
  test('removing an earlier key does not copy its weight to a surviving key', async () => {
    const { form, save, writes } = await setup(
      groupWith([
        { id: 'A', 'api-key': 'fake-A', weight: 0 },
        { id: 'B', 'api-key': 'fake-B' },
      ]),
    )
    form.apiKeyEntries!.splice(0, 1)
    await save(form)
    expect(writes[0][0].keys).toEqual([{ id: 'B', 'api-key': 'fake-B' }])
  })
  test('supports removing every key and the keyless group fallback', async () => {
    const { form, save, writes } = await setup(groupWith([{ id: 'A', 'api-key': 'fake-A' }]))
    form.apiKeyEntries = []
    await save(form)
    expect(writes[0][0].keys).toEqual([])
  })
  test('a replacement row gets a new identity and blank new rows stay blank', async () => {
    const { form, save, writes } = await setup(
      groupWith([{ id: 'A', 'api-key': 'fake-A', weight: 0 }]),
    )
    form.apiKeyEntries = [
      { apiKey: 'fake-new', proxyUrl: 'direct' },
      { apiKey: '', proxyUrl: '' },
    ]
    await save(form)
    expect(writes[0][0].keys).toEqual([{ 'api-key': 'fake-new', 'proxy-url': 'direct' }])
  })
  test('reordering keys preserves their secrets, identity and individual overrides', async () => {
    const { form, save, writes } = await setup(
      groupWith([
        { id: 'A', 'api-key': 'fake-A', weight: 3 },
        { id: 'B', 'api-key': 'fake-B', 'proxy-url': 'direct' },
      ]),
    )
    form.apiKeyEntries!.reverse()
    await save(form)
    expect(writes[0][0].keys).toEqual([
      { id: 'B', 'api-key': 'fake-B', 'proxy-url': 'direct' },
      { id: 'A', 'api-key': 'fake-A', weight: 3 },
    ])
  })
  test('retaining a key preserves a fresh server-side secret rotation', async () => {
    const { form, save, writes, setCurrent } = await setup(
      groupWith([{ id: 'A', 'api-key': 'fake-A' }]),
    )
    setCurrent(groupWith([{ id: 'A', 'api-key': 'fake-rotated' }]))
    await save(form)
    expect(writes[0][0].keys[0]['api-key']).toBe('fake-rotated')
  })
  test('does not resurrect a credential removed while the form was open', async () => {
    const { form, save, writes, setCurrent } = await setup(
      groupWith([{ id: 'A', 'api-key': 'fake-A' }]),
    )
    setCurrent(groupWith([{ id: 'B', 'api-key': 'fake-B' }]))
    await expect(save(form)).rejects.toThrow('Provider credential not found')
    expect(writes).toHaveLength(0)
  })
  test('explicitly clearing weight restores its default', async () => {
    const { form, save, writes } = await setup(
      groupWith([{ id: 'A', 'api-key': 'fake-A', weight: 0 }]),
    )
    form.apiKeyEntries![0].weight = null
    await save(form)
    expect(writes[0][0].keys[0]).not.toHaveProperty('weight')
  })
})

describe('model and rule round trips', () => {
  for (const provider of [
    'gemini',
    'interactions',
    'claude',
    'codex',
    'xai',
    'meta',
    'vertex',
    'openaiCompatibility',
  ]) {
    test(`${provider} retains explicit empty thinking and nonstandard levels on ordinary edits`, async () => {
      const { form, save, writes } = await setup(
        groupWith(
          [{ id: 'A', 'api-key': 'fake-A' }],
          [
            { name: 'model-A', thinking: {}, 'future-option': { retain: true } },
            {
              name: 'model-B',
              thinking: { levels: ['custom-level', 'high'], 'future-capability': 1 },
            },
          ],
        ),
        provider,
      )
      form.prefix = 'edited'
      await save(form)
      expect(writes[0][0].models).toEqual([
        { name: 'model-A', thinking: {}, 'future-option': { retain: true } },
        { name: 'model-B', thinking: { levels: ['custom-level', 'high'], 'future-capability': 1 } },
      ])
    })
  }
  test('disabling an explicit thinking override restores omission', async () => {
    const { form, save, writes } = await setup(
      groupWith([{ id: 'A', 'api-key': 'fake-A' }], [{ name: 'model-A', thinking: {} }]),
    )
    form.models[0].thinkingEnabled = false
    await save(form)
    expect(writes[0][0].models[0]).not.toHaveProperty('thinking')
  })
  test('normalizes error-rule drafts only when submitting the API payload', async () => {
    const { form, save, writes } = await setup(groupWith([{ id: 'A', 'api-key': 'fake-A' }]))
    form.requestScopedErrors = [
      {
        status: 429,
        action: 'continue-and-cooldown',
        match: ['first value ', '', ' second '],
        'match-regexr': [' rate.*limit ', ''],
      },
    ]
    await save(form)
    expect(writes[0][0]['request-scoped-errors']).toEqual([
      {
        status: 429,
        action: 'continue-and-cooldown',
        match: ['first value', 'second'],
        'match-regexr': ['rate.*limit'],
      },
    ])
    expect(form.requestScopedErrors[0].match).toEqual(['first value ', '', ' second '])
  })
})

describe('credential metadata boundaries', () => {
  const resource = normalizeCredentialResource({ id: 'A', type: 'codex', provider: 'codex' }, 0)
  for (const path of [
    'id',
    ' ID ',
    'uuid',
    'auth_index',
    'authIndex',
    'index',
    'name',
    'file',
    'filename',
    'id.child',
    'version',
    'max_in_flight',
    'max_in_flight_by_model.model',
  ]) {
    test(`rejects reserved custom path ${path} before sending a request`, async () => {
      let requests = 0
      axios.defaults.adapter = async () => {
        requests++
        throw new Error('Unexpected request')
      }
      await expect(
        updateCredentialMetadata(session, resource, {
          customFields: { [path]: 'B', 'custom.team': 'team' },
        }),
      ).rejects.toThrow('cannot be edited as metadata')
      expect(requests).toBe(0)
    })
  }
  test('valid custom nested paths keep the original target id', async () => {
    let body: any
    axios.defaults.adapter = async (config) => {
      body = JSON.parse(config.data)
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }
    await updateCredentialMetadata(session, resource, {
      customFields: { 'custom.team': 'team', 'token.access_token': 'synthetic-token' },
    })
    expect(body).toMatchObject({
      id: 'A',
      'custom.team': 'team',
      'token.access_token': 'synthetic-token',
    })
  })
  for (const data of ['not-json', '[]', 'null', []]) {
    test(`does not treat invalid metadata ${JSON.stringify(data)} as an empty credential`, async () => {
      axios.defaults.adapter = async (config) => ({
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
      await expect(fetchCredentialRawMetadata(session, resource)).rejects.toThrow()
    })
  }
})

test('all static labels used by the changed forms resolve in every supported language', async () => {
  const sources = await Promise.all(
    [
      '../src/features/providers/providers-panel.tsx',
      '../src/features/providers/provider-connection-pool-editor.tsx',
      '../src/features/credentials/credential-detail-drawer.tsx',
      '../src/features/plugins/plugins-workbench-page.tsx',
    ].map((path) => Bun.file(new URL(path, import.meta.url)).text()),
  )
  const keys = new Set(
    sources.flatMap((source) => [...source.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1])),
  )
  for (const [language, locale] of Object.entries({ en, zhCN, zhTW, ru })) {
    for (const key of keys) {
      const value = key.split('.').reduce<any>((current, part) => current?.[part], locale.common)
      expect(typeof value, `${language}: ${key}`).toBe('string')
    }
  }
})

describe('provider family replacements preserve persisted configuration', () => {
  for (const provider of [
    'claude',
    'vertex',
    'gemini',
    'interactions',
    'codex',
    'xai',
    'meta',
    'openaiCompatibility',
  ]) {
    test(`a prefix edit changes only that field for ${provider}`, async () => {
      const key = {
        id: 'A',
        'api-key': 'fixture-A',
        'connection-pool': { enabled: false },
        weight: 0,
        ...(provider === 'claude'
          ? {
              cloak: {
                'sensitive-words-replace': { old: '' },
                'sensitive-patterns-replace': [{ pattern: '^old', replacement: '' }],
              },
            }
          : {}),
        ...(provider === 'vertex'
          ? { interactions: false, openapi: true, 'openapi-location': 'global' }
          : {}),
      }
      const group = {
        name: 'test',
        'connection-pool': {},
        keys: [key],
        'disable-cooling': null,
        headers: {},
        models: [
          {
            name: 'upstream',
            alias: 'upstream',
            'force-mapping': false,
            thinking: { 'disable-type': 'between_tools', levels: [] },
            ...(provider === 'vertex' ? { openapi: false } : {}),
          },
        ],
      }
      const { form, save, writes } = await setup([group], provider)
      form.prefix = 'edited'
      await save(form)
      expect(writes).toEqual([[{ ...group, prefix: 'edited' }]])
    })
  }

  test('editing one known cloak field keeps replacement rules and inherited booleans', async () => {
    const cloak = { 'sensitive-words-replace': { old: '' }, 'sensitive-patterns-replace': [] }
    const group = { keys: [{ id: 'A', 'api-key': 'fixture-A', cloak }] }
    const { form, save, writes } = await setup([group], 'claude')
    form.cloak!.mode = 'always'
    await save(form)
    expect(writes[0][0].keys[0].cloak).toEqual({ ...cloak, mode: 'always' })
  })

  test('editing Claude replacement rules changes one key and preserves sibling and opaque cloak fields', async () => {
    const sibling = {
      id: 'B',
      'api-key': 'fake-B',
      cloak: { 'strict-mode': false, 'sensitive-words': ['existing'] },
    }
    const patterns = [
      { pattern: '(?i)(label)', replacement: '$1' },
      { pattern: '^omitted-replacement$' },
      { pattern: '(?s)old.*', replacement: '' },
    ]
    const cloak = {
      'sensitive-words-replace': { old: '', other: 'keep' },
      'sensitive-patterns-replace': patterns,
      extra: { enabled: false },
    }
    const { form, save, writes } = await setup(
      groupWith([{ id: 'A', 'api-key': 'fake-A', cloak }, sibling]),
      'claude',
    )
    expect(form.cloak!.patternReplacements).toEqual(patterns)
    form.cloak!.patternReplacements = [...patterns].reverse()
    form.cloak!.literalReplacements = [{ pattern: ' new\nphrase ', replacement: '' }]
    await save(form)
    expect(writes[0][0].keys).toEqual([
      {
        id: 'A',
        'api-key': 'fake-A',
        cloak: {
          ...cloak,
          'sensitive-words-replace': { ' new\nphrase ': '' },
          'sensitive-patterns-replace': [...patterns].reverse(),
        },
      },
      sibling,
    ])
    form.cloak!.literalReplacements = [
      { pattern: 'same', replacement: 'a' },
      { pattern: 'same', replacement: 'b' },
    ]
    await expect(save(form)).rejects.toThrow()
    expect(writes).toHaveLength(1)
  })

  test('a newer Claude pattern shape is retained when the literal rules are edited', async () => {
    const future = [{ pattern: 'old', replacement: '', flags: 'future' }]
    const { form, save, writes } = await setup(
      groupWith([
        { id: 'A', 'api-key': 'fake-A', cloak: { 'sensitive-patterns-replace': future } },
      ]),
      'claude',
    )
    expect(form.cloak!.patternReplacements).toBeNull()
    form.cloak!.literalReplacements = [{ pattern: 'x', replacement: '' }]
    await save(form)
    expect(writes[0][0].keys[0].cloak).toEqual({
      'sensitive-patterns-replace': future,
      'sensitive-words-replace': { x: '' },
    })
  })

  test('reordered and renamed duplicate model names keep their own protocol and thinking', async () => {
    const native = {
      name: 'shared',
      alias: 'native',
      openapi: false,
      thinking: { 'disable-type': 'disabled' },
    }
    const openapi = {
      name: 'shared',
      alias: 'compat',
      openapi: true,
      'force-mapping': false,
      thinking: null,
    }
    const { form, save, writes } = await setup(
      groupWith([{ id: 'A', 'api-key': 'fixture' }], [native, openapi]),
      'vertex',
    )
    form.models.reverse()
    form.models[0].name = 'renamed'
    form.models.push({
      raw: null,
      name: 'shared',
      alias: 'new',
      displayName: '',
      forceMapping: false,
    })
    await save(form)
    expect(writes[0][0].models).toEqual([
      { ...openapi, name: 'renamed' },
      native,
      { name: 'shared', alias: 'new' },
    ])
  })

  test('editing inherited headers does not change another credential or its concurrent changes', async () => {
    const keys = [
      { id: 'A', 'api-key': 'fixture-A', headers: null },
      { id: 'B', 'api-key': 'fixture-B' },
    ]
    const group = { keys, headers: { 'X-One': 'one', 'X-Two': 'two' } }
    const latestSibling = { ...keys[1], 'connection-pool': { enabled: false } }
    const { form, save, writes, setCurrent } = await setup([group], 'claude')
    form.headers[1].value = 'updated'
    setCurrent([{ ...group, keys: [keys[0], latestSibling] }])
    await save(form)
    expect(writes[0]).toEqual([
      {
        ...group,
        keys: [{ ...keys[0], headers: { 'X-One': 'one', 'X-Two': 'updated' } }, latestSibling],
      },
    ])
  })

  test('a group-only base URL change leaves siblings at their original address', async () => {
    const keys = [
      { id: 'A', 'api-key': 'fixture-A' },
      { id: 'B', 'api-key': 'fixture-B' },
    ]
    const group = { keys, 'base-url': 'https://old.test', 'connection-pool': {} }
    const { form, save, writes } = await setup([group], 'xai')
    form.baseUrl = 'https://new.test'
    await save(form)
    expect(writes[0]).toEqual([
      { ...group, keys: [keys[1]] },
      { ...group, keys: [keys[0]], 'base-url': 'https://new.test' },
    ])
  })

  test('clearing an inherited exclusion list retains the disabled marker', async () => {
    const { form, save, writes } = await setup(
      [{ 'excluded-models': ['*', 'old'], keys: [{ id: 'A', 'api-key': 'fixture' }, { id: 'B' }] }],
      'claude',
    )
    form.excludedModelsText = ''
    await save(form)
    expect(writes[0][0]['excluded-models']).toEqual(['*', 'old'])
    expect(writes[0][0].keys[0]['excluded-models']).toEqual(['*'])
  })

  test('a changed target, ambiguous identity or deleted native key never writes a family', async () => {
    const group = { keys: [{ id: 'A', 'api-key': 'fixture' }] }
    const { form, save, writes, setCurrent } = await setup([group], 'vertex')
    form.prefix = 'draft'
    for (const current of [[{ ...group, 'connection-pool': {} }], [group, group], []]) {
      setCurrent(current)
      await expect(save(form)).rejects.toThrow()
    }
    expect(writes).toEqual([])
    expect(form.prefix).toBe('draft')
  })

  test('keeps models and errors unchanged within a modified list', async () => {
    const rule = { status: 429, action: 'continue', match: [], 'future-option': false }
    const { form, save, writes } = await setup(
      [{ 'request-scoped-errors': [rule], keys: [{ id: 'A' }] }],
      'gemini',
    )
    form.requestScopedErrors![0].action = 'stop'
    await save(form)
    expect(writes[0][0]['request-scoped-errors']).toEqual([{ ...rule, action: 'stop' }])
  })
})
