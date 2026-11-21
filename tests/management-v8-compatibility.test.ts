import axios, { AxiosError } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { reconcileSavedConfigFields } from '../src/features/config/config-workbench-page'
import { fetchAntigravityPauseStatus } from '../src/lib/api/management/antigravity-pause-window'
import { toManagementApiError } from '../src/lib/api/management/client'
import {
  type ConfigChange,
  applyConfigChanges,
  fetchConfigSnapshot,
  normalizeConfigValues,
  parseCodexCacheTtl,
} from '../src/lib/api/management/config'
import { fetchPluginConfig } from '../src/lib/api/management/plugin-store'
import { probeManagementRuntime } from '../src/lib/api/management/probe'
import { fetchProviderSnapshot } from '../src/lib/api/management/providers'

const session = { baseUrl: 'https://home.test/tenant/v8/management', managementKey: 'fixture' }
const v8 = '/tenant/v8/management/'
const pauseEndpoint = v8 + 'routing/antigravity/tos-pause'
const legacy = '/tenant/v0/management/debug'
const originalAdapter = axios.defaults.adapter
afterEach(() => {
  axios.defaults.adapter = originalAdapter
})

type Reply = { status: number; data: unknown; headers?: Record<string, string> }
const missingRoute: Reply = { status: 404, data: '404 page not found' }
const missingValue: Reply = { status: 404, data: { error: 'not_found' } }
const ok = (data: unknown): Reply => ({ status: 200, data })
function serve(reply: (path: string, method: string, body: unknown) => Reply) {
  const requests: string[] = []
  axios.defaults.adapter = async (config) => {
    const url = new URL(axios.getUri(config))
    expect(url.origin).toBe('https://home.test')
    const method = config.method!.toUpperCase()
    requests.push(method + ' ' + url.pathname)
    const result = reply(url.pathname, method, config.data)
    const response = { headers: {}, statusText: String(result.status), config, ...result }
    if (config.validateStatus && !config.validateStatus(result.status)) {
      throw new AxiosError('HTTP ' + result.status, undefined, config, undefined, response)
    }
    return response
  }
  return requests
}

