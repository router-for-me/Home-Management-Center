import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import {
  buildCredentialMetadataPatch,
  isValidCredentialPriorityDraft,
  isValidCredentialRequestRetryDraft,
} from '@/features/credentials/credential-detail-drawer'
import { WebsocketsCell } from '@/features/credentials/credential-inline-cells'
import type { CredentialResource } from '@/lib/api/management/credentials'
import { en } from '@/lib/i18n/locales/en'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    resources: { en },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
})

function createCredentialResource(
  provider: string,
  overrides: Partial<CredentialResource> = {},
): CredentialResource {
  return {
    id: `${provider}-01`,
    index: 0,
    identifier: `${provider}-01`,
    name: `${provider}-01`,
    authIndex: `${provider}-01`,
    provider,
    type: 'oauth',
    label: null,
    status: 'active',
    statusMessage: null,
    disabled: false,
    unavailable: false,
    runtimeOnly: false,
    source: 'oauth',
    size: null,
    email: null,
    accountType: null,
    account: null,
    createdAt: null,
    updatedAt: null,
    modifiedAt: null,
    lastRefresh: null,
    nextRetryAfter: null,
    success: null,
    failed: null,
    path: null,
    priority: 10,
    requestRetry: null,
    note: null,
    prefix: 'team',
    proxyUrl: 'socks5://127.0.0.1:1080',
    websockets: false,
    metadataAvailability: {
      prefix: true,
      proxyUrl: true,
      websockets: true,
    },
    selector: { name: `${provider}-01` },
    raw: {},
    ...overrides,
  }
}

describe('isValidCredentialPriorityDraft', () => {
  test('accepts integers, empty string (clear), and surrounding whitespace', () => {
    expect(isValidCredentialPriorityDraft('10')).toBe(true)
    expect(isValidCredentialPriorityDraft('0')).toBe(true)
    expect(isValidCredentialPriorityDraft('-1')).toBe(true)
    expect(isValidCredentialPriorityDraft(' 20 ')).toBe(true)
    expect(isValidCredentialPriorityDraft('')).toBe(true)
    expect(isValidCredentialPriorityDraft('   ')).toBe(true)
  })

  test('rejects non-integers', () => {
    expect(isValidCredentialPriorityDraft('abc')).toBe(false)
    expect(isValidCredentialPriorityDraft('1.5')).toBe(false)
    expect(isValidCredentialPriorityDraft('10px')).toBe(false)
    expect(isValidCredentialPriorityDraft('--1')).toBe(false)
    expect(isValidCredentialPriorityDraft('9007199254740992')).toBe(false)
  })
})

describe('isValidCredentialRequestRetryDraft', () => {
  test('accepts non-negative integers, empty string (clear/inherit), and surrounding whitespace', () => {
    expect(isValidCredentialRequestRetryDraft('0')).toBe(true)
    expect(isValidCredentialRequestRetryDraft('1')).toBe(true)
    expect(isValidCredentialRequestRetryDraft('5')).toBe(true)
    expect(isValidCredentialRequestRetryDraft(' 10 ')).toBe(true)
    expect(isValidCredentialRequestRetryDraft('')).toBe(true)
    expect(isValidCredentialRequestRetryDraft('   ')).toBe(true)
  })

  test('rejects negative numbers, non-integers, and malformed strings', () => {
    expect(isValidCredentialRequestRetryDraft('-1')).toBe(false)
    expect(isValidCredentialRequestRetryDraft('abc')).toBe(false)
    expect(isValidCredentialRequestRetryDraft('1.5')).toBe(false)
    expect(isValidCredentialRequestRetryDraft('2x')).toBe(false)
  })
})

describe('buildCredentialMetadataPatch', () => {
  test('includes only changed metadata fields', () => {
    const resource = createCredentialResource('codex', {
      prefix: 'team',
      proxyUrl: 'socks5://127.0.0.1:1080',
      priority: 10,
      requestRetry: 2,
      note: 'primary',
      websockets: true,
    })

    expect(
      buildCredentialMetadataPatch(resource, {
        prefix: 'team',
        proxyUrl: '',
        priority: '10',
        requestRetry: '2',
        note: 'primary',
        websockets: false,
        maxInFlight: '',
        maxInFlightByModel: [],
      }),
    ).toEqual({ proxyUrl: '', websockets: false })
  })

  test('uses null only when clearing a stored priority or request-retry', () => {
    const resource = createCredentialResource('xai', { priority: 5, requestRetry: 3 })

    expect(
      buildCredentialMetadataPatch(resource, {
        prefix: 'team',
        proxyUrl: 'socks5://127.0.0.1:1080',
        priority: '',
        requestRetry: '',
        note: '',
        websockets: false,
        maxInFlight: '',
        maxInFlightByModel: [],
      }),
    ).toMatchObject({ priority: null, requestRetry: null })
  })

  test('preserves metadata omitted by an older backend when another field changes', () => {
    const resource = createCredentialResource('codex', {
      prefix: null,
      proxyUrl: null,
      websockets: false,
      metadataAvailability: { prefix: false, proxyUrl: false, websockets: false },
    })

    expect(
      buildCredentialMetadataPatch(resource, {
        prefix: '',
        proxyUrl: '',
        priority: '10',
        requestRetry: '',
        note: 'updated note',
        websockets: true,
        maxInFlight: '',
        maxInFlightByModel: [],
      }),
    ).toEqual({ note: 'updated note' })
  })
})

describe('WebsocketsCell', () => {
  const noopSave = async () => {}

  test('renders a switch for codex and xai credentials', () => {
    for (const provider of ['codex', 'xai']) {
      const markup = renderToStaticMarkup(
        <I18nextProvider i18n={testI18n}>
          <WebsocketsCell
            resource={createCredentialResource(provider)}
            mutating={false}
            onSave={noopSave}
          />
        </I18nextProvider>,
      )
      expect(markup).toContain('role="switch"')
    }
  })

  test('renders n/a for providers without websocket support', () => {
    const markup = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <WebsocketsCell
          resource={createCredentialResource('gemini')}
          mutating={false}
          onSave={noopSave}
        />
      </I18nextProvider>,
    )
    expect(markup).not.toContain('role="switch"')
    expect(markup).toContain('n/a')
  })

  test('does not render a false switch state when the backend omitted websocket metadata', () => {
    const markup = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <WebsocketsCell
          resource={createCredentialResource('codex', {
            metadataAvailability: { prefix: false, proxyUrl: false, websockets: false },
          })}
          mutating={false}
          onSave={noopSave}
        />
      </I18nextProvider>,
    )
    expect(markup).not.toContain('role="switch"')
    expect(markup).toContain('N/A')
  })
})
