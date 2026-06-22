import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type ProxyPoolTestResult = 'passed' | 'failed' | 'untested'

export type ProxyPoolItem = {
  id: string
  name: string
  proxyUrl: string
  enabled: boolean
  scope: 'global'
  priority: number
  lastTestedAt: string | null
  lastTestResult: ProxyPoolTestResult
  note: string | null
  updatedAt: string
  raw: unknown
}

export type ProxyPoolInput = {
  name: string
  proxyUrl: string
  enabled: boolean
  priority: number
  note?: string
}

export type ProxyPoolsApiError = Error & {
  code?: ManagementApiError['code']
  status?: number
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function readNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readBoolean(record: UnknownRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return fallback
}

function readArrayRecords(value: unknown, keys: string[]) {
  if (Array.isArray(value)) return value.filter(isRecord)

  const record = toRecord(value)
  for (const key of keys) {
    const nextValue = record[key]
    if (Array.isArray(nextValue)) return nextValue.filter(isRecord)
  }

  return []
}

function normalizeProxyPoolTestResult(value: string | null): ProxyPoolTestResult {
  if (value === 'passed' || value === 'failed') return value
  return 'untested'
}

function normalizeProxyPoolItem(value: unknown, index: number): ProxyPoolItem {
  const record = toRecord(value)

  return {
    id: readString(record, ['id']) ?? `proxy-${index + 1}`,
    name: readString(record, ['name']) ?? '',
    proxyUrl: readString(record, ['proxy_url', 'proxyUrl', 'proxy-url', 'url']) ?? '',
    enabled: readBoolean(record, ['enabled'], true),
    scope: 'global',
    priority: readNumber(record, ['priority']) ?? 0,
    lastTestedAt: readString(record, ['last_tested_at', 'lastTestedAt']),
    lastTestResult: normalizeProxyPoolTestResult(
      readString(record, ['last_test_result', 'lastTestResult', 'test_result']),
    ),
    note: readString(record, ['note']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']) ?? '',
    raw: value,
  }
}

function toProxyPoolPayload(input: ProxyPoolInput) {
  return {
    name: input.name.trim(),
    proxy_url: input.proxyUrl.trim(),
    enabled: input.enabled,
    priority: input.priority,
    scope: 'global',
    note: input.note?.trim() || undefined,
  }
}

export async function fetchProxyPools(session: ManagementSessionInput) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/proxy/proxy-pools')

  return {
    fetchedAt: new Date().toISOString(),
    items: readArrayRecords(response.data, ['items', 'records', 'data', 'proxy_pools']).map(
      normalizeProxyPoolItem,
    ),
  }
}

export async function createProxyPool(session: ManagementSessionInput, input: ProxyPoolInput) {
  const client = createManagementClient(session)
  await client.post('/proxy/proxy-pools', toProxyPoolPayload(input))
}

export async function updateProxyPool(
  session: ManagementSessionInput,
  resource: ProxyPoolItem,
  input: ProxyPoolInput,
) {
  const client = createManagementClient(session)
  await client.patch(
    `/proxy/proxy-pools/${encodeURIComponent(resource.id)}`,
    toProxyPoolPayload(input),
  )
}

export async function deleteProxyPool(session: ManagementSessionInput, resource: ProxyPoolItem) {
  const client = createManagementClient(session)
  await client.delete(`/proxy/proxy-pools/${encodeURIComponent(resource.id)}`)
}

export async function testProxyPool(session: ManagementSessionInput, resource: ProxyPoolItem) {
  const client = createManagementClient(session)
  await client.post(`/proxy/proxy-pools/${encodeURIComponent(resource.id)}/test`, {})
}

export function toProxyPoolsApiError(error: unknown): ProxyPoolsApiError {
  const apiError = toManagementApiError(error)
  return Object.assign(new Error(apiError.message, { cause: error }), {
    code: apiError.code,
    status: apiError.status,
  })
}
