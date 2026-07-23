import { createManagementClient, toManagementApiError } from '@/lib/api/management/client'
import type { ManagementApiError, ManagementSessionInput } from '@/lib/api/management/types'

type UnknownRecord = Record<string, unknown>

export const pluginStoreAuthTypes = ['none', 'bearer', 'basic', 'header', 'github-token'] as const

export const pluginStoreAuthScopes = ['registry', 'metadata', 'artifact'] as const

export type PluginStoreAuthType = (typeof pluginStoreAuthTypes)[number]
export type PluginStoreAuthScope = (typeof pluginStoreAuthScopes)[number]

export type PluginStoreAuthRule = {
  id: number
  name: string
  match: string
  applyTo: PluginStoreAuthScope[]
  authType: PluginStoreAuthType
  headerName: string
  enabled: boolean
  version: number
  credentialsConfigured: boolean
}

type PluginStoreAuthList = {
  items: PluginStoreAuthRule[]
}

export type PluginStoreAuthCreateInput = {
  name: string
  match: string
  applyTo: PluginStoreAuthScope[]
  authType: PluginStoreAuthType
  token?: string
  username?: string
  password?: string
  headerName?: string
  headerValue?: string
  enabled: boolean
}

export type PluginStoreAuthUpdateInput = Partial<PluginStoreAuthCreateInput>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRequiredString(record: UnknownRecord, key: string) {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('invalid plugin store auth response')
  }
  return value.trim()
}

function readOptionalString(record: UnknownRecord, key: string) {
  const value = record[key]
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new Error('invalid plugin store auth response')
  return value.trim()
}

function readSafeInteger(record: UnknownRecord, key: string, minimum: number) {
  const value = record[key]
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error('invalid plugin store auth response')
  }
  return value as number
}

function readBoolean(record: UnknownRecord, key: string) {
  const value = record[key]
  if (typeof value !== 'boolean') throw new Error('invalid plugin store auth response')
  return value
}

function normalizeAuthType(value: unknown): PluginStoreAuthType {
  if (
    typeof value !== 'string' ||
    !pluginStoreAuthTypes.includes(value.trim().toLowerCase() as PluginStoreAuthType)
  ) {
    throw new Error('invalid plugin store auth response')
  }
  return value.trim().toLowerCase() as PluginStoreAuthType
}

function normalizeScopes(value: unknown): PluginStoreAuthScope[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('invalid plugin store auth response')

  return value.map((item) => {
    if (
      typeof item !== 'string' ||
      !pluginStoreAuthScopes.includes(item.trim().toLowerCase() as PluginStoreAuthScope)
    ) {
      throw new Error('invalid plugin store auth response')
    }
    return item.trim().toLowerCase() as PluginStoreAuthScope
  })
}

function normalizePluginStoreAuthRule(value: unknown): PluginStoreAuthRule {
  if (!isRecord(value)) throw new Error('invalid plugin store auth response')

  return {
    id: readSafeInteger(value, 'id', 1),
    name: readRequiredString(value, 'name'),
    match: readRequiredString(value, 'match'),
    applyTo: normalizeScopes(value.apply_to),
    authType: normalizeAuthType(value.auth_type),
    headerName: readOptionalString(value, 'header_name'),
    enabled: readBoolean(value, 'enabled'),
    version: readSafeInteger(value, 'version', 1),
    credentialsConfigured: readBoolean(value, 'credentials_configured'),
  }
}

function normalizePluginStoreAuthList(value: unknown): PluginStoreAuthList {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('invalid plugin store auth response')
  }
  return { items: value.items.map(normalizePluginStoreAuthRule) }
}

function toRequestBody(input: PluginStoreAuthCreateInput | PluginStoreAuthUpdateInput) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.match !== undefined ? { match: input.match } : {}),
    ...(input.applyTo !== undefined ? { apply_to: input.applyTo } : {}),
    ...(input.authType !== undefined ? { auth_type: input.authType } : {}),
    ...(input.token !== undefined ? { token: input.token } : {}),
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.password !== undefined ? { password: input.password } : {}),
    ...(input.headerName !== undefined ? { header_name: input.headerName } : {}),
    ...(input.headerValue !== undefined ? { header_value: input.headerValue } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
  }
}

export async function fetchPluginStoreAuthRules(
  session: ManagementSessionInput,
): Promise<PluginStoreAuthList> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>('/plugin-store-auth')
  return normalizePluginStoreAuthList(response.data)
}

export async function fetchPluginStoreAuthRule(
  session: ManagementSessionInput,
  id: number,
): Promise<PluginStoreAuthRule> {
  const client = createManagementClient(session)
  const response = await client.get<unknown>(`/plugin-store-auth/${encodeURIComponent(String(id))}`)
  return normalizePluginStoreAuthRule(response.data)
}

export async function createPluginStoreAuthRule(
  session: ManagementSessionInput,
  input: PluginStoreAuthCreateInput,
): Promise<PluginStoreAuthRule> {
  const client = createManagementClient(session)
  const response = await client.post<unknown>('/plugin-store-auth', toRequestBody(input))
  return normalizePluginStoreAuthRule(response.data)
}

export async function updatePluginStoreAuthRule(
  session: ManagementSessionInput,
  id: number,
  input: PluginStoreAuthUpdateInput,
): Promise<PluginStoreAuthRule> {
  const client = createManagementClient(session)
  const response = await client.patch<unknown>(
    `/plugin-store-auth/${encodeURIComponent(String(id))}`,
    toRequestBody(input),
  )
  return normalizePluginStoreAuthRule(response.data)
}

export async function deletePluginStoreAuthRule(
  session: ManagementSessionInput,
  id: number,
): Promise<void> {
  const client = createManagementClient(session)
  await client.delete(`/plugin-store-auth/${encodeURIComponent(String(id))}`)
}

export function toPluginStoreAuthApiError(error: unknown): ManagementApiError {
  return toManagementApiError(error)
}
