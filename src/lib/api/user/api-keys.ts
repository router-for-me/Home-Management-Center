import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

type UnknownRecord = Record<string, unknown>

export type UserApiKeyResource = {
  id: number | null
  key: string
  maskedKey: string
  channelGroupIds: number[]
  modelGroupIds: number[]
  createdAt: string | null
  updatedAt: string | null
  raw: unknown
}

export type UserApiKeyInput = {
  key?: string
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function readNumberArray(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (!Array.isArray(value)) continue

    return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
  }

  return []
}

function readArrayRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []

  for (const key of ['api_keys', 'api-keys', 'items', 'data']) {
    const nextValue = value[key]
    if (Array.isArray(nextValue)) return nextValue.filter(isRecord)
  }

  return []
}

function maskApiKey(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return ''
  if (trimmed.length <= 12) return `${trimmed.slice(0, 3)}***`

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`
}

function normalizeApiKey(value: unknown): UserApiKeyResource {
  const record = isRecord(value) ? value : {}
  const key = readString(record, ['api_key', 'api-key', 'key', 'value']) ?? ''

  return {
    id: readNumber(record, ['id']),
    key,
    maskedKey: maskApiKey(key),
    channelGroupIds: readNumberArray(record, ['channels']),
    modelGroupIds: readNumberArray(record, ['model_groups', 'model-groups']),
    createdAt: readString(record, ['created_at', 'createdAt']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']),
    raw: value,
  }
}

function readApiKeyResponse(value: unknown) {
  if (isRecord(value) && value.api_key) {
    return normalizeApiKey(value.api_key)
  }

  return normalizeApiKey(value)
}

export async function fetchUserApiKeys(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
) {
  const client = createUserClient(session)

  try {
    const response = await client.get<unknown>('/api-keys')
    return readArrayRecords(response.data).map(normalizeApiKey)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function createUserApiKey(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  input: UserApiKeyInput = {},
) {
  const client = createUserClient(session)
  const key = input.key?.trim()

  try {
    const response = await client.post<unknown>('/api-keys', key ? { api_key: key } : {})
    return readApiKeyResponse(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function updateUserApiKey(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  resource: UserApiKeyResource,
  input: UserApiKeyInput,
) {
  const client = createUserClient(session)
  const key = input.key?.trim()

  try {
    const response =
      resource.id !== null
        ? await client.patch<unknown>(`/api-keys/${resource.id}`, key ? { api_key: key } : {})
        : await client.patch<unknown>('/api-keys', {
            old: resource.key,
            ...(key ? { new_api_key: key } : {}),
          })

    return readApiKeyResponse(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function deleteUserApiKey(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  resource: UserApiKeyResource,
) {
  const client = createUserClient(session)

  try {
    if (resource.id !== null) {
      await client.delete(`/api-keys/${resource.id}`)
      return
    }

    await client.delete('/api-keys', {
      params: {
        api_key: resource.key,
      },
    })
  } catch (error) {
    throw toUserApiError(error)
  }
}