describe('management login and capability detection', () => {
  test.each([
    ['disabled routes', missingRoute, 'management-route-unavailable'],
    ['unrelated HTML site', ok('<html>login</html>'), 'management-route-unavailable'],
    ['unrelated JSON', ok({ status: 'ok' }), 'management-route-unavailable'],
    [
      'generic proxy authentication',
      { status: 401, data: { error: 'unauthorized' } },
      'management-route-unavailable',
    ],
    ['legacy management scalar', ok({ debug: false }), 'unsupported-api-version'],
    [
      'identified legacy auth error',
      {
        status: 403,
        data: { error: 'remote management disabled' },
        headers: { 'x-cpa-home-version': 'old' },
      },
      'unsupported-api-version',
    ],
  ] as const)('distinguishes %s on a V8 404', async (_, reply, backendCode) => {
    const requests = serve((path) => (path === legacy ? reply : missingRoute))
    await expect(probeManagementRuntime(session)).rejects.toMatchObject({ backendCode })
    expect(requests).toEqual(['GET ' + v8 + 'config', 'GET ' + legacy])
  })

  test.each([ok('<html>app</html>'), ok({}), ok({ 'config-version': '8' })])(
    'rejects an unexpected V8 response without diagnosing a legacy backend',
    async (reply) => {
      const requests = serve(() => reply)
      await expect(probeManagementRuntime(session)).rejects.toMatchObject({
        backendCode: 'unexpected-management-response',
      })
      expect(requests).toEqual(['GET ' + v8 + 'config'])
    },
  )

  test('reports the explicit incompatible config version', async () => {
    serve(() => ok({ 'config-version': 9 }))
    await expect(probeManagementRuntime(session)).rejects.toMatchObject({
      backendCode: 'incompatible-config-version',
      configVersion: 9,
    })
  })

  test.each([401, 403, 500])('preserves HTTP %i from the V8 config endpoint', async (status) => {
    const requests = serve(() => ({ status, data: { error: 'backend_error' } }))
    const error = await probeManagementRuntime(session).catch(toManagementApiError)
    expect(error).toMatchObject({ status, backendCode: 'backend_error' })
    expect(requests).toEqual(['GET ' + v8 + 'config'])
  })

  test('uses explicit capability declarations and probes omitted flags on a partial manifest', async () => {
    const requests = serve((path) => {
      if (path === v8 + 'config') return ok({ 'config-version': 8 })
      if (path === v8 + 'capabilities')
        return ok({
          capabilities: {
            usage_records: false,
            access_groups: true,
            antigravity_tos_pause_status: true,
          },
        })
      if (path === v8 + 'quota/credentials') return ok({ items: [] })
      return missingRoute
    })
    const { capabilities } = await probeManagementRuntime(session)
    expect(capabilities).toMatchObject({
      usageRecords: false,
      accessGroups: true,
      quotaSnapshots: true,
      antigravityTosPauseStatus: true,
    })
    expect(requests).not.toContain('GET ' + v8 + 'usage/records')
    expect(requests).not.toContain('GET ' + v8 + 'channel-groups')
    expect(requests).toContain('GET ' + v8 + 'quota/credentials')
    expect(requests).not.toContain('GET ' + pauseEndpoint)
  })

  test('an older V8 can log in without capabilities and probes only establish usable features', async () => {
    const requests = serve((path) => {
      if (path === v8 + 'config') return ok({ 'config-version': 8 })
      if (path === v8 + 'topology') return { status: 503, data: {} }
      if (path === v8 + 'nodes') return ok('<html>web app</html>')
      if (path === v8 + 'users') return { status: 403, data: { error: 'forbidden' } }
      if (path === v8 + 'users/0/period-limits')
        return { status: 400, data: { error: 'invalid id' } }
      if (path === v8 + 'channel-groups') return ok([])
      return missingRoute
    })
    expect((await probeManagementRuntime(session)).capabilities).toMatchObject({
      nodes: false,
      topology: false,
      users: false,
      userPeriodLimits: true,
      antigravityTosPauseStatus: false,
      accessGroups: true,
    })
    expect(requests).not.toContain('GET ' + legacy)
    expect(requests).not.toContain('GET ' + pauseEndpoint)
  })
})

describe('Antigravity pool pause observations', () => {
  const observed = '2026-11-20T01:00:00.123456789Z'
  const resume = '2026-11-20T10:15:00+08:00'
  test('reads active and idle observations using the Home clock', async () => {
    let deadline: string | null = resume
    const requests = serve(() =>
      ok({ paused: deadline !== null, resume_at: deadline, observed_at: observed }),
    )
    expect(await fetchAntigravityPauseStatus(session)).toEqual({
      observedAt: Date.parse(observed),
      resumeAt: Date.parse(resume),
    })
    deadline = null
    expect(await fetchAntigravityPauseStatus(session)).toEqual({
      observedAt: Date.parse(observed),
      resumeAt: null,
    })
    expect(requests).toEqual(['GET ' + pauseEndpoint, 'GET ' + pauseEndpoint])
  })

  test.each([404, 405, 501])('handles HTTP %i as an unavailable route', async (status) => {
    serve(() => ({ status, data: {} }))
    expect(await fetchAntigravityPauseStatus(session)).toBeNull()
  })

  test.each([401, 403, 503])('keeps HTTP %i distinct from an idle observation', async (status) => {
    serve(() => ({ status, data: {} }))
    await expect(fetchAntigravityPauseStatus(session)).rejects.toThrow()
  })

  test.each([
    { paused: true, resume_at: null, observed_at: observed },
    { paused: true, resume_at: '2026-11-20T00:59:59Z', observed_at: observed },
    { paused: false, resume_at: resume, observed_at: observed },
    { paused: false, observed_at: observed },
    { paused: false, resume_at: null, observed_at: '2026-11-20T01:00:00' },
  ])('rejects a contradictory or incomplete observation %j', async (data) => {
    serve(() => ok(data))
    await expect(fetchAntigravityPauseStatus(session)).rejects.toThrow()
  })
})

