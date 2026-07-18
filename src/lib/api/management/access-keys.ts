import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type AccessKeysResponse = {
  'api-keys'?: unknown[]
  api_keys?: unknown[]
  items?: unknown[]
  api_key_entries?: unknown[]
}

export type AccessKeyResource = {
  id: string
  index: number
  numericId: number | null
  identifier: string | null
  value: string
  maskedValue: string
  prefix: string
  suffix: string
  length: number
  userId: number | null
  channelGroupIds: number[]
  modelGroupIds: number[]
  raw: unknown
}

export type AccessKeyFormInput = {
  value: string
  userId?: number | null
  channelGroupIds?: number[]
  modelGroupIds?: number[]
}

type AccessKeysSnapshot = {
  fetchedAt: string
  resources: AccessKeyResource[]
}

function readKeys(responseData: unknown): string[] {
  const response = responseData as AccessKeysResponse

  const values = response['api-keys'] ?? response.api_keys

  return Array.isArray(values)
    ? values.filter((item): item is string => typeof item === 'string')
    : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function readNumberArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (!Array.isArray(value)) continue

    return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
  }
  return []
}

function readEntries(responseData: unknown): unknown[] {
  const response = responseData as AccessKeysResponse
  const entries = response.api_key_entries ?? response.items

  if (Array.isArray(entries) && entries.length > 0) return entries

  return readKeys(responseData)
}

function maskAccessKey(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return ''
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}***`

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`
}

function normalizeAccessKey(value: unknown, index: number): AccessKeyResource {
  const record = isRecord(value) ? value : null
  const keyValue = record
    ? (readString(record, ['api_key', 'api-key', 'key', 'value']) ?? '')
    : typeof value === 'string'
      ? value
      : ''
  const trimmed = keyValue.trim()
  const numericId = record ? readNumber(record, ['id', 'api_key_id', 'api-key-id']) : null
  const identifier = numericId != null ? `api-key-${numericId}` : null

  return {
    id: numericId != null ? String(numericId) : `${index}:${trimmed}`,
    index,
    numericId,
    identifier,
    value: trimmed,
    maskedValue: maskAccessKey(trimmed),
    prefix: trimmed.slice(0, 6),
    suffix: trimmed.slice(-4),
    length: trimmed.length,
    userId: record ? readNumber(record, ['user_id', 'user-id']) : null,
    channelGroupIds: record ? readNumberArray(record, ['channels']) : [],
    modelGroupIds: record ? readNumberArray(record, ['model_groups', 'model-groups']) : [],
    raw: value,
  }
}

function normalizeInput(input: string | AccessKeyFormInput): AccessKeyFormInput {
  return typeof input === 'string' ? { value: input } : input
}

function toAccessKeyEntry(input: AccessKeyFormInput) {
  return {
    api_key: input.value.trim(),
    user_id: input.userId ?? 0,
    channels: input.channelGroupIds ?? [],
    model_groups: input.modelGroupIds ?? [],
  }
}

export async function fetchAccessKeysSnapshot(
  session: ManagementSessionInput,
): Promise<AccessKeysSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/api-keys')

  return {
    fetchedAt: new Date().toISOString(),
    resources: readEntries(response.data).map((value, index) => normalizeAccessKey(value, index)),
  }
}

export async function createAccessKey(
  session: ManagementSessionInput,
  input: string | AccessKeyFormInput,
) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/api-keys')
  const nextInput = normalizeInput(input)
  const currentResources = readEntries(response.data)
    .map((item, index) => normalizeAccessKey(item, index))
    .filter((item) => item.value)
  const nextValue = nextInput.value.trim()
  const nextEntry = toAccessKeyEntry({ ...nextInput, value: nextValue })
  const supportsStableIds =
    currentResources.length === 0 || currentResources.every((item) => item.numericId != null)

  if (supportsStableIds) {
    try {
      await client.post('/api-keys', nextEntry)
      return
    } catch (error) {
      const apiError = toManagementApiError(error)
      if (apiError.status !== 404 && apiError.status !== 405) throw error
    }
  }

  await client.put('/api-keys', {
    api_key_entries: [...currentResources.map((item) => toAccessKeyEntry(item)), nextEntry],
  })
}

export async function updateAccessKey(
  session: ManagementSessionInput,
  resource: AccessKeyResource,
  value: string,
) {
  const client = createManagementClient(session)

  await client.patch('/api-keys', {
    ...(resource.numericId != null ? { id: resource.numericId } : { index: resource.index }),
    value: {
      api_key: value.trim(),
      user_id: resource.userId ?? 0,
      channels: resource.channelGroupIds,
      model_groups: resource.modelGroupIds,
    },
  })
}

export async function updateAccessKeyBindings(
  session: ManagementSessionInput,
  resource: AccessKeyResource,
  input: Omit<AccessKeyFormInput, 'value'>,
) {
  const client = createManagementClient(session)

  await client.patch('/api-keys', {
    ...(resource.numericId != null ? { id: resource.numericId } : { api_key: resource.value }),
    user_id: input.userId ?? 0,
    channels: input.channelGroupIds ?? [],
    model_groups: input.modelGroupIds ?? [],
  })
}

export async function replaceAccessKeys(session: ManagementSessionInput, values: string[]) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/api-keys')
  const currentEntries = readEntries(response.data)
    .map((item, index) => normalizeAccessKey(item, index))
    .filter((item) => item.value)
  const currentByValue = new Map(currentEntries.map((entry) => [entry.value, entry]))
  const nextEntries = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const currentEntry = currentByValue.get(value)

      return toAccessKeyEntry({
        value,
        userId: currentEntry?.userId ?? null,
        channelGroupIds: currentEntry?.channelGroupIds ?? [],
        modelGroupIds: currentEntry?.modelGroupIds ?? [],
      })
    })

  await client.put('/api-keys', { api_key_entries: nextEntries })
}

export async function deleteAccessKey(
  session: ManagementSessionInput,
  resource: AccessKeyResource,
) {
  const client = createManagementClient(session)

  await client.delete('/api-keys', {
    params: {
      ...(resource.numericId != null ? { id: resource.numericId } : { index: resource.index }),
    },
  })
}

export function toAccessKeyApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
