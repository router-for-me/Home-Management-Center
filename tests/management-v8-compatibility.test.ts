import axios, { AxiosError } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { reconcileSavedConfigFields } from '../src/features/config/config-workbench-page'
import { toManagementApiError } from '../src/lib/api/management/client'
import {
  type ConfigChange,
  applyConfigChanges,
  fetchConfigSnapshot,
  normalizeConfigValues,
} from '../src/lib/api/management/config'
import { fetchPluginConfig } from '../src/lib/api/management/plugin-store'
import { probeManagementRuntime } from '../src/lib/api/management/probe'
import { fetchProviderSnapshot } from '../src/lib/api/management/providers'

const session = { baseUrl: 'https://home.test/tenant/v8/management', managementKey: 'fixture' }
const v8 = '/tenant/v8/management/'
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
        return ok({ capabilities: { usage_records: false, access_groups: true } })
      if (path === v8 + 'quota/credentials') return ok({ items: [] })
      return missingRoute
    })
    const { capabilities } = await probeManagementRuntime(session)
    expect(capabilities).toMatchObject({
      usageRecords: false,
      accessGroups: true,
      quotaSnapshots: true,
    })
    expect(requests).not.toContain('GET ' + v8 + 'usage/records')
    expect(requests).not.toContain('GET ' + v8 + 'channel-groups')
    expect(requests).toContain('GET ' + v8 + 'quota/credentials')
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
      accessGroups: true,
    })
    expect(requests).not.toContain('GET ' + legacy)
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
