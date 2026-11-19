import axios, { type AxiosAdapter, AxiosError } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { applyConfigChange, hasAliasChannelConflict } from '../src/lib/api/management/config'
import { ConfigEditConflict } from '../src/lib/api/management/config-edit'
import {
  canEditAliasRule,
  hasIncompleteAliasChanges,
  normalizeModelAliasRule,
  serializeModelAliasRule,
} from '../src/lib/api/management/oauth-model-aliases'

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
function fixture(initial: AliasMap) {
  const saved = structuredClone(initial)
  const requests: string[] = []
  const faults = new Map<string, number>()
  const adapter: AxiosAdapter = async (config) => {
    const method = config.method!.toUpperCase()
    const path = config.url!
    requests.push(method + ' ' + path)
    const channel = decodeURIComponent(path.replace('/config/oauth/model-alias/', ''))
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
    expect(hasAliasChannelConflict(change(previous, next), JSON.stringify(remote))).toBe(true)
    expect(
      hasAliasChannelConflict(
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
