import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { createFormState } from '../src/features/providers/providers-panel'
import {
  fetchCredentialRawMetadata,
  normalizeCredentialResource,
  updateCredentialMetadata,
} from '../src/lib/api/management/credentials'
import { fetchProviderSnapshot, updateProviderResource } from '../src/lib/api/management/providers'
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
