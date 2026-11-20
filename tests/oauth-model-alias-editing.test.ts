import axios, { type AxiosAdapter, AxiosError } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  applyConfigChange,
  hasOAuthChannelConflict,
  normalizeConfigValues,
} from '../src/lib/api/management/config'
import { ConfigEditConflict } from '../src/lib/api/management/config-edit'
import {
  canEditAliasRule,
  hasIncompleteAliasChanges,
  normalizeModelAliasRule,
  serializeModelAliasRule,
} from '../src/lib/api/management/oauth-model-aliases'
import {
  canEditModelSetting,
  editModelSetting,
  hasInvalidModelSettingChanges,
} from '../src/lib/api/management/oauth-model-settings'

const session = { baseUrl: 'http://aliases.test', managementKey: 'fixture' }
const original = axios.defaults.adapter
afterEach(() => {
  axios.defaults.adapter = original
})
type AliasMap = Record<string, unknown>
const change = (before: AliasMap, after: AliasMap) => ({
  key: 'oauthModelAliasJson' as const,
  previousValue: JSON.stringify(before),
  nextValue: JSON.stringify(after),
})
function fixture(initial: AliasMap, basePath = '/config/oauth/model-alias/') {
  const saved = structuredClone(initial)
  const requests: string[] = []
  const faults = new Map<string, number>()
  const adapter: AxiosAdapter = async (config) => {
    const method = config.method!.toUpperCase()
    const path = config.url!
    requests.push(method + ' ' + path)
    const channel = decodeURIComponent(path.replace(basePath, ''))
    const status =
      faults.get(method + ' ' + channel) ??
      (method === 'GET' && !Object.hasOwn(saved, channel) ? 404 : 200)
    const response = {
      data: status === 404 ? { error: 'not_found' } : saved[channel],
      config,
      status,
      statusText: String(status),
      headers: {},
    }
    if (status !== 200) throw new AxiosError('test error', undefined, config, undefined, response)
    if (method === 'PUT') saved[channel] = JSON.parse(config.data)
    if (method === 'DELETE') delete saved[channel]
    return response
  }
  axios.defaults.adapter = adapter
  return { saved, requests, faults }
}
const first = {
  name: 'model',
  alias: 'native',
  openapi: false,
  fork: false,
  'force-mapping': false,
  future: { preserve: null },
}
const second = { name: 'model', alias: 'compat', openapi: true }
const previous = {
  claude: [{ name: 'upstream', alias: 'client' }],
  vertex: [first, second],
  plugin: { futureShape: true },
}

