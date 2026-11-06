import axios, { type AxiosAdapter } from 'axios'
import { afterEach, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  fetchProviderDiscoveredModels,
  fetchProviderSnapshot,
  getProviderBindingAuthId,
  testProviderConnectivity,
} from '../src/lib/api/management/providers'

const originalAdapter = axios.defaults.adapter
const session = { baseUrl: 'http://management.test', managementKey: 'synthetic-key' }

afterEach(() => {
  axios.defaults.adapter = originalAdapter
})

function mockProvider(family: string, groups: unknown[], models: unknown = []) {
  const calls: Array<Record<string, unknown>> = []
  const adapter: AxiosAdapter = async (config) => {
    const apiCall = config.url === '/requests/api-call'
    if (apiCall) calls.push(JSON.parse(config.data as string))
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: apiCall
        ? { status_code: 200, body: JSON.stringify(models) }
        : config.url?.endsWith(`/api-keys/${family}`)
          ? groups
          : [],
    }
  }
  axios.defaults.adapter = adapter
  return calls
}

for (const source of [
  { name: 'old Home', key: { id: 'home-key' }, index: 'home-key', binding: 'home-key' },
  {
    name: 'new Home',
    key: { id: 'home-key', auth_index: 'home-key' },
    index: 'home-key',
    binding: 'home-key',
  },
  { name: 'CPA', key: { auth_index: 'cpa-index' }, index: 'cpa-index', binding: 'cpa-index' },
  {
    name: 'explicit index takes precedence',
    key: { id: 'credential-id', auth_index: 'explicit-index' },
    index: 'explicit-index',
    binding: 'credential-id',
  },
  {
    name: 'UUID fallback',
    key: { uuid: 'credential-uuid' },
    index: 'credential-uuid',
    binding: 'credential-uuid',
  },
  { name: 'missing identifiers', key: {}, index: null, binding: null },
]) {
  test(`native saved credential: ${source.name}`, async () => {
    const calls = mockProvider('codex', [
      { 'base-url': 'https://models.test/v1', keys: [source.key] },
    ])
    const snapshot = await fetchProviderSnapshot(session, 'home-standalone')
    const resource = snapshot.groups.find((group) => group.id === 'codex')!.resources[0]
    expect(resource.authIndex).toBe(source.index)
    expect(getProviderBindingAuthId(resource)).toBe(source.binding)
    if (!source.index) return

    await fetchProviderDiscoveredModels(session, {
      providerId: 'codex',
      baseUrl: resource.baseUrl!,
      apiKey: '',
      authIndex: resource.authIndex,
      headers: [],
    })
    expect(calls[0]).toMatchObject({
      auth_index: source.index,
      header: { Authorization: 'Bearer $TOKEN$' },
    })
  })
}

for (const source of [
  { name: 'old Home single key', group: { keys: [{ id: 'saved-id' }] }, index: 'saved-id' },
  {
    name: 'new Home single key',
    group: { keys: [{ id: 'saved-id', auth_index: 'saved-id' }] },
    index: 'saved-id',
  },
  { name: 'CPA single key', group: { keys: [{ auth_index: 'cpa-index' }] }, index: 'cpa-index' },
  { name: 'old Home keyless group', group: { id: 'keyless-id', keys: [] }, index: 'keyless-id' },
  {
    name: 'new Home keyless group',
    group: { id: 'keyless-id', auth_index: 'keyless-id', keys: [] },
    index: 'keyless-id',
  },
  {
    name: 'multi-key group has no single binding',
    group: {
      keys: [
        { id: 'first', auth_index: 'first' },
        { id: 'second', auth_index: 'second' },
      ],
    },
    index: null,
  },
]) {
  test(`compatibility saved credential: ${source.name}`, async () => {
    mockProvider('openai-compatibility', [
      { name: 'compatible', 'base-url': 'https://models.test/v1', ...source.group },
    ])
    const snapshot = await fetchProviderSnapshot(session, 'home-standalone')
    const resource = snapshot.groups.find((group) => group.id === 'openaiCompatibility')!
      .resources[0]
    expect(resource.authIndex).toBe(source.index)
    expect(getProviderBindingAuthId(resource)).toBe(source.index)
  })
}

test('Claude connectivity uses the saved credential; Codex has no connectivity panel', async () => {
  const calls = mockProvider('claude', [{ keys: [{ id: 'claude-id' }] }])
  const snapshot = await fetchProviderSnapshot(session, 'home-standalone')
  const claude = snapshot.groups.find((group) => group.id === 'claude')!
  const codex = snapshot.groups.find((group) => group.id === 'codex')!
  expect(claude.supportsConnectivityTest).toBe(true)
  expect(codex.supportsConnectivityTest).toBe(false)
  await testProviderConnectivity(session, {
    providerId: 'claude',
    baseUrl: 'https://models.test',
    apiKey: '',
    authIndex: claude.resources[0].authIndex,
    headers: [],
    testModel: 'claude-test',
    models: [],
  })
  expect(calls[0]).toMatchObject({
    auth_index: 'claude-id',
    header: { 'x-api-key': '$TOKEN$' },
  })
})

test('catalog labels and descriptions remain separate from model IDs', async () => {
  mockProvider('codex', [], {
    data: [
      { id: 'gpt-6.1-sol', alias: 'remote-alias', display_name: 'GPT-6.1 Sol Preview' },
      { id: 'description-only', description: 'Description is not a display name' },
      { id: 'camel-name', displayName: 'Camel Name' },
      { id: 'alias-only', alias: 'Readable alias' },
      { id: 'equal-name', display_name: 'equal-name' },
    ],
  })
  expect(
    await fetchProviderDiscoveredModels(session, {
      providerId: 'codex',
      baseUrl: 'https://models.test/v1',
      apiKey: '',
      authIndex: 'saved-id',
      headers: [],
    }),
  ).toEqual([
    { name: 'gpt-6.1-sol', displayName: 'GPT-6.1 Sol Preview', description: null },
    {
      name: 'description-only',
      displayName: null,
      description: 'Description is not a display name',
    },
    { name: 'camel-name', displayName: 'Camel Name', description: null },
    { name: 'alias-only', displayName: 'Readable alias', description: null },
    { name: 'equal-name', displayName: null, description: null },
  ])
})

const fixture = fileURLToPath(new URL('./fixtures/provider-model-discovery.tsx', import.meta.url))
for (const scenario of ['import', 'claude-connectivity', 'detail-i18n']) {
  test(`provider form regression: ${scenario}`, () => {
    const result = spawnSync(process.execPath, [fixture, scenario], {
      encoding: 'utf8',
      timeout: 15_000,
    })
    expect(result.error, result.stderr).toBeUndefined()
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })
}
