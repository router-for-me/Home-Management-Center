import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  canonicalConcurrencyModelKey,
  isValidConcurrencyModelKey,
  parseConcurrencyLimit,
} from '../src/features/credentials/credential-concurrency'
import {
  fetchCredentialConcurrencyPolicy,
  fetchCredentialConcurrencySnapshot,
  fetchCredentialInFlightDetail,
  fetchCredentialInFlightSummary,
  fetchCredentialSnapshot,
  mergeCredentialConcurrencySummary,
  updateCredentialMetadata,
} from '../src/lib/api/management/credentials'
import { probeManagementRuntime } from '../src/lib/api/management/probe'

const defaultAxiosAdapter = axios.defaults.adapter
const session = { baseUrl: 'http://management.test', managementKey: 'test-key' }

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config,
  }
}

function useResponse(data: unknown) {
  const adapter: AxiosAdapter = async (config) => response(config, data)
  axios.defaults.adapter = adapter
}

function observationMetadata() {
  return {
    observed_at: '2026-07-21T12:00:00Z',
    stale: false,
    coverage_complete: true,
    aggregates_complete: true,
    protocol_coverage_complete: true,
    minimum_processed_barrier_revision: 7,
    details_truncated: false,
  }
}

function observedState() {
  return {
    in_flight: 3,
    accounted: 2,
    unaccounted: 1,
    stale: false,
    coverage_complete: true,
    aggregates_complete: true,
    details_truncated: false,
  }
}

function limiterState() {
  return {
    credential_id: 'auth-1',
    max_in_flight: 4,
    admitted_in_flight: 2,
    remaining: 2,
    total_saturated: false,
    models: [
      {
        model: 'gpt-5.5',
        max_in_flight: 2,
        admitted_in_flight: 2,
        remaining: 0,
        saturated: true,
      },
      {
        model: 'gpt-5.6',
        max_in_flight: 1,
        admitted_in_flight: 0,
        remaining: 1,
        saturated: false,
      },
    ],
    policy_version: 3,
    effective_at: '2026-07-21T11:58:00Z',
    observation_barrier_revision: 7,
    fully_enforced: 'false',
    observed: observedState(),
  }
}

function observedSummary() {
  return {
    credential_id: 'auth-1',
    in_flight: 3,
    admitted_in_flight: 2,
    max_in_flight: 4,
    remaining: 2,
    total_saturated: false,
    saturated_model_count: 1,
    models: [
      {
        model: 'gpt-5.5',
        in_flight: 3,
        max_in_flight: 2,
        remaining: 0,
        saturated: true,
      },
    ],
    observed: observedState(),
    limiter: limiterState(),
  }
}

function observationOnlySummary() {
  return {
    credential_id: 'auth-1',
    in_flight: 3,
    max_in_flight: null,
    remaining: null,
    total_saturated: false,
    saturated_model_count: 0,
    models: [
      {
        model: 'gpt-5.5',
        in_flight: 3,
        max_in_flight: null,
        remaining: null,
        saturated: false,
      },
    ],
    observed: observedState(),
    limiter: null,
  }
}

