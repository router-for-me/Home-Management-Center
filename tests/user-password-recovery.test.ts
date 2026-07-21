import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { consumeUserTokenFromHash } from '@/features/access/user-recovery-pages'
import { normalizeUserAccount, registerUser } from '@/lib/api/user/auth'
import { verifyUserEmail } from '@/lib/api/user/email'
import { resetUserPassword } from '@/lib/api/user/password-recovery'
import { changeUserPassword } from '@/lib/api/user/security'
import { useUserSessionStore } from '@/stores/user-session-store'

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
  useUserSessionStore.getState().reset()
})

describe('user email and recovery API normalization', () => {
  test('removes the sensitive token while preserving unrelated fragment search', () => {
    expect(
      consumeUserTokenFromHash(
        '#/user/reset-password?token=secret-token&source=mail&token=ignored-second',
      ),
    ).toEqual({
      token: 'secret-token',
      sensitiveParamPresent: true,
      cleanHash: '#/user/reset-password?source=mail',
    })
  })

  test('normalizes privacy-safe email status and legacy omissions', () => {
    expect(
      normalizeUserAccount({
        id: 1,
        username: 'alice',
        email_status: {
          configured: true,
          verified: false,
          masked: 'a***@example.com',
          recovery_ready: false,
        },
      }).emailStatus,
    ).toEqual({
      configured: true,
      verified: false,
      masked: 'a***@example.com',
      recoveryReady: false,
    })

    expect(normalizeUserAccount({ id: 2, username: 'legacy' }).emailStatus).toEqual({
      configured: false,
      verified: false,
      masked: '',
      recoveryReady: false,
    })
  })

  test('sends optional registration email only when provided', async () => {
    const requests: Array<Record<string, unknown>> = []
    axios.defaults.adapter = createRecordingAdapter(requests, () => authResponse('session-token'))

    await registerUser({ username: ' alice ', password: 'secret' })
    await registerUser({ username: ' alice ', password: 'secret', email: ' A@Example.com ' })

    expect(requests[0]?.body).toEqual({ username: 'alice', password: 'secret' })
    expect(requests[1]?.body).toEqual({
      username: 'alice',
      password: 'secret',
      email: 'A@Example.com',
    })
  })

  test('keeps verify and reset tokens in POST bodies instead of URLs', async () => {
    const requests: Array<Record<string, unknown>> = []
    axios.defaults.adapter = createRecordingAdapter(requests, () => ({ status: 'ok' }))

    await verifyUserEmail('verify-secret-token')
    await resetUserPassword({ token: 'reset-secret-token', newPassword: 'new-secret' })

    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/user/email/verify',
        body: { token: 'verify-secret-token' },
      },
      {
        method: 'POST',
        path: '/user/password/reset',
        body: { token: 'reset-secret-token', new_password: 'new-secret' },
      },
    ])
  })

  test('normalizes replacement session after an authenticated password change', async () => {
    axios.defaults.adapter = createRecordingAdapter([], () => authResponse('replacement-token'))

    await expect(
      changeUserPassword({ token: 'old-token' }, { newPassword: 'new-secret' }),
    ).resolves.toMatchObject({
      session: {
        token: 'replacement-token',
        expiresAt: '2026-07-21T00:00:00Z',
      },
      user: {
        username: 'alice',
      },
    })
  })

  test('keeps compatibility with an older password-change response without a token', async () => {
    axios.defaults.adapter = createRecordingAdapter([], () => ({
      status: 'ok',
      user: { id: 1, username: 'alice' },
    }))

    await expect(
      changeUserPassword({ token: 'legacy-token' }, { newPassword: 'new-secret' }),
    ).resolves.toMatchObject({
      session: null,
      user: { username: 'alice' },
    })
  })

  test('replaces token, expiry, and user in one session-store update', () => {
    const firstUser = normalizeUserAccount({ id: 1, username: 'alice' })
    const nextUser = normalizeUserAccount({
      id: 1,
      username: 'alice',
      email_status: {
        configured: true,
        verified: true,
        masked: 'a***@example.com',
        recovery_ready: true,
      },
    })
    useUserSessionStore
      .getState()
      .setAuthenticated(
        { token: 'old-token', expiresAt: '2026-07-21T00:00:00Z', user: firstUser },
        false,
      )

    useUserSessionStore.getState().replaceAuthenticatedSession({
      token: 'new-token',
      expiresAt: '2026-07-22T00:00:00Z',
      user: nextUser,
    })

    expect(useUserSessionStore.getState()).toMatchObject({
      status: 'authenticated',
      token: 'new-token',
      expiresAt: '2026-07-22T00:00:00Z',
      user: nextUser,
    })
  })
})

function authResponse(token: string) {
  return {
    token,
    expires_at: '2026-07-21T00:00:00Z',
    user: {
      id: 1,
      username: 'alice',
      email_status: {
        configured: false,
        verified: false,
        masked: '',
        recovery_ready: false,
      },
    },
  }
}

function createRecordingAdapter(
  requests: Array<Record<string, unknown>>,
  responseFor: () => unknown,
): AxiosAdapter {
  return async (config) => {
    const method = config.method?.toUpperCase() ?? 'GET'
    const path = requestPath(config.baseURL, config.url)
    requests.push({
      method,
      path,
      body: readRequestBody(config.data),
    })

    return {
      data: responseFor(),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
}

function requestPath(baseUrl?: string, path?: string) {
  if (baseUrl?.startsWith('/')) {
    return `${baseUrl.replace(/\/$/, '')}/${(path ?? '').replace(/^\//, '')}`
  }
  return new URL(path ?? '', baseUrl).pathname
}

function readRequestBody(value: unknown) {
  if (typeof value === 'string') return JSON.parse(value) as unknown
  return value
}
