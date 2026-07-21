import { type UserSessionInput, createUserClient, toUserApiError } from '@/lib/api/user/client'

export async function requestUserPasswordReset(email: string, session: UserSessionInput = {}) {
  const client = createUserClient(session)

  try {
    await client.post('/password/forgot', { email: email.trim() })
  } catch (error) {
    throw toUserApiError(error)
  }
}

export async function resetUserPassword(
  input: { token: string; newPassword: string },
  session: UserSessionInput = {},
) {
  const client = createUserClient(session)

  try {
    await client.post('/password/reset', {
      token: input.token,
      new_password: input.newPassword,
    })
  } catch (error) {
    throw toUserApiError(error)
  }
}
