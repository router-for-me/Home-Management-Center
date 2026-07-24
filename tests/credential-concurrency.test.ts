import { createElement } from 'react'

import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'
import i18n from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'

import { TooltipProvider } from '../src/components/ui/tooltip'
import {
  CredentialConcurrencyDetail,
  CredentialConcurrencyEditor,
  CredentialInFlightCell,
  applyCredentialConcurrencyPolicyToForm,
  canonicalConcurrencyModelKey,
  isValidConcurrencyModelKey,
  parseConcurrencyLimit,
} from '../src/features/credentials/credential-concurrency'
import {
  getCredentialMetadataRefreshMode,
  retainCredentialMetadataErrorAfterPolicyRefresh,
} from '../src/features/credentials/credential-detail-drawer'
import {
  flattenCredentialInFlightRequests,
  shouldResetCredentialInFlightPagination,
  shouldRetryCredentialInFlightPagination,
} from '../src/features/credentials/use-credential-workbench'
import {
  type CredentialInFlightDetail,
  type CredentialInFlightRequest,
  fetchCredentialConcurrencyPolicy,
  fetchCredentialConcurrencySnapshot,
  fetchCredentialInFlightDetail,
  fetchCredentialInFlightSummary,
  fetchCredentialSnapshot,
  matchesCredentialBackendError,
  mergeCredentialConcurrencySummary,
  updateCredentialMetadata,
} from '../src/lib/api/management/credentials'
import { probeManagementRuntime } from '../src/lib/api/management/probe'
import '../src/lib/i18n/i18n'

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

