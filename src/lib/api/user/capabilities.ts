import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

type UnknownRecord = Record<string, unknown>

type UserCapabilities = {
  endpointSupported: boolean
  emailRegistration: boolean
  emailVerification: boolean
  passwordRecovery: boolean
  modelCatalog: boolean
  serverInfo: {
    homeVersion: string | null
    homeCommit: string | null
    homeBuildDate: string | null
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBoolean(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return false
}

function readString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function legacyUserCapabilities(): UserCapabilities {
  return {
    endpointSupported: false,
    emailRegistration: false,
    emailVerification: false,
    passwordRecovery: false,
    modelCatalog: false,
    serverInfo: {
      homeVersion: null,
      homeCommit: null,
      homeBuildDate: null,
    },
  }
}

export function normalizeUserCapabilities(value: unknown): UserCapabilities {
  const record = isRecord(value) ? value : {}
  const capabilities = isRecord(record.capabilities) ? record.capabilities : record
  const serverInfo = isRecord(record.server_info)
    ? record.server_info
    : isRecord(record.serverInfo)
      ? record.serverInfo
      : {}

  return {
    endpointSupported: true,
    emailRegistration: readBoolean(capabilities, ['email_registration', 'emailRegistration']),
    emailVerification: readBoolean(capabilities, ['email_verification', 'emailVerification']),
    passwordRecovery: readBoolean(capabilities, ['password_recovery', 'passwordRecovery']),
    // A Home that predates the catalog omits this flag entirely, and readBoolean
    // reports a missing flag as false. That is the intended reading: the client
    // hides the catalog rather than calling a route that is not there and having
    // to tell a 404 apart from an outage.
    modelCatalog: readBoolean(capabilities, ['model_catalog', 'modelCatalog']),
    serverInfo: {
      homeVersion: readString(serverInfo, ['home_version', 'homeVersion']),
      homeCommit: readString(serverInfo, ['home_commit', 'homeCommit']),
      homeBuildDate: readString(serverInfo, ['home_build_date', 'homeBuildDate']),
    },
  }
}

export async function fetchUserCapabilities(
  session: UserSessionInput = {},
): Promise<UserCapabilities> {
  const client = createUserClient(session)

  try {
    const response = await client.get<unknown>('/capabilities')
    return normalizeUserCapabilities(response.data)
  } catch (error) {
    const apiError = toUserApiError(error)
    if (apiError.status === 404) return legacyUserCapabilities()
    throw apiError
  }
}