describe('credential concurrency v2 contract', () => {
  test('accepts blank and zero as unlimited while rejecting non-integers', () => {
    expect(parseConcurrencyLimit('')).toBeNull()
    expect(parseConcurrencyLimit(' 0 ')).toBe(0)
    expect(parseConcurrencyLimit('12')).toBe(12)
    expect(parseConcurrencyLimit('-1')).toBeUndefined()
    expect(parseConcurrencyLimit('1.5')).toBeUndefined()
    expect(parseConcurrencyLimit(String(Number.MAX_SAFE_INTEGER + 1))).toBeUndefined()
  })

  test('matches Home canonical model keys without stripping custom suffixes', () => {
    expect(canonicalConcurrencyModelKey(' GPT-5.5(HIGH) ')).toBe('gpt-5.5')
    expect(canonicalConcurrencyModelKey('gpt-5.5(8192)')).toBe('gpt-5.5')
    expect(canonicalConcurrencyModelKey('Model(Custom)')).toBe('model(custom)')
    expect(canonicalConcurrencyModelKey('(high)')).toBe('(high)')
    expect(isValidConcurrencyModelKey('model')).toBeTrue()
    expect(isValidConcurrencyModelKey('界'.repeat(86))).toBeFalse()
  })

  test('normalizes snapshot diagnostics and keeps observed and admitted counts separate', async () => {
    useResponse({ ...observationMetadata(), items: [observedSummary()] })

    const snapshot = await fetchCredentialInFlightSummary(session)
    expect(snapshot).toMatchObject({
      observedAt: '2026-07-21T12:00:00Z',
      stale: false,
      coverageComplete: true,
      protocolCoverageComplete: true,
      minimumProcessedBarrierRevision: 7,
    })
    expect(snapshot.items[0]).toMatchObject({
      credentialId: 'auth-1',
      observedInFlight: 3,
      admittedInFlight: 2,
      maxInFlight: 4,
      remaining: 2,
      policyVersion: 3,
      fullyEnforced: 'false',
    })
    expect(snapshot.items[0]?.models).toEqual([
      {
        model: 'gpt-5.5',
        observedInFlight: 3,
        admittedInFlight: 2,
        maxInFlight: 2,
        remaining: 0,
        saturated: true,
      },
      {
        model: 'gpt-5.6',
        observedInFlight: null,
        admittedInFlight: 0,
        maxInFlight: 1,
        remaining: 1,
        saturated: false,
      },
    ])
  })

  test('accepts a snapshot with no completed CPA observation yet', async () => {
    useResponse({ ...observationMetadata(), observed_at: null, items: [] })
    await expect(fetchCredentialInFlightSummary(session)).resolves.toMatchObject({
      observedAt: null,
      items: [],
    })
  })

  test('uses the global detail route with bounded offset pagination and public fields only', async () => {
    let capturedConfig: InternalAxiosRequestConfig | null = null
    const items = Array.from({ length: 51 }, (_, index) => ({
      request_id: `request-${index}`,
      credential_id: 'auth-1',
      model: 'gpt-5.5',
      request_kind: index % 2 === 0 ? 'sse' : 'websocket',
      started_at: '2026-07-21T11:59:00Z',
      limiter: null,
    }))
    const adapter: AxiosAdapter = async (config) => {
      capturedConfig = config
      return response(config, { ...observationMetadata(), items })
    }
    axios.defaults.adapter = adapter

    const detail = await fetchCredentialInFlightDetail(session, 'auth-1')
    expect(capturedConfig?.url).toBe('/credentials/in-flight')
    expect(capturedConfig?.params).toEqual({ credential_id: 'auth-1', limit: 51, offset: 0 })
    expect(detail.requests).toHaveLength(50)
    expect(detail.nextOffset).toBe(50)
    expect(detail.requests[0]).toEqual({
      requestId: 'request-0',
      credentialId: 'auth-1',
      model: 'gpt-5.5',
      requestKind: 'sse',
      startedAt: '2026-07-21T11:59:00Z',
    })
  })

  test('loads authoritative limiter state independently from observations', async () => {
    useResponse({ items: [{ ...limiterState(), observed: null, fully_enforced: 'unknown' }] })
    const snapshot = await fetchCredentialConcurrencySnapshot(session)
    expect(snapshot.items[0]).toMatchObject({
      credentialId: 'auth-1',
      observedInFlight: null,
      admittedInFlight: 2,
      policyVersion: 3,
      fullyEnforced: 'unknown',
    })

    useResponse({
      credential_id: 'auth-1',
      max_in_flight: 4,
      max_in_flight_by_model: { 'gpt-5.5': 2 },
      version: 3,
      effective_at: '2026-07-21T11:58:00Z',
      observation_barrier_revision: 7,
    })
    await expect(fetchCredentialConcurrencyPolicy(session, 'auth-1')).resolves.toEqual({
      credentialId: 'auth-1',
      maxInFlight: 4,
      maxInFlightByModel: { 'gpt-5.5': 2 },
      version: 3,
      effectiveAt: '2026-07-21T11:58:00Z',
      observationBarrierRevision: 7,
    })
  })

  test('sends the loaded policy version with an atomic metadata and limit update', async () => {
    let patchBody: Record<string, unknown> | null = null
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === '/auth-files') {
        return response(config, {
          files: [
            {
              id: 'auth-1',
              auth_index: 'auth-1',
              provider: 'codex',
              type: 'codex',
              max_in_flight: 4,
              max_in_flight_by_model: { 'gpt-5.5': 2 },
            },
          ],
        })
      }
      if (config.url === '/auth-files/fields') {
        patchBody = JSON.parse(String(config.data)) as Record<string, unknown>
        return response(config, { status: 'ok' })
      }
      return response(config, {}, 404)
    }
    axios.defaults.adapter = adapter

    const resource = (await fetchCredentialSnapshot(session)).resources[0]
    expect(resource).toBeDefined()
    await updateCredentialMetadata(session, resource!, {
      prefix: '',
      proxyUrl: '',
      priority: '',
      note: '',
      maxInFlight: 3,
      maxInFlightByModel: { 'gpt-5.5': 1 },
      concurrencyVersion: 7,
    })

    expect(patchBody).toMatchObject({
      id: 'auth-1',
      max_in_flight: 3,
      max_in_flight_by_model: { 'gpt-5.5': 1 },
      version: 7,
    })
  })

  test('merges an observation with the independent authoritative state', async () => {
    useResponse({ ...observationMetadata(), items: [observationOnlySummary()] })
    const observed = (await fetchCredentialInFlightSummary(session)).items[0] ?? null

    useResponse({ items: [{ ...limiterState(), observed: null, fully_enforced: 'unknown' }] })
    const limiter = (await fetchCredentialConcurrencySnapshot(session)).items[0] ?? null
    const merged = mergeCredentialConcurrencySummary(observed, limiter)

    expect(merged).toMatchObject({
      observedInFlight: 3,
      admittedInFlight: 2,
      fullyEnforced: 'unknown',
    })
  })

  test('rejects malformed snapshot and request records instead of under-reporting work', async () => {
    const invalidMetadata = observationMetadata() as Record<string, unknown>
    delete invalidMetadata.protocol_coverage_complete
    useResponse({ ...invalidMetadata, items: [] })
    await expect(fetchCredentialInFlightSummary(session)).rejects.toThrow(
      'invalid credential in-flight response',
    )

    useResponse({
      ...observationMetadata(),
      items: [
        {
          request_id: 'request-invalid',
          credential_id: 'auth-1',
          model: 'gpt-5.5',
          started_at: '2026-07-21T11:59:00Z',
          limiter: null,
        },
      ],
    })
    await expect(fetchCredentialInFlightDetail(session, 'auth-1')).rejects.toThrow(
      'invalid credential in-flight response',
    )
  })

  test('uses only the exact independent v2 capability flags', async () => {
    const capabilityResult = async (capabilities: Record<string, boolean>) => {
      const adapter: AxiosAdapter = async (config) => {
        if (config.url === '/config') return response(config, {})
        if (config.url === '/capabilities') return response(config, { capabilities })
        return response(config, {}, 404)
      }
      axios.defaults.adapter = adapter
      return await probeManagementRuntime(session)
    }

    const current = await capabilityResult({
      credential_in_flight_snapshots: true,
      credential_concurrency_limits_v2: false,
    })
    expect(current.capabilities.credentialInFlight).toBeTrue()
    expect(current.capabilities.credentialConcurrencyLimits).toBeFalse()

    const legacy = await capabilityResult({
      credential_in_flight: true,
      credential_concurrency_limits: true,
    })
    expect(legacy.capabilities.credentialInFlight).toBeFalse()
    expect(legacy.capabilities.credentialConcurrencyLimits).toBeFalse()
  })
})