const debug: ConfigChange = { key: 'debug', previousValue: false, nextValue: true }
const steering: ConfigChange = {
  key: 'upstreamCodexResponseSteering',
  previousValue: false,
  nextValue: true,
}
const retry: ConfigChange = { key: 'requestRetry', previousValue: 0, nextValue: 1 }

describe('optional V8 fields and writes', () => {
  test('reads Claude execution settings from their owning scopes, including empty and explicit values', () => {
    const raw = {
      client: { claude: { 'show-codex-commentary': false } },
      upstream: {
        claude: {
          'session-date-pin-days': 0,
          'server-side-fallback': false,
          'header-defaults': {
            'native-entrypoints': [],
            'anthropic-beta-append': null,
            'anthropic-beta-strip': ['Beta', 'beta', 'Beta'],
            'inject-diagnostics': false,
            'client-request-id': ' OFF ',
          },
        },
      },
    }
    const fields = {
      clientClaudeShowCodexCommentary: false,
      upstreamClaudeServerSideFallback: false,
      upstreamClaudeSessionDatePinDays: 0,
      upstreamClaudeNativeEntrypointsJson: '[]',
      upstreamClaudeAnthropicBetaAppendJson: 'null',
      upstreamClaudeAnthropicBetaStripJson: JSON.stringify(['Beta', 'beta', 'Beta'], null, 2),
      upstreamClaudeInjectDiagnostics: false,
      upstreamClaudeClientRequestId: 'off',
    }
    expect(normalizeConfigValues(raw)).toMatchObject(fields)
    const missing = normalizeConfigValues({ client: raw.upstream, upstream: raw.client })
    for (const key of Object.keys(fields) as (keyof typeof fields)[])
      expect(missing[key]).toBeNull()
    for (const saved of ['future-mode', false]) {
      expect(
        normalizeConfigValues({
          upstream: { claude: { 'header-defaults': { 'client-request-id': saved } } },
        }).upstreamClaudeClientRequestId,
      ).toBe(saved)
    }
  })

  test.each([
    ['upstreamClaudeNativeEntrypointsJson', 'native-entrypoints'],
    ['upstreamClaudeAnthropicBetaStripJson', 'anthropic-beta-strip'],
    ['upstreamClaudeAnthropicBetaAppendJson', 'anthropic-beta-append'],
  ] as const)(
    '%s preserves order, detects intervening edits and deletes only its own leaf',
    async (key, leaf) => {
      const path = v8 + 'config/upstream/claude/header-defaults/' + leaf
      let stored: unknown = null
      const requests = serve((url, method, body) => {
        expect(url).toBe(path)
        if (method === 'GET') return stored === undefined ? missingValue : ok(stored)
        if (method === 'PUT') stored = JSON.parse(String(body))
        else if (method === 'DELETE') stored = undefined
        else throw new Error('Unexpected method')
        return ok({ status: 'ok' })
      })
      const save = (previousValue: string | null, nextValue: string | null) =>
        applyConfigChanges(session, [{ key, previousValue, nextValue }])
      const names = ['Flag-B', ' flag-A ', 'Flag-B']
      await expect(save(null, '[]')).rejects.toMatchObject({ reason: 'conflict' })
      await save('null', '[]')
      expect(stored).toEqual([])
      await save('[]', JSON.stringify(names))
      await save('[]', JSON.stringify(names))
      expect(stored).toEqual(names)
      const concurrent = [' flag-A ', 'Flag-B', 'Flag-B']
      stored = concurrent
      await expect(save(JSON.stringify(names), null)).rejects.toMatchObject({
        key,
        reason: 'conflict',
      })
      await save(JSON.stringify(concurrent), null)
      await save(JSON.stringify(concurrent), null)
      expect(stored).toBeUndefined()
      expect(requests.filter((request) => !request.startsWith('GET '))).toEqual([
        'PUT ' + path,
        'PUT ' + path,
        'DELETE ' + path,
      ])
      serve(() => missingRoute)
      await expect(save(null, '[]')).rejects.toMatchObject({ reason: 'unavailable' })
    },
  )

  test('Codex settings use their own V8 trees and distinguish missing, zero and false', () => {
    const empty = normalizeConfigValues({ client: { codex: { 'web-search-result-cache': null } } })
    expect(empty).toMatchObject({
      clientCodexEnableApplyPatch: null,
      clientCodexWebSearchCacheEnabled: null,
      clientCodexWebSearchCacheTtl: null,
      clientCodexWebSearchCacheLimit: null,
      upstreamCodexRequestCompression: null,
      upstreamCodexRequestCompressionMinBytes: null,
      upstreamCodexWebsocketCompression: null,
      oauthCodexSigninIdentifier: null,
    })
    for (const ttl of [0, '0', 1800, '1800', '1h30m']) {
      expect(
        normalizeConfigValues({
          client: {
            codex: {
              'enable-apply-patch': false,
              'web-search-result-cache': { enabled: false, ttl, limit: 0 },
            },
          },
          upstream: {
            codex: {
              'upstream-request-compression': false,
              'upstream-request-compression-min-bytes': 0,
              'websocket-compression': false,
            },
          },
          oauth: {
            providers: {
              codex: {
                'signin-with-chatgpt-identifier': 'node-client',
                'enable-apply-patch': true,
                'websocket-compression': true,
              },
            },
          },
        }),
      ).toMatchObject({
        clientCodexEnableApplyPatch: false,
        clientCodexWebSearchCacheEnabled: false,
        clientCodexWebSearchCacheTtl: ttl,
        clientCodexWebSearchCacheLimit: 0,
        upstreamCodexRequestCompression: false,
        upstreamCodexRequestCompressionMinBytes: 0,
        upstreamCodexWebsocketCompression: false,
        oauthCodexSigninIdentifier: 'node-client',
      })
    }
  })

  test('Codex cache TTL follows Home duration and integer-seconds bounds', () => {
    expect(parseCodexCacheTtl('')).toBeNull()
    expect(parseCodexCacheTtl('+1800')).toBe(1800)
    expect(parseCodexCacheTtl('9223372036')).toBe(9223372036)
    for (const value of ['0s', '1h30m', '.5s', '1μs', '9223372036854775807ns'])
      expect(parseCodexCacheTtl(value)).toBe(value)
    for (const invalid of ['1d', '-1', '-1ms', '1.5', '9223372037', '9223372036854775808ns'])
      expect(parseCodexCacheTtl(invalid)).toBeUndefined()
  })

  test('CPA server values distinguish absence from explicit zero and false', () => {
    const fields = {
      serverMaxRequestBodyBytes: null,
      serverResponseCompressionEnabled: null,
      serverResponseCompressionMinBytes: null,
      serverShutdownTimeout: null,
      serverGithubToken: null,
    }
    expect(normalizeConfigValues({})).toMatchObject(fields)
    expect(
      normalizeConfigValues({
        server: {
          'max-request-body-bytes': 0,
          'response-compression': { enabled: false, 'min-bytes': 0 },
          'shutdown-timeout': 0,
          'github-token': '',
        },
      }),
    ).toMatchObject({
      serverMaxRequestBodyBytes: 0,
      serverResponseCompressionEnabled: false,
      serverResponseCompressionMinBytes: 0,
      serverShutdownTimeout: 0,
      serverGithubToken: null,
    })
  })

  test('token writes preserve the old value on conflict and retries are idempotent', async () => {
    const path = v8 + 'config/server/github-token'
    let stored: string | null = null
    const requests = serve((url, method, body) => {
      expect(url).toBe(path)
      if (method === 'GET') return stored === null ? missingValue : ok(JSON.stringify(stored))
      if (method === 'PUT') stored = JSON.parse(String(body))
      else if (method === 'DELETE') stored = null
      else throw new Error('Unexpected secret operation')
      return ok({ status: 'ok' })
    })
    const save = (previousValue: string | null, nextValue: string | null) =>
      applyConfigChanges(session, [{ key: 'serverGithubToken', previousValue, nextValue }])
    await save(null, 'true')
    expect(stored).toBe('true')
    await save('true', '  next-token  ')
    await save('true', 'next-token')
    await save('next-token', '')
    expect(stored).toBe('next-token')
    await expect(save('true', null)).rejects.toMatchObject({
      key: 'serverGithubToken',
      reason: 'conflict',
    })
    expect(stored).toBe('next-token')
    await save('next-token', null)
    await save('next-token', null)
    expect(stored).toBeNull()
    expect(requests.filter((request) => !request.startsWith('GET '))).toEqual([
      'PUT ' + path,
      'PUT ' + path,
      'DELETE ' + path,
    ])
  })

  test.each([false, true])(
    'keeps the subagent override distinct when main affinity is %s',
    (parent) => {
      const routing = { 'session-affinity': parent }
      expect(normalizeConfigValues({ routing }).sessionAffinitySubagents).toBeNull()
      for (const value of [null, false, true]) {
        expect(
          normalizeConfigValues({ routing: { ...routing, 'session-affinity-subagents': value } }),
        ).toMatchObject({
          sessionAffinity: parent,
          sessionAffinitySubagents: value,
        })
      }
    },
  )

  test('a partial save accepts normalized server values and preserves failed and unattempted drafts', () => {
    const structured = normalizeConfigValues({})
    const before = {
      baseline: { structured, rawConfig: {}, fetchedAt: '0' },
      values: {
        ...structured,
        proxyUrl: ' https://example.test ',
        upstreamCodexResponseSteering: true,
        requestRetry: 7,
      },
    }
    const confirmed = { ...structured, proxyUrl: 'https://example.test' }
    const saved = reconcileSavedConfigFields(before, ['proxyUrl'], confirmed)!
    expect(saved.baseline.structured.proxyUrl).toBe(confirmed.proxyUrl)
    expect(saved.values).toMatchObject({
      proxyUrl: confirmed.proxyUrl,
      upstreamCodexResponseSteering: true,
      requestRetry: 7,
    })
    const discard = reconcileSavedConfigFields(saved, ['upstreamCodexResponseSteering'], confirmed)!
    expect(discard.values.upstreamCodexResponseSteering).toBe(
      confirmed.upstreamCodexResponseSteering,
    )
    expect(discard.values.requestRetry).toBe(7)
    expect(before.baseline.structured).toBe(structured)
    expect(before.values.proxyUrl).toBe(' https://example.test ')
  })

  test('first-time configuration accepts an omitted setting and preserves an explicit false', async () => {
    const leaf = v8 + 'config/upstream/codex/response-steering'
    let value: boolean | undefined
    const requests = serve((path, method, body) => {
      if (path === v8 + 'config' && method === 'GET') {
        return ok({
          'config-version': 8,
          ...(value === undefined ? {} : { upstream: { codex: { 'response-steering': value } } }),
        })
      }
      if (path === leaf && method === 'PUT') {
        value = JSON.parse(String(body))
        return ok({ status: 'ok' })
      }
      return missingRoute
    })

    const initial = await fetchConfigSnapshot(session)
    expect(initial.rawConfig).toEqual({ 'config-version': 8 })
    expect(initial.structured.upstreamCodexResponseSteering).toBe(false)
    for (const nextValue of [true, false]) {
      await applyConfigChanges(session, [{ ...steering, previousValue: !nextValue, nextValue }])
      const saved = await fetchConfigSnapshot(session)
      expect(saved.rawConfig.upstream).toEqual({ codex: { 'response-steering': nextValue } })
    }
    expect(requests).toEqual([
      'GET ' + v8 + 'config',
      'PUT ' + leaf,
      'GET ' + v8 + 'config',
      'PUT ' + leaf,
      'GET ' + v8 + 'config',
    ])
  })

  test.each([
    [missingRoute, 'unavailable'],
    [{ status: 405, data: '' }, 'unavailable'],
    [
      {
        status: 400,
        data: {
          error: 'invalid_config',
          message: 'unknown configuration field codex.response-steering',
        },
      },
      'unsupported',
    ],
    [
      {
        status: 400,
        data: {
          error: 'invalid_config',
          message:
            'yaml: unmarshal errors:\n  line 5: field response-steering not found in type config.SDKConfig',
        },
      },
      'unsupported',
    ],
    [
      { status: 422, data: { error: 'invalid_config', message: 'value must be an integer' } },
      'rejected',
    ],
    [{ status: 403, data: { error: 'forbidden' } }, 'failed'],
    [{ status: 503, data: {} }, 'failed'],
  ] as const)('reports only the failed setting and completed writes', async (reply, reason) => {
    const requests = serve((path) =>
      path.endsWith('response-steering') ? reply : ok({ status: 'ok' }),
    )
    await expect(applyConfigChanges(session, [debug, steering, retry])).rejects.toMatchObject({
      key: steering.key,
      reason,
      savedKeys: ['debug'],
    })
    expect(requests).toEqual([
      'PUT ' + v8 + 'config/observability/logs/debug',
      'PUT ' + v8 + 'config/upstream/codex/response-steering',
    ])
  })

  test('clearing an already absent optional value succeeds only for the Home not_found response', async () => {
    const clear: ConfigChange = {
      key: 'proxyUrl',
      previousValue: 'https://example.test',
      nextValue: '',
    }
    serve(() => missingValue)
    await applyConfigChanges(session, [clear])
    serve(() => missingRoute)
    await expect(applyConfigChanges(session, [clear])).rejects.toMatchObject({
      key: 'proxyUrl',
      reason: 'unavailable',
    })
  })

  test('allows the first alias for an empty provider and stops before writing to a missing route', async () => {
    const add: ConfigChange = {
      key: 'oauthModelAliasJson',
      previousValue: '{}',
      nextValue: JSON.stringify({ vertex: [{ name: 'm', alias: 'alias' }] }),
    }
    let requests = serve((_, method) => (method === 'GET' ? missingValue : ok({ status: 'ok' })))
    await applyConfigChanges(session, [add])
    const path = v8 + 'config/oauth/model-alias/vertex'
    expect(requests).toEqual(['GET ' + path, 'PUT ' + path])
    requests = serve(() => missingRoute)
    await expect(applyConfigChanges(session, [add])).rejects.toMatchObject({
      key: add.key,
      reason: 'unavailable',
    })
    expect(requests).toEqual(['GET ' + path])
  })

  test('provider and plugin reads separate empty configuration from unavailable routes', async () => {
    serve((path) => (path.endsWith('/meta') ? missingRoute : missingValue))
    const providers = await fetchProviderSnapshot(session, 'home-standalone')
    expect(providers.issues).toMatchObject([{ providerId: 'meta', kind: 'unsupported' }])
    expect(await fetchPluginConfig(session, 'fixture')).toEqual({})
    serve(() => missingRoute)
    await expect(fetchPluginConfig(session, 'fixture')).rejects.toThrow()
  })
})
