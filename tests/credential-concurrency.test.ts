import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  canonicalConcurrencyModelKey,
  parseConcurrencyLimit,
} from '../src/features/credentials/credential-concurrency'
import {
  fetchCredentialInFlightDetail,
  fetchCredentialInFlightSummary,
  fetchCredentialSnapshot,
} from '../src/lib/api/management/credentials'
import { probeManagementRuntime } from '../src/lib/api/management/probe'

const defaultAxiosAdapter = axios.defaults.adapter
const session = { baseUrl: 'http://management.test', managementKey: 'test-key' }

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

function useResponse(data: unknown) {
  const adapter: AxiosAdapter = async (config) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  axios.defaults.adapter = adapter
}

function validSummary() {
  return {
    credential_id: 'auth-1',
    in_flight: 2,
    max_in_flight: 4,
    remaining: 2,
    total_saturated: false,
    saturated_model_count: 1,
    models: [
      {
        model: 'gpt-5.5',
        in_flight: 2,
        max_in_flight: 2,
        remaining: 0,
        saturated: true,
      },
    ],
  }
}

describe('credential concurrency contract', () => {
  test('accepts blank and zero as unlimited while rejecting non-integers', () => {
    expect(parseConcurrencyLimit('')).toBeNull()
    expect(parseConcurrencyLimit(' 0 ')).toBe(0)
    expect(parseConcurrencyLimit('12')).toBe(12)
    expect(parseConcurrencyLimit('-1')).toBeUndefined()
    expect(parseConcurrencyLimit('1.5')).toBeUndefined()
    expect(parseConcurrencyLimit(String(Number.MAX_SAFE_INTEGER + 1))).toBeUndefined()
  })

  test('uses the same base model key as Home for thinking suffix limits', () => {
    expect(canonicalConcurrencyModelKey(' gpt-5.5(high) ')).toBe('gpt-5.5')
    expect(canonicalConcurrencyModelKey('gpt-5.5')).toBe('gpt-5.5')
    expect(canonicalConcurrencyModelKey('(high)')).toBe('(high)')
  })

  test('normalizes valid summary and detail responses', async () => {
    useResponse({ observed_at: '2026-07-20T12:00:00Z', items: [validSummary()] })
    await expect(fetchCredentialInFlightSummary(session)).resolves.toEqual({
      observedAt: '2026-07-20T12:00:00Z',
      items: [
        {
          credentialId: 'auth-1',
          inFlight: 2,
          maxInFlight: 4,
          remaining: 2,
          totalSaturated: false,
          saturatedModelCount: 1,
          models: [
            {
              model: 'gpt-5.5',
              inFlight: 2,
              maxInFlight: 2,
              remaining: 0,
              saturated: true,
            },
          ],
        },
      ],
    })

    useResponse({
      observed_at: '2026-07-20T12:00:01Z',
      credential: validSummary(),
      requests: {
        items: [
          {
            lease_id: 'lease-1',
            request_id: 'request-1',
            credential_id: 'auth-1',
            provider: 'codex',
            model: 'gpt-5.5',
            started_at: '2026-07-20T11:59:00Z',
          },
        ],
        next_cursor: null,
      },
    })
    const detail = await fetchCredentialInFlightDetail(session, 'auth-1')
    expect(detail.requests).toHaveLength(1)
    expect(detail.requests[0]).toMatchObject({
      leaseId: 'lease-1',
      requestId: 'request-1',
      credentialId: 'auth-1',
      model: 'gpt-5.5',
    })
  })

  test('rejects malformed records instead of silently under-reporting in-flight work', async () => {
    useResponse({
      observed_at: '2026-07-20T12:00:00Z',
      items: [{ ...validSummary(), in_flight: '2' }],
    })
    await expect(fetchCredentialInFlightSummary(session)).rejects.toThrow(
      'invalid credential in-flight response',
    )

    const missingRemaining = validSummary()
    delete (missingRemaining as Partial<ReturnType<typeof validSummary>>).remaining
    useResponse({ observed_at: '2026-07-20T12:00:00Z', items: [missingRemaining] })
    await expect(fetchCredentialInFlightSummary(session)).rejects.toThrow(
      'invalid credential in-flight response',
    )

    useResponse({ observed_at: null, items: [] })
    await expect(fetchCredentialInFlightSummary(session)).rejects.toThrow(
      'invalid credential in-flight response',
    )

    useResponse({
      observed_at: '2026-07-20T12:00:00Z',
      items: [{ ...validSummary(), in_flight: Number.MAX_SAFE_INTEGER + 1 }],
    })
    await expect(fetchCredentialInFlightSummary(session)).rejects.toThrow(
      'invalid credential in-flight response',
    )

    useResponse({
      observed_at: '2026-07-20T12:00:01Z',
      credential: validSummary(),
      requests: {
        items: [
          {
            lease_id: 'lease-invalid',
            request_id: 'request-invalid',
            credential_id: 'auth-1',
            model: 'gpt-5.5',
            started_at: 'not-a-time',
          },
        ],
        next_cursor: null,
      },
    })
    await expect(fetchCredentialInFlightDetail(session, 'auth-1')).rejects.toThrow(
      'invalid credential in-flight response',
    )
  })

  test('marks missing auth-file concurrency fields invalid so edits preserve existing limits', async () => {
    useResponse({
      files: [
        {
          id: 'auth-valid',
          type: 'codex',
          max_in_flight: null,
          max_in_flight_by_model: {},
        },
        {
          id: 'auth-missing-fields',
          type: 'codex',
        },
        {
          id: 'auth-invalid-fields',
          type: 'codex',
          max_in_flight: '4',
          max_in_flight_by_model: { 'gpt-5.5': 2 },
        },
      ],
    })

    const snapshot = await fetchCredentialSnapshot(session)
    expect(snapshot.resources.map((resource) => resource.concurrencyFieldsValid)).toEqual([
      true,
      false,
      false,
    ])
  })

  test('keeps observation and limit editing as separate capabilities', async () => {
    const adapter: AxiosAdapter = async (config) => {
      const url = config.url ?? ''
      if (url === '/config') {
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }
      if (url === '/capabilities') {
        return {
          data: {
            capabilities: {
              nodes: true,
              topology: false,
              request_events: false,
              request_event_filters: false,
              credential_in_flight: true,
              credential_concurrency_limits: false,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }
      }
      return { data: {}, status: 404, statusText: 'Not Found', headers: {}, config }
    }
    axios.defaults.adapter = adapter

    const result = await probeManagementRuntime(session)
    expect(result.capabilities.credentialInFlight).toBeTrue()
    expect(result.capabilities.credentialConcurrencyLimits).toBeFalse()
  })
})