describe('provider-scoped OAuth model settings', () => {
  const path = '/config/oauth/settings/'
  const settingsChange = (before: AliasMap, after: AliasMap) => ({
    ...change(before, after),
    key: 'oauthModelSettingsJson' as const,
  })
  const named = { name: 'shared', 'max-context-length': 262144 }
  const aliased = { name: 'shared', alias: 'public', 'max-context-length': 524288 }
  const native = {
    name: 'model',
    openapi: false,
    'max-context-length': null,
    extra: { retain: false },
  }
  const openapi = { name: 'model', alias: 'chat', openapi: true, 'max-context-length': 0 }

  test('read and write use the OAuth provider subtree even when an API key has the same model and alias', async () => {
    const before = { codex: [named, aliased], vertex: [native, openapi] }
    const apiKeys = {
      codex: [{ models: [{ ...aliased, 'max-context-length': 8192 }], keys: [{ id: 'fixture' }] }],
    }
    const structured = normalizeConfigValues({ oauth: { settings: before }, 'api-keys': apiKeys })
    expect(JSON.parse(String(structured.oauthModelSettingsJson))).toEqual(before)
    const { saved, requests } = fixture(before, path)
    const updated = editModelSetting(aliased, { contextLength: '1000000' })
    await applyConfigChange(session, settingsChange(before, { ...before, codex: [named, updated] }))
    expect(saved).toEqual({
      ...before,
      codex: [named, { ...aliased, 'max-context-length': 1000000 }],
    })
    expect(requests).toEqual(['GET ' + path + 'codex', 'PUT ' + path + 'codex'])
  })

  test('keeps automatic, native and OpenAPI distinct, including null, omitted, zero and extensions', async () => {
    const opaque = { name: 'future', openapi: { mode: 7 } }
    const before = { vertex: [native, openapi, opaque], claude: [{ name: 'other' }] }
    const { saved, requests } = fixture(before, path)
    expect(canEditModelSetting(opaque, 'vertex')).toBe(false)
    const automatic = editModelSetting(openapi, { openapi: null, alias: '', contextLength: '' })
    const renamed = editModelSetting(native, { name: 'renamed' })
    expect(automatic).toEqual({ name: 'model' })
    expect(renamed).toEqual({ ...native, name: 'renamed' })
    const after = { ...before, vertex: [renamed, automatic, opaque] }
    await applyConfigChange(session, settingsChange(before, after))
    expect(saved).toEqual(after)
    expect(requests).toEqual(['GET ' + path + 'vertex', 'PUT ' + path + 'vertex'])
    expect(editModelSetting(automatic, { openapi: false, contextLength: '0' })).toEqual({
      name: 'model',
      openapi: false,
      'max-context-length': 0,
    })
    expect(editModelSetting({ name: 'x', openapi: null }, { alias: 'y' }).openapi).toBeNull()
  })

  test('only complete changed rows can be written, with lossless nonnegative integer limits', async () => {
    const before = { codex: [named], future: { mode: 'unknown' } }
    const { requests } = fixture(before, path)
    for (const text of ['-1', '2.5', '1e3', 'invalid', '9007199254740993']) {
      const next = editModelSetting(named, { contextLength: text })
      expect(next['max-context-length']).toBe(text)
      const after = { ...before, codex: [next] }
      expect(hasInvalidModelSettingChanges(before, after)).toBe(true)
      await expect(applyConfigChange(session, settingsChange(before, after))).rejects.toThrow()
    }
    expect(
      hasInvalidModelSettingChanges(before, { ...before, codex: [{ name: ' ', alias: 'x' }] }),
    ).toBe(true)
    expect(hasInvalidModelSettingChanges(before, { ...before, codex: [{ name: 'x' }] })).toBe(false)
    expect(requests).toEqual([])
  })

  test('an existing blank row does not allow a newly added blank row to be saved', async () => {
    const blank = { name: '' }
    const before = { codex: [blank, named] }
    const { requests } = fixture(before, path)
    expect(hasInvalidModelSettingChanges(before, { codex: [aliased, blank] })).toBe(false)
    const after = { codex: [...before.codex, { name: '' }] }
    expect(hasInvalidModelSettingChanges(before, after)).toBe(true)
    await expect(applyConfigChange(session, settingsChange(before, after))).rejects.toThrow()
    expect(requests).toEqual([])
  })

  test('adding a provider and removing its last row are isolated and idempotent', async () => {
    const before = { codex: [named] }
    const after = { ...before, devin: [{ name: 'shared', 'max-context-length': 16384 }] }
    const { saved, requests } = fixture(before, path)
    await applyConfigChange(session, settingsChange(before, after))
    await applyConfigChange(session, settingsChange(after, before))
    await applyConfigChange(session, settingsChange(after, before))
    expect(saved).toEqual(before)
    expect(requests).toEqual([
      'GET ' + path + 'devin',
      'PUT ' + path + 'devin',
      'GET ' + path + 'devin',
      'DELETE ' + path + 'devin',
      'GET ' + path + 'devin',
    ])
  })

  test('first write through an explicitly null parent merges only the requested provider', async () => {
    const row = { name: 'first', openapi: false }
    for (const oauth of [
      null,
      { 'model-alias': { vertex: [] }, settings: null },
      { settings: 'future' },
    ]) {
      const patches: unknown[] = []
      axios.defaults.adapter = async (config) => {
        const missing = config.method === 'get' && config.url === path + 'vertex'
        const invalidPath = config.method === 'put'
        const status = missing ? 404 : invalidPath ? 400 : 200
        const data = missing
          ? { error: 'not_found' }
          : invalidPath
            ? { error: 'invalid_path' }
            : oauth
        const response = { config, status, data, statusText: String(status), headers: {} }
        if (status !== 200) throw new AxiosError('fixture', undefined, config, undefined, response)
        expect(config.url).toBe('/config/oauth')
        if (config.method === 'patch') patches.push(JSON.parse(config.data))
        return response
      }
      const save = applyConfigChange(session, settingsChange({}, { vertex: [row] }))
      if (oauth && oauth.settings !== null) {
        await expect(save).rejects.toThrow()
        expect(patches).toEqual([])
      } else {
        await save
        expect(patches).toEqual([{ settings: { vertex: [row] } }])
      }
    }
  })

  test('parallel provider changes survive and concurrent edits to a selected provider block the write', async () => {
    const before = { codex: [named], vertex: [native, openapi] }
    const after = { ...before, codex: [aliased] }
    const remote = { ...before, vertex: [openapi] }
    const { saved, requests } = fixture(remote, path)
    expect(hasOAuthChannelConflict(settingsChange(before, after), '[]')).toBe(true)
    expect(hasOAuthChannelConflict(settingsChange(before, after), JSON.stringify(remote))).toBe(
      false,
    )
    await applyConfigChange(session, settingsChange(before, after))
    expect(saved).toEqual({ ...after, vertex: [openapi] })
    const conflict = { ...before, codex: [{ name: 'another' }] }
    expect(hasOAuthChannelConflict(settingsChange(before, after), JSON.stringify(conflict))).toBe(
      true,
    )
    Object.assign(saved, conflict)
    requests.length = 0
    await expect(applyConfigChange(session, settingsChange(before, after))).rejects.toBeInstanceOf(
      ConfigEditConflict,
    )
    expect(requests).toEqual(['GET ' + path + 'codex'])
  })
})

