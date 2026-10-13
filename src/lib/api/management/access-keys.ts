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
  displayName: string | null
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
  displayName?: string | null
  userId?: number | null
  channelGroupIds?: number[]
  modelGroupIds?: number[]
}

export type AccessKeyUpdateInput = {
  value?: string
  displayName?: string | null
}

export type AccessKeysSnapshot = {
  fetchedAt: string
  etag: string | null
  supportsDisplayNames: boolean
  resources: AccessKeyResource[]
}

export const ACCESS_KEY_DISPLAY_NAME_MAX_LENGTH = 128

function normalizeDisplayNameInput(displayName: string | null) {
  const trimmed = displayName?.trim() ?? ''
  return trimmed ? trimmed : null
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

export function readEntries(responseData: unknown): unknown[] {
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

export function normalizeAccessKey(value: unknown, index: number): AccessKeyResource {
  const record = isRecord(value) ? value : null
  const keyValue = record
    ? (readString(record, ['api_key', 'api-key', 'key', 'value']) ?? '')
    : typeof value === 'string'
      ? value
      : ''
  const trimmed = keyValue.trim()
  const numericId = record ? readNumber(record, ['id', 'api_key_id', 'api-key-id']) : null
  const identifier = numericId != null ? `api-key-${numericId}` : null
  const displayName = record ? readString(record, ['display_name']) : null

  return {
    id: numericId != null ? String(numericId) : `${index}:${trimmed}`,
    index,
    numericId,
    identifier,
    displayName: displayName ? displayName.trim() : null,
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
    // An omitted display_name preserves the stored name on replacement, so only
    // send the field when the caller set it explicitly.
    ...(input.displayName === undefined
      ? {}
      : { display_name: normalizeDisplayNameInput(input.displayName) }),
    user_id: input.userId ?? 0,
    channels: input.channelGroupIds ?? [],
    model_groups: input.modelGroupIds ?? [],
  }
}

export async function fetchAccessKeysSnapshot(
  session: ManagementSessionInput,
): Promise<AccessKeysSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/access/api-keys')
  const rawEtag: unknown = response.headers.etag
  const etag = typeof rawEtag === 'string' && rawEtag.trim() ? rawEtag.trim() : null
  const entries = readEntries(response.data)

  return {
    fetchedAt: new Date().toISOString(),
    etag,
    // Older Home versions omit display_name from every entry; an empty list
    // cannot disprove support, so keep the rename UI available there.
    supportsDisplayNames:
      entries.length === 0 || entries.some((entry) => isRecord(entry) && 'display_name' in entry),
    resources: entries.map((value, index) => normalizeAccessKey(value, index)),
  }
}

export async function createAccessKey(
  session: ManagementSessionInput,
  input: string | AccessKeyFormInput,
) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/access/api-keys')
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
      await client.post('/access/api-keys', nextEntry)
      return
    } catch (error) {
      const apiError = toManagementApiError(error)
      if (apiError.status !== 404 && apiError.status !== 405) throw error
    }
  }

  await client.put('/access/api-keys', {
    api_key_entries: [...currentResources.map((item) => toAccessKeyEntry(item)), nextEntry],
  })
}

export async function updateAccessKey(
  session: ManagementSessionInput,
  resource: AccessKeyResource,
  input: AccessKeyUpdateInput,
) {
  const client = createManagementClient(session)
  const nextValue = input.value?.trim()
  const displayNamePatch =
    input.displayName === undefined
      ? {}
      : { display_name: normalizeDisplayNameInput(input.displayName) }

  if (nextValue) {
    await client.patch('/access/api-keys', {
      ...(resource.numericId != null ? { id: resource.numericId } : { index: resource.index }),
      value: {
        api_key: nextValue,
        user_id: resource.userId ?? 0,
        channels: resource.channelGroupIds,
        model_groups: resource.modelGroupIds,
      },
      ...displayNamePatch,
    })
    return
  }

  // A rename-only patch keeps the key value, ownership, and scope bindings
  // untouched. The index selector requires a value payload, so fall back to
  // the raw key selector when no stable ID exists.
  await client.patch('/access/api-keys', {
    ...(resource.numericId != null ? { id: resource.numericId } : { api_key: resource.value }),
    ...displayNamePatch,
  })
}

export async function updateAccessKeyBindings(
  session: ManagementSessionInput,
  resource: AccessKeyResource,
  input: Omit<AccessKeyFormInput, 'value'>,
) {
  const client = createManagementClient(session)

  await client.patch('/access/api-keys', {
    ...(resource.numericId != null ? { id: resource.numericId } : { api_key: resource.value }),
    user_id: input.userId ?? 0,
    channels: input.channelGroupIds ?? [],
    model_groups: input.modelGroupIds ?? [],
  })
}

export async function replaceAccessKeys(
  session: ManagementSessionInput,
  values: string[],
  snapshot: AccessKeysSnapshot,
) {
  const client = createManagementClient(session)
  const currentEntries = snapshot.resources.filter((item) => item.value)
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

  await client.put(
    '/access/api-keys',
    { api_key_entries: nextEntries },
    { headers: snapshot.etag ? { 'If-Match': snapshot.etag } : undefined },
  )
}

export async function deleteAccessKey(
  session: ManagementSessionInput,
  resource: AccessKeyResource,
) {
  const client = createManagementClient(session)

  await client.delete('/access/api-keys', {
    params: {
      ...(resource.numericId != null ? { id: resource.numericId } : { index: resource.index }),
    },
  })
}

export function toAccessKeyApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