function axiosResponseError(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return Object.assign(new Error(`request failed with status ${status}`), {
    isAxiosError: true,
    config,
    response: response(config, data, status),
  })
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

function normalizedDetailPage(
  requests: CredentialInFlightRequest[],
  overrides: Partial<CredentialInFlightDetail> = {},
): CredentialInFlightDetail {
  return {
    observedAt: '2026-07-21T12:00:00Z',
    stale: false,
    coverageComplete: true,
    aggregatesComplete: true,
    protocolCoverageComplete: true,
    minimumProcessedBarrierRevision: 7,
    detailsTruncated: false,
    requests,
    total: requests.length,
    nextOffset: null,
    snapshotCursor: null,
    snapshotCursorReadAt: null,
    snapshotExpiresAt: null,
    snapshotClientExpiresAtMs: null,
    paginationLimited: false,
    ...overrides,
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

  test('uses a bounded first page without unsafe dynamic pagination on legacy Home', async () => {
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
    expect(detail.nextOffset).toBeNull()
    expect(detail.snapshotCursor).toBeNull()
    expect(detail.paginationLimited).toBeTrue()
    expect(detail.requests[0]).toEqual({
      requestId: 'request-0',
      credentialId: 'auth-1',
      model: 'gpt-5.5',
      requestKind: 'sse',
      startedAt: '2026-07-21T11:59:00Z',
    })
  })

  test('falls back once to a bounded legacy page when first-page cursor storage fails', async () => {
    const capturedParams: unknown[] = []
    const items = Array.from({ length: 51 }, (_, index) => ({
      request_id: `fallback-request-${index}`,
      credential_id: 'auth-1',
      model: 'gpt-5.5',
      request_kind: 'sse',
      started_at: '2026-07-21T11:59:00Z',
      limiter: null,
    }))
    const adapter: AxiosAdapter = async (config) => {
      capturedParams.push(config.params)
      if (capturedParams.length === 1) {
        throw axiosResponseError(config, 500, {
          error: 'in_flight_snapshot_cursor_store_failed',
          message: 'cursor storage is unavailable',
        })
      }
      return response(config, { ...observationMetadata(), items })
    }
    axios.defaults.adapter = adapter

    const detail = await fetchCredentialInFlightDetail(session, 'auth-1', {
      stableSnapshot: true,
    })
    expect(capturedParams).toEqual([
      { credential_id: 'auth-1', limit: 50, offset: 0, stable_snapshot: true },
      { credential_id: 'auth-1', limit: 51, offset: 0 },
    ])
    expect(detail.requests).toHaveLength(50)
    expect(detail.paginationLimited).toBeTrue()
    expect(detail.snapshotCursor).toBeNull()
    expect(detail.nextOffset).toBeNull()
  })

  test('requires the documented status and code before falling back from stable pagination', async () => {
    const capturedParams: unknown[] = []
    const adapter: AxiosAdapter = async (config) => {
      capturedParams.push(config.params)
      throw axiosResponseError(config, 409, {
        error: 'in_flight_snapshot_cursor_store_failed',
        message: 'mismatched cursor error status',
      })
    }
    axios.defaults.adapter = adapter

    await expect(
      fetchCredentialInFlightDetail(session, 'auth-1', { stableSnapshot: true }),
    ).rejects.toThrow('request failed with status 409')
    expect(capturedParams).toEqual([
      { credential_id: 'auth-1', limit: 50, offset: 0, stable_snapshot: true },
    ])
  })

  test('does not mix a later cursor load failure with a legacy page', async () => {
    const capturedParams: unknown[] = []
    const adapter: AxiosAdapter = async (config) => {
      capturedParams.push(config.params)
      throw axiosResponseError(config, 500, {
        error: 'in_flight_snapshot_cursor_load_failed',
        message: 'cursor relation is incomplete',
      })
    }
    axios.defaults.adapter = adapter

    await expect(
      fetchCredentialInFlightDetail(session, 'auth-1', {
        offset: 50,
        snapshotCursor: 'stable-cursor',
        expectedTotal: 75,
        expectedSnapshotExpiresAt: '2026-07-21T12:02:00Z',
      }),
    ).rejects.toThrow('request failed with status 500')
    expect(capturedParams).toEqual([
      { credential_id: 'auth-1', limit: 50, offset: 50, snapshot_cursor: 'stable-cursor' },
    ])
  })

  test('uses one immutable snapshot cursor across detail pages', async () => {
    const capturedParams: unknown[] = []
    const firstItems = Array.from({ length: 50 }, (_, index) => ({
      request_id: `snapshot-request-${index}`,
      credential_id: 'auth-1',
      model: 'gpt-5.5',
      request_kind: 'sse',
      started_at: '2026-07-21T11:59:00Z',
      limiter: null,
    }))
    const secondItems = Array.from({ length: 25 }, (_, index) => ({
      request_id: `snapshot-request-${index + 50}`,
      credential_id: 'auth-1',
      model: 'gpt-5.5',
      request_kind: 'websocket',
      started_at: '2026-07-21T11:59:00Z',
      limiter: null,
    }))
    const adapter: AxiosAdapter = async (config) => {
      capturedParams.push(config.params)
      if ((config.params as Record<string, unknown>).snapshot_cursor) {
        return response(config, {
          ...observationMetadata(),
          items: secondItems,
          total: 75,
          next_offset: null,
          snapshot_cursor: 'stable-cursor',
          snapshot_cursor_read_at: '2026-07-21T12:00:30Z',
          snapshot_expires_at: '2026-07-21T12:02:00Z',
        })
      }
      return response(config, {
        ...observationMetadata(),
        items: firstItems,
        total: 75,
        next_offset: 50,
        snapshot_cursor: 'stable-cursor',
        snapshot_cursor_read_at: '2026-07-21T12:00:00Z',
        snapshot_expires_at: '2026-07-21T12:02:00Z',
      })
    }
    axios.defaults.adapter = adapter

    const beforeFirstPage = Date.now()
    const firstPage = await fetchCredentialInFlightDetail(session, 'auth-1', {
      stableSnapshot: true,
    })
    const afterFirstPage = Date.now()
    const secondPage = await fetchCredentialInFlightDetail(session, 'auth-1', {
      offset: firstPage.nextOffset ?? 0,
      snapshotCursor: firstPage.snapshotCursor,
      expectedTotal: firstPage.total,
      expectedSnapshotExpiresAt: firstPage.snapshotExpiresAt,
    })
    const afterSecondPage = Date.now()

    expect(capturedParams).toEqual([
      { credential_id: 'auth-1', limit: 50, offset: 0, stable_snapshot: true },
      { credential_id: 'auth-1', limit: 50, offset: 50, snapshot_cursor: 'stable-cursor' },
    ])
    expect(firstPage.requests.at(-1)?.requestId).toBe('snapshot-request-49')
    expect(secondPage.requests[0]?.requestId).toBe('snapshot-request-50')
    expect(secondPage.nextOffset).toBeNull()
    expect(secondPage.total).toBe(75)
    expect(firstPage.snapshotCursorReadAt).toBe('2026-07-21T12:00:00Z')
    expect(secondPage.snapshotCursorReadAt).toBe('2026-07-21T12:00:30Z')
    expect(firstPage.snapshotClientExpiresAtMs).toBeGreaterThanOrEqual(beforeFirstPage + 120_000)
    expect(firstPage.snapshotClientExpiresAtMs).toBeLessThanOrEqual(afterFirstPage + 120_000)
    expect(secondPage.snapshotClientExpiresAtMs).toBeGreaterThanOrEqual(afterFirstPage + 90_000)
    expect(secondPage.snapshotClientExpiresAtMs).toBeLessThanOrEqual(afterSecondPage + 90_000)
  })

  test('rejects incomplete or drifting stable snapshot pages', async () => {
    const firstPageItems = Array.from({ length: 50 }, (_, index) => ({
      request_id: `snapshot-request-${index}`,
      credential_id: 'auth-1',
      model: 'gpt-5.5',
      request_kind: 'sse',
      started_at: '2026-07-21T11:59:00Z',
      limiter: null,
    }))
    useResponse({
      ...observationMetadata(),
      items: firstPageItems,
      total: 75,
      next_offset: 50,
      snapshot_cursor: 'stable-cursor',
      snapshot_expires_at: '2026-07-21T12:02:00Z',
    })
    await expect(
      fetchCredentialInFlightDetail(session, 'auth-1', { stableSnapshot: true }),
    ).rejects.toThrow('invalid credential in-flight response')

    useResponse({
      ...observationMetadata(),
      items: firstPageItems,
      total: 75,
      next_offset: null,
      snapshot_cursor: null,
      snapshot_cursor_read_at: null,
      snapshot_expires_at: null,
    })
    await expect(
      fetchCredentialInFlightDetail(session, 'auth-1', { stableSnapshot: true }),
    ).rejects.toThrow('invalid credential in-flight response')

    const finalPageItems = Array.from({ length: 25 }, (_, index) => ({
      request_id: `snapshot-request-${index + 50}`,
      credential_id: 'auth-1',
      model: 'gpt-5.5',
      request_kind: 'websocket',
      started_at: '2026-07-21T11:59:00Z',
      limiter: null,
    }))
    useResponse({
      ...observationMetadata(),
      items: finalPageItems,
      total: 76,
      next_offset: 75,
      snapshot_cursor: 'stable-cursor',
      snapshot_cursor_read_at: '2026-07-21T12:00:30Z',
      snapshot_expires_at: '2026-07-21T12:02:00Z',
    })
    await expect(
      fetchCredentialInFlightDetail(session, 'auth-1', {
        offset: 50,
        snapshotCursor: 'stable-cursor',
        expectedTotal: 75,
        expectedSnapshotExpiresAt: '2026-07-21T12:02:00Z',
      }),
    ).rejects.toThrow('invalid credential in-flight response')

    useResponse({
      ...observationMetadata(),
      items: finalPageItems,
      total: 75,
      next_offset: null,
      snapshot_cursor: 'stable-cursor',
      snapshot_cursor_read_at: '2026-07-21T12:00:30Z',
      snapshot_expires_at: '2026-07-21T12:03:00Z',
    })
    await expect(
      fetchCredentialInFlightDetail(session, 'auth-1', {
        offset: 50,
        snapshotCursor: 'stable-cursor',
        expectedTotal: 75,
        expectedSnapshotExpiresAt: '2026-07-21T12:02:00Z',
      }),
    ).rejects.toThrow('invalid credential in-flight response')
  })

  test('preserves repeated request IDs as distinct in-flight rows', () => {
    const repeated = [
      {
        requestId: 'shared-request-id',
        credentialId: 'auth-1',
        model: 'gpt-5.5',
        requestKind: 'sse',
        startedAt: '2026-07-21T11:59:00Z',
      },
      {
        requestId: 'shared-request-id',
        credentialId: 'auth-1',
        model: 'gpt-5.6',
        requestKind: 'websocket',
        startedAt: '2026-07-21T11:59:01Z',
      },
    ] satisfies CredentialInFlightRequest[]
    const requests = flattenCredentialInFlightRequests([
      normalizedDetailPage([repeated[0]!], {
        total: 2,
        nextOffset: 1,
        snapshotCursor: 'stable-cursor',
        snapshotCursorReadAt: '2026-07-21T12:00:00Z',
        snapshotExpiresAt: '2026-07-21T12:02:00Z',
      }),
      normalizedDetailPage([repeated[1]!], {
        total: 2,
        snapshotCursor: 'stable-cursor',
        snapshotCursorReadAt: '2026-07-21T12:00:30Z',
        snapshotExpiresAt: '2026-07-21T12:02:00Z',
      }),
    ])
    expect(requests).toEqual(repeated)
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

  test('uses the newest policy projection without carrying enforcement across versions', async () => {
    useResponse({ ...observationMetadata(), items: [observedSummary()] })
    const observed = (await fetchCredentialInFlightSummary(session)).items[0] ?? null

    useResponse({ items: [{ ...limiterState(), observed: null, fully_enforced: 'unknown' }] })
    const limiter = (await fetchCredentialConcurrencySnapshot(session)).items[0] ?? null
    expect(mergeCredentialConcurrencySummary(observed, limiter)?.fullyEnforced).toBe('false')

    const newerLimiter = limiter
      ? {
          ...limiter,
          maxInFlight: null,
          remaining: null,
          policyVersion: 4,
          observationBarrierRevision: 8,
          models: limiter.models.filter((model) => model.model === 'gpt-5.6'),
        }
      : null
    const newerLimiterMerge = mergeCredentialConcurrencySummary(observed, newerLimiter)
    expect(newerLimiterMerge).toMatchObject({
      observedInFlight: 3,
      admittedInFlight: 2,
      maxInFlight: null,
      remaining: null,
      policyVersion: 4,
      fullyEnforced: 'unknown',
    })
    expect(newerLimiterMerge?.models.find((model) => model.model === 'gpt-5.5')).toEqual({
      model: 'gpt-5.5',
      observedInFlight: 3,
      admittedInFlight: null,
      maxInFlight: null,
      remaining: null,
      saturated: false,
    })

    const newestObserved = observed
      ? {
          ...observed,
          maxInFlight: 6,
          remaining: 4,
          policyVersion: 5,
          observationBarrierRevision: 9,
          fullyEnforced: 'true' as const,
        }
      : null
    expect(mergeCredentialConcurrencySummary(newestObserved, newerLimiter)).toMatchObject({
      observedInFlight: 3,
      admittedInFlight: 2,
      maxInFlight: 6,
      remaining: 4,
      policyVersion: 5,
      fullyEnforced: 'true',
    })
  })

  test('renders list, model, and request concurrency states from the v2 view model', async () => {
    await i18n.changeLanguage('en')
    useResponse({ ...observationMetadata(), items: [observedSummary()] })
    const snapshot = await fetchCredentialInFlightSummary(session)
    const summary = snapshot.items[0] ?? null
    expect(summary).not.toBeNull()

    const cellMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(CredentialInFlightCell, {
          summary: summary
            ? { ...summary, admittedInFlight: 3, maxInFlight: 3, totalSaturated: true }
            : null,
        }),
      ),
    )
    expect(cellMarkup).toContain('3 / 3')
    expect(cellMarkup).toContain('The credential concurrency limit is full')

    const detailMarkup = renderToStaticMarkup(
      createElement(CredentialConcurrencyDetail, {
        summary,
        observation: snapshot,
        observationAvailable: true,
        detail: normalizedDetailPage(
          [
            {
              requestId: 'request-rendered',
              credentialId: 'auth-1',
              model: 'gpt-5.5',
              requestKind: 'sse',
              startedAt: '2026-07-21T11:59:00Z',
            },
            {
              requestId: 'request-rendered',
              credentialId: 'auth-1',
              model: 'gpt-5.6',
              requestKind: 'websocket',
              startedAt: '2026-07-21T11:59:01Z',
            },
          ],
          snapshot,
        ),
        pending: false,
        fetching: false,
        stale: false,
        errorMessage: null,
        hasNextPage: false,
        fetchingNextPage: false,
        onLoadMore: () => undefined,
        onRefresh: () => undefined,
      }),
    )
    expect(detailMarkup).toContain('Observed')
    expect(detailMarkup).toContain('Admitted')
    expect(detailMarkup).toContain('gpt-5.5')
    expect(detailMarkup.match(/request-rendered/g)).toHaveLength(2)
    expect(detailMarkup).toContain('sse')
    expect(detailMarkup).toContain('websocket')
  })

  test('marks an expired cursor and hides ordinary load-more action', async () => {
    await i18n.changeLanguage('en')
    const detail = normalizedDetailPage(
      [
        {
          requestId: 'expired-request',
          credentialId: 'auth-1',
          model: 'gpt-5.5',
          requestKind: 'sse',
          startedAt: '2026-07-21T11:59:00Z',
        },
      ],
      {
        total: 2,
        nextOffset: 1,
        snapshotCursor: 'expired-cursor',
        snapshotCursorReadAt: '1999-12-31T23:58:00Z',
        snapshotExpiresAt: '2000-01-01T00:00:00Z',
        snapshotClientExpiresAtMs: Date.now() - 1,
      },
    )
    const markup = renderToStaticMarkup(
      createElement(CredentialConcurrencyDetail, {
        summary: null,
        observation: detail,
        observationAvailable: true,
        detail,
        pending: false,
        fetching: false,
        stale: false,
        errorMessage: null,
        hasNextPage: true,
        fetchingNextPage: false,
        onLoadMore: () => undefined,
        onRefresh: () => undefined,
      }),
    )
    expect(markup).toContain('stable request snapshot has expired')
    expect(markup).not.toContain('Load more')
  })

  test('keeps load more available when a cursor deadline cannot be safely derived', async () => {
    await i18n.changeLanguage('en')
    const detail = normalizedDetailPage(
      [
        {
          requestId: 'clock-skew-safe-request',
          credentialId: 'auth-1',
          model: 'gpt-5.5',
          requestKind: 'sse',
          startedAt: '2026-07-21T11:59:00Z',
        },
      ],
      {
        total: 2,
        nextOffset: 1,
        snapshotCursor: 'clock-skew-safe-cursor',
        snapshotCursorReadAt: '2000-01-01T00:00:00Z',
        snapshotExpiresAt: '2000-01-01T00:00:00Z',
        snapshotClientExpiresAtMs: null,
      },
    )
    const markup = renderToStaticMarkup(
      createElement(CredentialConcurrencyDetail, {
        summary: null,
        observation: detail,
        observationAvailable: true,
        detail,
        pending: false,
        fetching: false,
        stale: false,
        errorMessage: null,
        hasNextPage: true,
        fetchingNextPage: false,
        onLoadMore: () => undefined,
        onRefresh: () => undefined,
      }),
    )
    expect(markup).toContain('pinned to one stable snapshot')
    expect(markup).toContain('Load more')
    expect(markup).not.toContain('stable request snapshot has expired')
  })

  test('renders authoritative admitted counts and never labels observation-only state as unlimited', async () => {
    await i18n.changeLanguage('en')
    const authoritativeMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(CredentialInFlightCell, {
          summary: {
            credentialId: 'auth-1',
            observedInFlight: 0,
            admittedInFlight: 1,
            maxInFlight: 1,
            remaining: 0,
            totalSaturated: true,
            saturatedModelCount: 0,
            models: [],
            policyVersion: 1,
            effectiveAt: '2026-07-21T12:00:00Z',
            observationBarrierRevision: 1,
            fullyEnforced: 'true',
            observed: null,
          },
        }),
      ),
    )
    expect(authoritativeMarkup).toContain('1 / 1')
    expect(authoritativeMarkup).not.toContain('0 / 1')

    useResponse({ ...observationMetadata(), items: [observationOnlySummary()] })
    const observationOnly = (await fetchCredentialInFlightSummary(session)).items[0] ?? null
    const observationMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(CredentialInFlightCell, { summary: observationOnly }),
      ),
    )
    expect(observationMarkup).toContain('3 observed')
    expect(observationMarkup).not.toContain('∞')
  })

  test('surfaces partial and failed projections without an enforcement warning in limiter-only mode', async () => {
    await i18n.changeLanguage('en')
    const cellMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(CredentialInFlightCell, {
          summary: null,
          status: {
            observation: {
              observedAt: '2026-07-21T12:00:00Z',
              stale: true,
              coverageComplete: false,
              aggregatesComplete: false,
              protocolCoverageComplete: true,
              minimumProcessedBarrierRevision: 7,
              detailsTruncated: false,
            },
            observationStale: true,
            observationErrorMessage: 'snapshot read failed',
            limiterStale: true,
            limiterErrorMessage: 'counter read failed',
          },
        }),
      ),
    )
    expect(cellMarkup).toContain('Observation data is unavailable')
    expect(cellMarkup).toContain('Authoritative limiter state is unavailable')
    expect(cellMarkup).toContain('snapshot coverage is incomplete')

    useResponse({ items: [{ ...limiterState(), observed: null, fully_enforced: 'unknown' }] })
    const limiterOnly = (await fetchCredentialConcurrencySnapshot(session)).items[0] ?? null
    const detailMarkup = renderToStaticMarkup(
      createElement(CredentialConcurrencyDetail, {
        summary: limiterOnly,
        observation: null,
        observationAvailable: false,
        detail: null,
        pending: false,
        fetching: false,
        stale: false,
        errorMessage: null,
        hasNextPage: false,
        fetchingNextPage: false,
        onLoadMore: () => undefined,
        onRefresh: () => undefined,
      }),
    )
    expect(detailMarkup).not.toContain('cannot currently confirm')
  })

  test('renders the non-kill warning when a proposed limit is below current work', async () => {
    await i18n.changeLanguage('en')
    useResponse({ ...observationMetadata(), items: [observedSummary()] })
    const summary = (await fetchCredentialInFlightSummary(session)).items[0] ?? null
    const markup = renderToStaticMarkup(
      createElement(CredentialConcurrencyEditor, {
        form: {
          prefix: '',
          proxyUrl: '',
          priority: '',
          note: '',
          websockets: false,
          maxInFlight: '1',
          maxInFlightByModel: [{ model: 'gpt-5.5', limit: '1' }],
        },
        summary,
        mutating: false,
        onChange: () => undefined,
      }),
    )
    expect(markup).toContain('Existing requests continue')
    expect(markup).toContain('new dispatches that exceed the limit are blocked')
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

    useResponse({
      ...observationMetadata(),
      items: [
        {
          request_id: 'request-wrong-credential',
          credential_id: 'auth-2',
          model: 'gpt-5.5',
          request_kind: 'sse',
          started_at: '2026-07-21T11:59:00Z',
          limiter: null,
        },
      ],
    })
    await expect(fetchCredentialInFlightDetail(session, 'auth-1')).rejects.toThrow(
      'invalid credential in-flight response',
    )

    useResponse({ items: [limiterState()] })
    await expect(fetchCredentialConcurrencySnapshot(session)).rejects.toThrow(
      'invalid credential concurrency response',
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
      credential_in_flight_snapshot_cursor: true,
      credential_concurrency_limits_v2: false,
    })
    expect(current.capabilities.credentialInFlight).toBeTrue()
    expect(current.capabilities.credentialInFlightSnapshotCursor).toBeTrue()
    expect(current.capabilities.credentialConcurrencyLimits).toBeFalse()

    const legacy = await capabilityResult({
      credential_in_flight: true,
      credential_concurrency_limits: true,
    })
    expect(legacy.capabilities.credentialInFlight).toBeFalse()
    expect(legacy.capabilities.credentialInFlightSnapshotCursor).toBeFalse()
    expect(legacy.capabilities.credentialConcurrencyLimits).toBeFalse()
  })

  test('resets cursor pages only for the explicit cursor-expired backend error', () => {
    expect(
      shouldResetCredentialInFlightPagination(
        {
          status: 409,
          backendCode: 'in_flight_snapshot_cursor_expired',
        },
        true,
      ),
    ).toBeTrue()
    expect(
      shouldResetCredentialInFlightPagination(
        {
          status: 500,
          backendCode: 'in_flight_snapshot_cursor_expired',
        },
        true,
      ),
    ).toBeFalse()
    expect(
      shouldResetCredentialInFlightPagination(
        {
          backendCode: 'in_flight_snapshot_cursor_load_failed',
        },
        true,
      ),
    ).toBeFalse()
    expect(
      shouldResetCredentialInFlightPagination(
        {
          status: 409,
          backendCode: 'in_flight_snapshot_cursor_expired',
        },
        false,
      ),
    ).toBeFalse()
  })

  test('recognizes policy conflicts only from the documented status and code pair', () => {
    expect(
      matchesCredentialBackendError(
        { status: 409, backendCode: 'concurrency_policy_version_conflict' },
        409,
        'concurrency_policy_version_conflict',
      ),
    ).toBeTrue()
    expect(
      matchesCredentialBackendError(
        { status: 500, backendCode: 'concurrency_policy_version_conflict' },
        409,
        'concurrency_policy_version_conflict',
      ),
    ).toBeFalse()
  })

  test('retries only network failures and explicitly retryable server failures', () => {
    expect(shouldRetryCredentialInFlightPagination(0, { code: 'network' })).toBeTrue()
    expect(
      shouldRetryCredentialInFlightPagination(1, {
        status: 503,
        code: 'server',
        retryable: true,
      }),
    ).toBeTrue()
    expect(
      shouldRetryCredentialInFlightPagination(0, {
        status: 500,
        code: 'server',
        retryable: false,
      }),
    ).toBeFalse()
    expect(
      shouldRetryCredentialInFlightPagination(0, {
        status: 500,
        code: 'server',
        backendCode: 'in_flight_snapshot_cursor_store_failed',
        retryable: true,
      }),
    ).toBeFalse()
    expect(
      shouldRetryCredentialInFlightPagination(0, {
        status: 409,
        backendCode: 'in_flight_snapshot_cursor_expired',
      }),
    ).toBeFalse()
    expect(
      shouldRetryCredentialInFlightPagination(0, {
        status: 503,
        code: 'server',
        backendCode: 'in_flight_snapshot_cursor_expired',
        retryable: true,
      }),
    ).toBeTrue()
    expect(shouldRetryCredentialInFlightPagination(0, { code: 'unknown' })).toBeFalse()
    expect(shouldRetryCredentialInFlightPagination(3, { code: 'network' })).toBeFalse()
  })

  test('preserves metadata drafts unless the credential or effective policy version changes', () => {
    expect(
      getCredentialMetadataRefreshMode({
        open: true,
        credentialId: 'auth-1',
        previousCredentialId: 'auth-1',
        policyVersion: 2,
        previousPolicyVersion: 2,
      }),
    ).toBe('preserve')
    expect(
      getCredentialMetadataRefreshMode({
        open: true,
        credentialId: 'auth-1',
        previousCredentialId: 'auth-1',
        policyVersion: null,
        previousPolicyVersion: 2,
      }),
    ).toBe('preserve')
    expect(
      getCredentialMetadataRefreshMode({
        open: true,
        credentialId: 'auth-1',
        previousCredentialId: 'auth-1',
        policyVersion: 0,
        previousPolicyVersion: null,
      }),
    ).toBe('policy')
    expect(
      getCredentialMetadataRefreshMode({
        open: true,
        credentialId: 'auth-1',
        previousCredentialId: 'auth-1',
        policyVersion: 0,
        previousPolicyVersion: 'unobserved',
      }),
    ).toBe('policy')
    expect(
      getCredentialMetadataRefreshMode({
        open: true,
        credentialId: 'auth-1',
        previousCredentialId: 'auth-1',
        policyVersion: 4,
        previousPolicyVersion: 3,
      }),
    ).toBe('policy')
    expect(
      getCredentialMetadataRefreshMode({
        open: true,
        credentialId: 'auth-2',
        previousCredentialId: 'auth-1',
        policyVersion: 1,
        previousPolicyVersion: 1,
      }),
    ).toBe('reset')
    expect(
      getCredentialMetadataRefreshMode({
        open: false,
        credentialId: 'auth-1',
        previousCredentialId: 'auth-1',
        policyVersion: 2,
        previousPolicyVersion: 2,
      }),
    ).toBe('reset')
  })

  test('retains version-conflict guidance through policy refresh only for the same credential', () => {
    const conflict = {
      credentialId: 'auth-1',
      kind: 'version-conflict' as const,
      message: 'Review the refreshed values and save again.',
    }
    expect(retainCredentialMetadataErrorAfterPolicyRefresh(conflict, 'auth-1')).toEqual(conflict)
    expect(retainCredentialMetadataErrorAfterPolicyRefresh(conflict, 'auth-2')).toBeNull()
    expect(
      retainCredentialMetadataErrorAfterPolicyRefresh(
        { ...conflict, kind: 'other' as const },
        'auth-1',
      ),
    ).toBeNull()
  })

  test('applies refreshed concurrency policy without replacing metadata drafts', () => {
    const draft = {
      prefix: 'draft-prefix',
      proxyUrl: 'socks5://draft-proxy',
      priority: '9',
      note: 'draft-note',
      websockets: true,
      maxInFlight: '1',
      maxInFlightByModel: [{ model: 'old-model', limit: '1' }],
    }
    const next = applyCredentialConcurrencyPolicyToForm(draft, {
      credentialId: 'auth-1',
      maxInFlight: 4,
      maxInFlightByModel: { 'gpt-5.6': 2, 'gpt-5.5': 3 },
      version: 2,
      effectiveAt: '2026-07-21T12:00:00Z',
      observationBarrierRevision: 8,
    })
    expect(next).toEqual({
      ...draft,
      maxInFlight: '4',
      maxInFlightByModel: [
        { model: 'gpt-5.5', limit: '3' },
        { model: 'gpt-5.6', limit: '2' },
      ],
    })
  })
})
