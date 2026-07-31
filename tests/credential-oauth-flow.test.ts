import { describe, expect, test } from 'bun:test'

import {
  isCredentialOAuthFailure,
  isCredentialOAuthSuccess,
  normalizeCredentialOAuthStatus,
  resolveCredentialOAuthCallbackState,
} from '../src/features/credentials/credential-oauth-flow'

describe('credential OAuth flow helpers', () => {
  test('normalizes backend status values', () => {
    expect(normalizeCredentialOAuthStatus(' ok ')).toBe('ok')
    expect(normalizeCredentialOAuthStatus('WAIT')).toBe('wait')
    expect(normalizeCredentialOAuthStatus('Error')).toBe('error')
    expect(normalizeCredentialOAuthStatus('')).toBe('unknown')
    expect(normalizeCredentialOAuthStatus(null)).toBe('unknown')
    expect(normalizeCredentialOAuthStatus(undefined)).toBe('unknown')
  })

  test('classifies terminal statuses', () => {
    expect(isCredentialOAuthSuccess('ok')).toBe(true)
    expect(isCredentialOAuthSuccess('wait')).toBe(false)
    expect(isCredentialOAuthSuccess(null)).toBe(false)
    expect(isCredentialOAuthFailure('error')).toBe(true)
    expect(isCredentialOAuthFailure('ERROR')).toBe(true)
    expect(isCredentialOAuthFailure('wait')).toBe(false)
  })

  test('prefers the explicit state field for polling', () => {
    expect(
      resolveCredentialOAuthCallbackState({
        state: '  state-from-field  ',
        redirectUrl: 'http://localhost/callback?code=abc&state=state-from-url',
      }),
    ).toBe('state-from-field')
  })

  test('extracts the state from a pasted redirect URL', () => {
    expect(
      resolveCredentialOAuthCallbackState({
        state: '',
        redirectUrl: 'http://localhost/callback?code=abc&state=url-state',
      }),
    ).toBe('url-state')
    expect(
      resolveCredentialOAuthCallbackState({
        state: '   ',
        redirectUrl: 'http://localhost/callback#state=fragment-state&code=abc',
      }),
    ).toBe('fragment-state')
    expect(
      resolveCredentialOAuthCallbackState({
        state: '',
        redirectUrl: 'http://localhost/callback?state=encoded%20state',
      }),
    ).toBe('encoded state')
  })

  test('returns an empty state when the redirect URL carries none', () => {
    expect(
      resolveCredentialOAuthCallbackState({
        state: '',
        redirectUrl: 'http://localhost/callback?code=abc',
      }),
    ).toBe('')
    expect(resolveCredentialOAuthCallbackState({ state: '', redirectUrl: '' })).toBe('')
  })

  test('keeps malformed encoded state instead of throwing', () => {
    expect(
      resolveCredentialOAuthCallbackState({
        state: '',
        redirectUrl: 'http://localhost/callback?state=%E0%A4%A',
      }),
    ).toBe('%E0%A4%A')
  })
})