describe('provider-scoped OAuth model aliases', () => {
  test('editing an ordinary channel with Vertex rules and an unfamiliar channel only writes the ordinary channel', async () => {
    const { saved, requests } = fixture(previous)
    const next = { ...previous, claude: [{ name: 'upstream', alias: 'new' }] }
    await applyConfigChange(session, change(previous, next))
    expect(requests).toEqual([
      'GET /config/oauth/model-alias/claude',
      'PUT /config/oauth/model-alias/claude',
    ])
    expect(saved).toEqual(next)
  })
  test('renaming a Vertex row preserves explicit false, unknown fields and sibling protocol', async () => {
    const { saved, requests } = fixture(previous)
    const next = {
      ...previous,
      vertex: [serializeModelAliasRule({ alias: 'renamed' }, first), second],
    }
    await applyConfigChange(session, change(previous, next))
    expect(saved.vertex).toEqual([{ ...first, alias: 'renamed' }, second])
    expect(requests).toEqual([
      'GET /config/oauth/model-alias/vertex',
      'PUT /config/oauth/model-alias/vertex',
    ])
  })
  test('automatic, native and OpenAPI are distinct and an untouched null stays null', () => {
    for (const openapi of [true, false, null]) {
      expect(normalizeModelAliasRule({ ...first, openapi }).openapi).toBe(openapi)
      expect(serializeModelAliasRule({ alias: 'edit' }, { ...first, openapi }).openapi).toBe(
        openapi,
      )
    }
    expect(serializeModelAliasRule({ openapi: null }, first)).not.toHaveProperty('openapi')
    expect(serializeModelAliasRule({ openapi: false }, second).openapi).toBe(false)
    expect(serializeModelAliasRule({ openapi: true }, first).openapi).toBe(true)
    expect(serializeModelAliasRule({ forceMapping: false })).toEqual({ 'force-mapping': false })
  })
  test('scope conflicts to channels the operator changed and preflight before writing', async () => {
    const next = { ...previous, claude: [{ name: 'upstream', alias: 'new' }], vertex: [second] }
    const remote = { ...previous, vertex: [first] }
    const { requests } = fixture(remote)
    expect(hasOAuthChannelConflict(change(previous, next), JSON.stringify(remote))).toBe(true)
    expect(
      hasOAuthChannelConflict(
        change(previous, { ...previous, claude: next.claude }),
        JSON.stringify(remote),
      ),
    ).toBe(false)
    await expect(applyConfigChange(session, change(previous, next))).rejects.toBeInstanceOf(
      ConfigEditConflict,
    )
    expect(requests.every((request) => request.startsWith('GET '))).toBe(true)
  })
  test('a retry skips an already saved destination and deletes only the requested source', async () => {
    const before = { claude: previous.claude, vertex: previous.vertex }
    const after = { 'custom-auth': previous.claude, vertex: previous.vertex }
    const { requests, saved, faults } = fixture(before)
    faults.set('DELETE claude', 503)
    await expect(applyConfigChange(session, change(before, after))).rejects.toThrow()
    expect(saved['custom-auth']).toEqual(previous.claude)
    expect(saved.claude).toEqual(previous.claude)
    faults.clear()
    await applyConfigChange(session, change(before, after))
    expect(saved).toEqual(after)
    expect(requests.filter((request) => request.startsWith('PUT'))).toEqual([
      'PUT /config/oauth/model-alias/custom-auth',
    ])
  })
  test('only new or edited rows need valid names; an unreadable channel remains intact', async () => {
    const unsupportedRow = { name: 12, alias: 'unknown' }
    const before = { vertex: [unsupportedRow, second], custom: false }
    const after = { ...before, vertex: [unsupportedRow, { ...second, alias: 'new' }] }
    expect(canEditAliasRule(unsupportedRow, 'vertex')).toBe(false)
    expect(hasIncompleteAliasChanges(before, after)).toBe(false)
    expect(
      hasIncompleteAliasChanges(before, {
        ...before,
        vertex: [...before.vertex, { name: '', alias: 'draft' }],
      }),
    ).toBe(true)
    const { saved } = fixture(before)
    await applyConfigChange(session, change(before, after))
    expect(saved).toEqual(after)
  })
  test('an unreadable server response is never interpreted as a missing provider', async () => {
    const { requests, faults } = fixture(previous)
    faults.set('GET vertex', 403)
    await expect(
      applyConfigChange(session, change(previous, { ...previous, vertex: [first] })),
    ).rejects.toThrow()
    expect(requests).toEqual(['GET /config/oauth/model-alias/vertex'])
  })
})
