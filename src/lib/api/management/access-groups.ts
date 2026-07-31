import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export type AccessGroupKind = 'channel' | 'model'

export type AccessGroupResource = {
  id: string
  numericId: number
  kind: AccessGroupKind
  name: string
  disabled: boolean
  deletedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  detailCount: number
  raw: unknown
}

export type AccessGroupDetailResource = {
  id: string
  numericId: number
  kind: AccessGroupKind
  groupId: number
  targetId: string
  /** Model kind only: bound channel group IDs; empty means the binding inherits the API key scope. */
  channels: number[]
  deletedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  raw: unknown
}

export type AccessGroupInput = {
  name: string
  disabled?: boolean
}

export type AccessGroupDetailInput = {
  groupId: number
  targetId: string
  /** Model kind only: channel group IDs to bind; omitted or empty keeps the API key scope. */
  channels?: number[]
}

type AccessGroupsSnapshot = {
  fetchedAt: string
  channelGroups: AccessGroupResource[]
  channelGroupDetails: AccessGroupDetailResource[]
  modelGroups: AccessGroupResource[]
  modelGroupDetails: AccessGroupDetailResource[]
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

function readBoolean(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return null
}

function readArrayRecords(responseData: unknown, keys: string[]) {
  const record = toRecord(responseData)

  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }

  return []
}

function readNumberArray(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is number => typeof item === 'number' && Number.isFinite(item),
      )
    }
  }

  return []
}

function normalizeGroup(
  kind: AccessGroupKind,
  record: UnknownRecord,
  index: number,
  detailCount: number,
): AccessGroupResource {
  const numericId = readNumber(record, ['id']) ?? index + 1
  const name =
    readString(record, [kind === 'channel' ? 'channel_name' : 'group_name', 'name', 'label']) ??
    `${kind}-group-${numericId}`
  const disabled = readBoolean(record, ['disabled']) ?? readBoolean(record, ['enabled']) === false

  return {
    id: String(numericId),
    numericId,
    kind,
    name,
    disabled,
    deletedAt: readString(record, ['deleted_at', 'deletedAt']),
    createdAt: readString(record, ['created_at', 'createdAt']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']),
    detailCount,
    raw: record,
  }
}

function normalizeDetail(
  kind: AccessGroupKind,
  record: UnknownRecord,
  index: number,
): AccessGroupDetailResource {
  const numericId = readNumber(record, ['id']) ?? index + 1
  const groupId =
    readNumber(record, [kind === 'channel' ? 'channel_group_id' : 'model_group_id', 'group_id']) ??
    0
  const targetId =
    readString(record, [kind === 'channel' ? 'auth_id' : 'model_id', 'target_id', 'value']) ?? ''

  return {
    id: String(numericId),
    numericId,
    kind,
    groupId,
    targetId,
    channels: kind === 'model' ? readNumberArray(record, ['channels']) : [],
    deletedAt: readString(record, ['deleted_at', 'deletedAt']),
    createdAt: readString(record, ['created_at', 'createdAt']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']),
    raw: record,
  }
}

function countDetails(details: AccessGroupDetailResource[], groupId: number) {
  return details.filter((detail) => detail.groupId === groupId && !detail.deletedAt).length
}

function groupPath(kind: AccessGroupKind) {
  return kind === 'channel' ? '/channel-groups' : '/model-groups'
}

function detailPath(kind: AccessGroupKind) {
  return kind === 'channel' ? '/channel-group-details' : '/model-group-details'
}

function toGroupPayload(kind: AccessGroupKind, input: AccessGroupInput) {
  return kind === 'channel'
    ? { channel_name: input.name.trim(), disabled: input.disabled ?? false }
    : { group_name: input.name.trim(), disabled: input.disabled ?? false }
}

function toDetailPayload(kind: AccessGroupKind, input: AccessGroupDetailInput) {
  if (kind === 'channel') {
    return { channel_group_id: input.groupId, auth_id: input.targetId.trim() }
  }

  return {
    model_group_id: input.groupId,
    model_id: input.targetId.trim(),
    // Empty means "inherit the API key scope"; the backend treats omitted and [] alike.
    ...(input.channels && input.channels.length > 0 ? { channels: input.channels } : {}),
  }
}

export async function fetchAccessGroupsSnapshot(
  session: ManagementSessionInput,
): Promise<AccessGroupsSnapshot> {
  const client = createManagementClient(session)
  const [channelGroupsResponse, channelDetailsResponse, modelGroupsResponse, modelDetailsResponse] =
    await Promise.all([
      client.get<unknown>('/channel-groups'),
      client.get<unknown>('/channel-group-details'),
      client.get<unknown>('/model-groups'),
      client.get<unknown>('/model-group-details'),
    ])
  const channelGroupDetails = readArrayRecords(channelDetailsResponse.data, [
    'channel_group_details',
    'items',
  ]).map((record, index) => normalizeDetail('channel', record, index))
  const modelGroupDetails = readArrayRecords(modelDetailsResponse.data, [
    'model_group_details',
    'items',
  ]).map((record, index) => normalizeDetail('model', record, index))
  const channelGroups = readArrayRecords(channelGroupsResponse.data, [
    'channel_groups',
    'items',
  ]).map((record, index) =>
    normalizeGroup(
      'channel',
      record,
      index,
      countDetails(channelGroupDetails, readNumber(record, ['id']) ?? index + 1),
    ),
  )
  const modelGroups = readArrayRecords(modelGroupsResponse.data, ['model_groups', 'items']).map(
    (record, index) =>
      normalizeGroup(
        'model',
        record,
        index,
        countDetails(modelGroupDetails, readNumber(record, ['id']) ?? index + 1),
      ),
  )

  return {
    fetchedAt: new Date().toISOString(),
    channelGroups,
    channelGroupDetails,
    modelGroups,
    modelGroupDetails,
  }
}

export async function createAccessGroup(
  session: ManagementSessionInput,
  kind: AccessGroupKind,
  input: AccessGroupInput,
) {
  const client = createManagementClient(session)
  await client.post(groupPath(kind), toGroupPayload(kind, input))
}

export async function updateAccessGroup(
  session: ManagementSessionInput,
  group: AccessGroupResource,
  input: AccessGroupInput,
) {
  const client = createManagementClient(session)
  await client.patch(
    `${groupPath(group.kind)}/${encodeURIComponent(group.id)}`,
    toGroupPayload(group.kind, input),
  )
}

export async function deleteAccessGroup(
  session: ManagementSessionInput,
  group: AccessGroupResource,
) {
  const client = createManagementClient(session)
  await client.delete(`${groupPath(group.kind)}/${encodeURIComponent(group.id)}`)
}

export async function createAccessGroupDetail(
  session: ManagementSessionInput,
  kind: AccessGroupKind,
  input: AccessGroupDetailInput,
) {
  const client = createManagementClient(session)
  await client.post(detailPath(kind), toDetailPayload(kind, input))
}

export async function deleteAccessGroupDetail(
  session: ManagementSessionInput,
  detail: AccessGroupDetailResource,
) {
  const client = createManagementClient(session)
  await client.delete(`${detailPath(detail.kind)}/${encodeURIComponent(detail.id)}`)
}

export function toAccessGroupsApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
