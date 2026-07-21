import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { fetchUserCapabilities, normalizeUserCapabilities } from '@/lib/api/user/capabilities'

const defaultAxiosAdapter = axios.defaults.adapter

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

describe('user capability discovery', () => {
  test('normalizes capability and build fields', () => {
    expect(
      normalizeUserCapabilities({
        capabilities: {
          email_registration: true,
          email_verification: true,
          password_recovery: false,
        },
        server_info: {
          home_version: 'v1.2.3',
          home_commit: 'abcdef0',
          home_build_date: '2026-07-20',
        },
      }),
    ).toEqual({
      endpointSupported: true,
      emailRegistration: true,
      emailVerification: true,
      passwordRecovery: false,
      serverInfo: {
        homeVersion: 'v1.2.3',
        homeCommit: 'abcdef0',
        homeBuildDate: '2026-07-20',
      },
    })
  })

  test('treats a 404 as a legacy Home without permanently hiding network failures', async () => {
    axios.defaults.adapter = async (config) => {
      throw axiosResponseError(config, 404, { error: 'not_found' })
    }

    await expect(fetchUserCapabilities()).resolves.toEqual({
      endpointSupported: false,
      emailRegistration: false,
      emailVerification: false,
      passwordRecovery: false,
      serverInfo: {
        homeVersion: null,
        homeCommit: null,
        homeBuildDate: null,
      },
    })

    axios.defaults.adapter = async (config) => {
      throw axiosResponseError(config, 503, { error: 'service_unavailable' })
    }

    await expect(fetchUserCapabilities()).rejects.toMatchObject({
      status: 503,
      code: 'service_unavailable',
    })
  })

  test('reads the live capability response through the User API client', async () => {
    const adapter: AxiosAdapter = async (config) => ({
      data: {
        capabilities: {
          email_registration: false,
          email_verification: false,
          password_recovery: true,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
    axios.defaults.adapter = adapter

    await expect(fetchUserCapabilities()).resolves.toMatchObject({
      endpointSupported: true,
      emailRegistration: false,
      emailVerification: false,
      passwordRecovery: true,
    })
  })
})

function axiosResponseError(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return Object.assign(new Error(`request failed with status ${status}`), {
    isAxiosError: true,
    config,
    response: {
      data,
      status,
      statusText: String(status),
      headers: {},
      config,
    },
  })
}
