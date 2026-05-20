import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementSessionInput } from '@/lib/api/management/types'

type AccessKeysResponse = {
  'api-keys'?: unknown[]
}

export type AccessKeyResource = {
  id: string
  index: number
  value: string
  maskedValue: string
  prefix: string
  suffix: string
  length: number
}

type AccessKeysSnapshot = {
  fetchedAt: string
  resources: AccessKeyResource[]
}

function readKeys(responseData: unknown): string[] {
  const response = responseData as AccessKeysResponse

  return Array.isArray(response['api-keys'])
    ? response['api-keys'].filter((item): item is string => typeof item === 'string')
    : []
}

function maskAccessKey(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return ''
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}***`

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`
}

function normalizeAccessKey(value: string, index: number): AccessKeyResource {
  const trimmed = value.trim()

  return {
    id: `${index}:${trimmed}`,
    index,
    value: trimmed,
    maskedValue: maskAccessKey(trimmed),
    prefix: trimmed.slice(0, 6),
    suffix: trimmed.slice(-4),
    length: trimmed.length,
  }
}

export async function fetchAccessKeysSnapshot(
  session: ManagementSessionInput,
): Promise<AccessKeysSnapshot> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/api-keys')

  return {
    fetchedAt: new Date().toISOString(),
    resources: readKeys(response.data).map((value, index) => normalizeAccessKey(value, index)),
  }
}

export async function createAccessKey(session: ManagementSessionInput, value: string) {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/api-keys')
  const currentKeys = readKeys(response.data)
    .map((item) => item.trim())
    .filter(Boolean)
  const nextValue = value.trim()

  await client.put('/api-keys', [...currentKeys, nextValue])
}

export async function updateAccessKey(
  session: ManagementSessionInput,
  resource: AccessKeyResource,
  value: string,
) {
  const client = createManagementClient(session)

  await client.patch('/api-keys', {
    index: resource.index,
    value: value.trim(),
  })
}

export async function replaceAccessKeys(session: ManagementSessionInput, values: string[]) {
  const client = createManagementClient(session)
  await client.put('/api-keys', values.map((value) => value.trim()).filter(Boolean))
}

export async function deleteAccessKey(
  session: ManagementSessionInput,
  resource: AccessKeyResource,
) {
  const client = createManagementClient(session)

  await client.delete('/api-keys', {
    params: {
      index: resource.index,
    },
  })
}

export function toAccessKeyApiError(error: unknown) {
  const apiError = toManagementApiError(error)
  return new Error(apiError.message, { cause: error })
}
