import { type UserAccount, normalizeUserAccount } from '@/lib/api/user/auth'
import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

type UnknownRecord = Record<string, unknown>

export type UserTotpSetup = {
  secret: string
  otpAuthUrl: string
  issuer: string
  period: number
  digits: number
  algorithm: string
  enabled: boolean
  raw: unknown
}

export type ChangePasswordInput = {
  newPassword: string
}

export type BindTotpInput = {
  secret: string
  code: string
  issuer?: string
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

function readBoolean(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return false
}

function readUserWriteResponse(value: unknown): UserAccount {
  const record = isRecord(value) ? value : {}
  return normalizeUserAccount(record.user)
}

function normalizeTotpSetup(value: unknown): UserTotpSetup {
  const record = isRecord(value) ? value : {}

  return {
    secret: readString(record, ['secret']) ?? '',
    otpAuthUrl: readString(record, ['otp_auth_url', 'otpAuthUrl']) ?? '',
    issuer: readString(record, ['issuer']) ?? 'CLIProxyAPIHome',
    period: readNumber(record, ['period']) ?? 30,
    digits: readNumber(record, ['digits']) ?? 6,
    algorithm: readString(record, ['algorithm']) ?? 'SHA1',
    enabled: readBoolean(record, ['enabled']),
    raw: value,
  }
}

export async function changeUserPassword(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  input: ChangePasswordInput,
) {
  const client = createUserClient(session)

  try {
    const response = await client.patch<unknown>('/password', {
      new_password: input.newPassword,
    })

    return readUserWriteResponse(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function fetchUserTotpSetup(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  input: { regenerate?: boolean } = {},
) {
  const client = createUserClient(session)

  try {
    const response = await client.get<unknown>('/totp', {
      params: {
        issuer: 'CLIProxyAPIHome',
        regenerate: input.regenerate ? 'true' : undefined,
      },
    })

    return normalizeTotpSetup(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function bindUserTotp(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  input: BindTotpInput,
) {
  const client = createUserClient(session)

  try {
    const response = await client.post<unknown>('/totp', {
      secret: input.secret.trim(),
      code: input.code.trim(),
      issuer: input.issuer?.trim() || 'CLIProxyAPIHome',
    })

    return readUserWriteResponse(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function deleteUserTotp(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
) {
  const client = createUserClient(session)

  try {
    const response = await client.delete<unknown>('/totp')
    return readUserWriteResponse(response.data)
  } catch (error) {
    throw toUserApiError(error)
  }
}
