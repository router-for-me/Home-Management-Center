import type { AxiosResponse } from 'axios'

import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { CapabilityMap, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type SystemNodeResource = {
  id: string
  ip: string
  connectedTime: string | null
}

export type SystemConfigSummary = {
  debug: boolean
  requestLog: boolean
  usageStatistics: boolean
  loggingToFile: boolean
  routingStrategy: string
  proxyConfigured: boolean
}

export type SystemIssueScope = 'latestVersion' | 'config' | 'nodes' | 'apiCall'

export type SystemIssue = {
  scope: SystemIssueScope
  message: string
  status?: number
  code?: string
}

export type SystemNodesSnapshot = {
  fetchedAt: string
  homeVersion: string | null
  latestVersion: string | null
  config: SystemConfigSummary | null
  nodes: SystemNodeResource[]
  issues: SystemIssue[]
}

export type ApiCallInput = {
  method: string
  url: string
  authIndex: string
  headers: string
  data: string
}

export type ApiCallResult = {
  statusCode: number | null
  headers: Record<string, string[]>
  body: string
}

export type CertificateClientEnrollment = {
  id: string
  homeJwt: string
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readString(record: UnknownRecord, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function readResponseHeader(response: AxiosResponse, name: string): string | null {
  const headers = response.headers as Record<string, unknown>
  const value = headers[name.toLowerCase()]
  if (Array.isArray(value)) {
    const firstValue = value[0] as unknown
    return typeof firstValue === 'string' && firstValue.trim() ? firstValue : null
  }
  if (typeof value === 'string' && value.trim()) return value
  return null
}

function readRoutingStrategy(record: UnknownRecord): string {
  const strategy = readString(record, 'strategy')

  return strategy && strategy.toLowerCase() !== 'unknown' ? strategy : 'unknown'
}

function readBoolean(record: UnknownRecord, key: string): boolean {
  return record[key] === true
}

function readArrayRecords(value: unknown, key: string): UnknownRecord[] {
  const records = toRecord(value)[key]
  return Array.isArray(records) ? records.filter(isRecord) : []
}

function normalizeIssue(scope: SystemIssueScope, error: unknown): SystemIssue {
  const apiError = toManagementApiError(error)

  return {
    scope,
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
  }
}

async function readOptional<T>(
  issues: SystemIssue[],
  scope: SystemIssueScope,
  request: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    issues.push(normalizeIssue(scope, error))
    return fallback
  }
}

function normalizeConfigSummary(responseData: unknown): SystemConfigSummary {
  const config = toRecord(responseData)
  const routing = toRecord(config.routing)

  return {
    debug: readBoolean(config, 'debug'),
    requestLog: readBoolean(config, 'request-log'),
    usageStatistics: readBoolean(config, 'usage-statistics-enabled'),
    loggingToFile: readBoolean(config, 'logging-to-file'),
    routingStrategy: readRoutingStrategy(routing),
    proxyConfigured: Boolean(readString(config, 'proxy-url')),
  }
}

function normalizeNodes(responseData: unknown): SystemNodeResource[] {
  return readArrayRecords(responseData, 'nodes').map((record, index) => ({
    id: readString(record, 'ip') ?? `node-${index + 1}`,
    ip: readString(record, 'ip') ?? `node-${index + 1}`,
    connectedTime: readString(record, 'connected_time'),
  }))
}

function normalizeHeaders(value: unknown): Record<string, string[]> {
  const headers = toRecord(value)

  return Object.fromEntries(
    Object.entries(headers).map(([key, headerValue]) => [
      key,
      Array.isArray(headerValue)
        ? headerValue.filter((item): item is string => typeof item === 'string')
        : typeof headerValue === 'string'
          ? [headerValue]
          : [],
    ]),
  )
}

function parseHeaderInput(value: string): Record<string, string> {
  const trimmed = value.trim()
  if (!trimmed) return {}

  const parsed = JSON.parse(trimmed) as unknown
  const record = toRecord(parsed)

  return Object.fromEntries(
    Object.entries(record)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, headerValue]) => [key, headerValue]),
  )
}

export async function fetchSystemNodesSnapshot(
  session: ManagementSessionInput,
  capabilities: CapabilityMap,
): Promise<SystemNodesSnapshot> {
  const client = createManagementClient(session)
  const issues: SystemIssue[] = []

  let homeVersion: string | null = null
  let latestVersion: string | null = null

  const [, config, nodes] = await Promise.all([
    readOptional(
      issues,
      'latestVersion',
      async () => {
        const response = await client.get<unknown>('/latest-version')
        homeVersion = readResponseHeader(response, 'x-cpa-home-version')
        latestVersion = readString(toRecord(response.data), 'latest-version')
        return true
      },
      false,
    ),
    readOptional(
      issues,
      'config',
      async () => {
        const response = await client.get<unknown>('/config')
        return normalizeConfigSummary(response.data)
      },
      null,
    ),
    capabilities.nodes
      ? readOptional(
          issues,
          'nodes',
          async () => {
            const response = await client.get<unknown>('/nodes')
            return normalizeNodes(response.data)
          },
          [],
        )
      : Promise.resolve([]),
  ])

  return {
    fetchedAt: new Date().toISOString(),
    homeVersion,
    latestVersion,
    config,
    nodes,
    issues,
  }
}

export async function createCertificateClient(
  session: ManagementSessionInput,
): Promise<CertificateClientEnrollment> {
  const client = createManagementClient(session)
  const response = await client.post<unknown>('/certificates/clients')
  const record = toRecord(response.data)
  const homeJwt = readString(record, 'home_jwt')
  const id = readString(record, 'id')

  if (!homeJwt) {
    throw new Error('Management API did not return home_jwt.')
  }

  return {
    id: id ?? '',
    homeJwt,
  }
}

export async function runManagementApiCall(
  session: ManagementSessionInput,
  input: ApiCallInput,
): Promise<ApiCallResult> {
  const client = createManagementClient(session)
  const response = await client.post<unknown>('/api-call', {
    auth_index: input.authIndex.trim() || undefined,
    method: input.method.trim().toUpperCase(),
    url: input.url.trim(),
    header: parseHeaderInput(input.headers),
    data: input.data,
  })
  const record = toRecord(response.data)

  return {
    statusCode:
      typeof record.status_code === 'number' && Number.isFinite(record.status_code)
        ? record.status_code
        : null,
    headers: normalizeHeaders(record.header),
    body: readString(record, 'body') ?? '',
  }
}

export function toSystemNodesApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
