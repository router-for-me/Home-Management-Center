import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  getCredentialOAuthProviders,
  normalizeCredentialOAuthPluginProviders,
  startCredentialOAuth,
} from '../src/lib/api/management/credentials'

const defaultAxiosAdapter = axios.defaults.adapter
const session = { baseUrl: 'http://management.test', managementKey: 'test-management-key' }

afterEach(() => {
  axios.defaults.adapter = defaultAxiosAdapter
})

function respondToAuthUrl(responseData: unknown) {
  const params: unknown[] = []
  const adapter: AxiosAdapter = async (config) => {
    params.push(config.params)
    return { data: responseData, status: 200, statusText: 'OK', headers: {}, config }
  }
  axios.defaults.adapter = adapter

  return params
}

function oauthPlugin(fields: Record<string, unknown>) {
  return { supports_oauth: true, effective_enabled: true, ...fields }
}

describe('credential OAuth providers', () => {
  test('lists every built-in login with its Home flow', () => {
    expect(getCredentialOAuthProviders().map(({ id, flow }) => [id, flow])).toEqual([
      ['claude', 'browser'],
      ['codex', 'browser'],
      ['antigravity', 'browser'],
      ['kimi', 'device'],
      ['kimi-ai', 'device'],
      ['meta', 'device'],
      ['xai', 'browser'],
      ['devin', 'browser'],
    ])
  })

  test('reads plugin logins that are enabled, declare OAuth, and use a usable key', () => {
    const providers = normalizeCredentialOAuthPluginProviders({
      plugins: [
        oauthPlugin({
          id: 'sample',
          oauth_provider: ' Sample-Login ',
          metadata: { name: 'Sample Provider' },
        }),
        oauthPlugin({ id: 'disabled', effective_enabled: false, oauth_provider: 'disabled-login' }),
        oauthPlugin({ id: 'quota-only', supports_oauth: false, oauth_provider: 'quota-login' }),
        oauthPlugin({ id: 'invalid', oauth_provider: 'bad_key' }),
        oauthPlugin({ id: 'shadow', oauth_provider: 'codex' }),
        oauthPlugin({ id: 'duplicate', oauth_provider: 'sample-login' }),
        oauthPlugin({ id: 'unnamed', oauth_provider: 'unnamed-login' }),
      ],
    })

    expect(providers).toEqual([
      { id: 'sample-login', source: 'plugin', flow: 'browser', displayName: 'Sample Provider' },
      { id: 'unnamed-login', source: 'plugin', flow: 'browser', displayName: 'unnamed' },
    ])
  })

  test('prefers the oauth_providers list and per-login names', () => {
    const providers = normalizeCredentialOAuthPluginProviders({
      plugins: [
        oauthPlugin({
          id: 'multi',
          oauth_provider: 'multi-a',
          oauth_providers: ['multi-a', 'multi-b'],
          oauth_provider_entries: [{ identifier: 'multi-a', name: 'Multi Alpha' }],
          metadata: { name: 'Multi Plugin' },
        }),
      ],
    })

    expect(providers.map(({ id, displayName }) => [id, displayName])).toEqual([
      ['multi-a', 'Multi Alpha'],
      ['multi-b', 'Multi Plugin (multi-b)'],
    ])
  })

  test('marks only built-in browser logins as WebUI starts', async () => {
    const params = respondToAuthUrl({
      status: 'ok',
      url: 'https://login.example/authorize',
      state: 'state-1',
    })

    for (const provider of ['claude', 'kimi-ai', 'meta', 'sample-login']) {
      await startCredentialOAuth(session, { provider })
    }

    expect(params).toEqual([
      { provider: 'claude', is_webui: true },
      { provider: 'kimi-ai' },
      { provider: 'meta' },
      { provider: 'sample-login' },
    ])
  })

  test('takes the session flow from the auth-url response before the provider default', async () => {
    respondToAuthUrl({
      status: 'ok',
      url: 'https://accounts.x.ai/device',
      state: 'xai-1',
      flow: 'device',
      user_code: ' ABCD-EFGH ',
    })
    await expect(startCredentialOAuth(session, { provider: 'xai' })).resolves.toMatchObject({
      flow: 'device',
      userCode: 'ABCD-EFGH',
    })

    respondToAuthUrl({ status: 'ok', url: 'https://accounts.x.ai/oauth2/auth', state: 'xai-2' })
    await expect(startCredentialOAuth(session, { provider: 'xai' })).resolves.toMatchObject({
      flow: 'browser',
      userCode: null,
    })

    respondToAuthUrl({ status: 'ok', url: 'https://meta.example/device', state: 'mta-1' })
    await expect(startCredentialOAuth(session, { provider: 'meta' })).resolves.toMatchObject({
      flow: 'device',
      userCode: null,
    })

    respondToAuthUrl({ status: 'ok', url: 'https://plugin.example/login', state: 'plugin-1' })
    await expect(
      startCredentialOAuth(session, { provider: 'sample-login' }),
    ).resolves.toMatchObject({ flow: 'browser', userCode: null })
  })
})
