import { type UserAccount, normalizeUserAccount } from '@/lib/api/user/auth'
import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function updateUserEmail(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
  email: string,
): Promise<UserAccount> {
  const client = createUserClient(session)

  try {
    const response = await client.put<unknown>('/email', { email: email.trim() })
    const record = isRecord(response.data) ? response.data : {}
    return normalizeUserAccount(record.user)
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function requestUserEmailVerification(
  session: Required<Pick<UserSessionInput, 'token'>> & UserSessionInput,
) {
  const client = createUserClient(session)

  try {
    await client.post('/email/verification', {})
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function verifyUserEmail(token: string, session: UserSessionInput = {}) {
  const client = createUserClient(session)

  try {
    await client.post('/email/verify', { token })
  } catch (error) {
    throw toUserApiError(error)
  }
}
