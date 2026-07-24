import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  buildCredentialMetadataPatch,
  isValidCredentialPriorityDraft,
} from '@/features/credentials/credential-detail-drawer'
import { WebsocketsCell } from '@/features/credentials/credential-inline-cells'
import type { CredentialResource } from '@/lib/api/management/credentials'
import '@/lib/i18n/i18n'

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

describe('buildCredentialMetadataPatch', () => {
  test('includes only changed metadata fields', () => {
    const resource = createCredentialResource('codex', {
      prefix: 'team',
      proxyUrl: 'socks5://127.0.0.1:1080',
      priority: 10,
      note: 'primary',
      websockets: true,
    })

    expect(
      buildCredentialMetadataPatch(resource, {
        prefix: 'team',
        proxyUrl: '',
        priority: '10',
        note: 'primary',
        websockets: false,
        maxInFlight: '',
        maxInFlightByModel: [],
      }),
    ).toEqual({ proxyUrl: '', websockets: false })
  })

  test('uses null only when clearing a stored priority', () => {
    const resource = createCredentialResource('xai', { priority: 5 })

    expect(
      buildCredentialMetadataPatch(resource, {
        prefix: 'team',
        proxyUrl: 'socks5://127.0.0.1:1080',
        priority: '',
        note: '',
        websockets: false,
        maxInFlight: '',
        maxInFlightByModel: [],
      }),
    ).toMatchObject({ priority: null })
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
        <WebsocketsCell
          resource={createCredentialResource(provider)}
          mutating={false}
          onSave={noopSave}
        />,
      )
      expect(markup).toContain('role="switch"')
    }
  })

  test('renders n/a for providers without websocket support', () => {
    const markup = renderToStaticMarkup(
      <WebsocketsCell
        resource={createCredentialResource('gemini')}
        mutating={false}
        onSave={noopSave}
      />,
    )
    expect(markup).not.toContain('role="switch"')
    expect(markup).toContain('n/a')
  })

  test('does not render a false switch state when the backend omitted websocket metadata', () => {
    const markup = renderToStaticMarkup(
      <WebsocketsCell
        resource={createCredentialResource('codex', {
          metadataAvailability: { prefix: false, proxyUrl: false, websockets: false },
        })}
        mutating={false}
        onSave={noopSave}
      />,
    )
    expect(markup).not.toContain('role="switch"')
    expect(markup).toContain('N/A')
  })
})
