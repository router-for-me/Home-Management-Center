import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type ManagementModelScope = 'available' | 'static'

export type ModelResource = {
  id: string
  displayName: string
  name: string | null
  ownedBy: string | null
  type: string | null
  channel: string | null
  scope: ManagementModelScope
  object: string | null
  created: number | null
  raw: UnknownRecord
}

type ModelsSnapshot = {
  fetchedAt: string
  scope: ManagementModelScope
  resources: ModelResource[]
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
  }
  return null
}

function normalizeModelResource(
  record: UnknownRecord,
  scope: ManagementModelScope,
  channel: string | null,
): ModelResource | null {
  const id = readString(record, ['id', 'model_id', 'model-id', 'model', 'name'])
  if (!id) return null

  const name = readString(record, ['name'])

  return {
    id,
    displayName: readString(record, ['display_name', 'displayName']) ?? name ?? id,
    name,
    ownedBy: readString(record, ['owned_by', 'ownedBy', 'owner']),
    type: readString(record, ['type']),
    channel: channel ?? readString(record, ['channel', 'provider']),
    scope,
    object: readString(record, ['object']),
    created: readNumber(record, ['created']),
    raw: record,
  }
}

function readModelEntries(responseData: unknown, scope: ManagementModelScope) {
  const responseRecord = toRecord(responseData)
  const models = Array.isArray(responseData) ? responseData : responseRecord.models

  if (Array.isArray(models)) {
    return models
      .filter(isRecord)
      .map((record) => normalizeModelResource(record, scope, null))
      .filter((resource): resource is ModelResource => Boolean(resource))
  }

  if (!isRecord(models)) return []

  return Object.entries(models).flatMap(([channel, value]) => {
    if (!Array.isArray(value)) return []

    return value
      .filter(isRecord)
      .map((record) => normalizeModelResource(record, scope, channel))
      .filter((resource): resource is ModelResource => Boolean(resource))
  })
}

export async function fetchModelsSnapshot(
  session: ManagementSessionInput,
  input: { scope?: ManagementModelScope; channel?: string } = {},
): Promise<ModelsSnapshot> {
  const scope = input.scope ?? 'available'
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/models', {
    params: {
      scope,
      ...(input.channel ? { channel: input.channel } : {}),
    },
  })

  return {
    fetchedAt: new Date().toISOString(),
    scope,
    resources: readModelEntries(response.data, scope),
  }
}

export function toModelsApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
