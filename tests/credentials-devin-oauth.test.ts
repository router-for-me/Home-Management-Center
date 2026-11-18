import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  getCredentialOAuthProviders,
  startCredentialOAuth,
  submitCredentialOAuthCallback,
} from '../src/lib/api/management/credentials'

type CapturedRequest = {
  method: string
  url: string | undefined
  params: unknown
  body: unknown
}

const defaultAxiosAdapter = axios.defaults.adapter
const session = { baseUrl: 'http://management.test', managementKey: 'test-management-key' }

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

function captureRequests(responseData: unknown) {
  const requests: CapturedRequest[] = []
  const adapter: AxiosAdapter = async (config) => {
    requests.push({
      method: config.method?.toUpperCase() ?? 'GET',
      url: config.url,
      params: config.params,
      body: typeof config.data === 'string' ? (JSON.parse(config.data) as unknown) : null,
    })

    return { data: responseData, status: 200, statusText: 'OK', headers: {}, config }
  }
  axios.defaults.adapter = adapter

  return requests
}

describe('Devin credential OAuth', () => {
  test('offers Devin login in Home and direct CPA runtimes', () => {
    for (const runtimeMode of ['cpa', 'home-standalone', 'home-cluster'] as const) {
      expect(getCredentialOAuthProviders(runtimeMode)).toContain('devin')
    }
  })

  test('starts through the shared auth-url route and submits the pasted callback URL as is', async () => {
    const authorizationUrl = 'https://app.devin.ai/auth/cli/continue?state=dvn-state'
    const requests = captureRequests({ status: 'ok', url: authorizationUrl, state: 'dvn-state' })

    await expect(startCredentialOAuth(session, { provider: 'devin' })).resolves.toEqual({
      provider: 'devin',
      url: authorizationUrl,
      state: 'dvn-state',
    })

    const redirectUrl = 'http://127.0.0.1:57121/callback?code=devin-code&state=dvn-state'
    await submitCredentialOAuthCallback(session, {
      provider: 'devin',
      redirectUrl: ` ${redirectUrl} `,
      code: '',
      state: 'dvn-state',
      error: '',
    })

    expect(requests).toEqual([
      {
        method: 'GET',
        url: '/oauth/auth-url',
        params: { provider: 'devin', is_webui: true },
        body: null,
      },
      {
        method: 'POST',
        url: '/oauth/callback',
        params: undefined,
        body: {
          provider: 'devin',
          redirect_url: redirectUrl,
          code: '',
          state: 'dvn-state',
          error: '',
        },
      },
    ])
  })
})
