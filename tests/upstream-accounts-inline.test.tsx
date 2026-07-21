import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  WebsocketsCell,
  buildInlineMetadataInput,
  isValidPriorityDraft,
} from '@/features/credentials/credential-inline-cells'
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
    selector: { name: `${provider}-01` },
    raw: {},
    ...overrides,
  }
}

describe('isValidPriorityDraft', () => {
  test('accepts integers, empty string (clear), and surrounding whitespace', () => {
    expect(isValidPriorityDraft('10')).toBe(true)
    expect(isValidPriorityDraft('0')).toBe(true)
    expect(isValidPriorityDraft('-1')).toBe(true)
    expect(isValidPriorityDraft(' 20 ')).toBe(true)
    expect(isValidPriorityDraft('')).toBe(true)
    expect(isValidPriorityDraft('   ')).toBe(true)
  })

  test('rejects non-integers', () => {
    expect(isValidPriorityDraft('abc')).toBe(false)
    expect(isValidPriorityDraft('1.5')).toBe(false)
    expect(isValidPriorityDraft('10px')).toBe(false)
    expect(isValidPriorityDraft('--1')).toBe(false)
  })
})

describe('buildInlineMetadataInput', () => {
  test('fills unchanged fields from the resource and applies the patch', () => {
    const resource = createCredentialResource('codex', {
      prefix: 'team',
      proxyUrl: 'socks5://127.0.0.1:1080',
      priority: 10,
      note: 'primary',
      websockets: true,
    })

    expect(buildInlineMetadataInput(resource, { proxyUrl: '' })).toEqual({
      prefix: 'team',
      proxyUrl: '',
      priority: '10',
      note: 'primary',
      websockets: true,
    })

    expect(buildInlineMetadataInput(resource, { websockets: false })).toEqual({
      prefix: 'team',
      proxyUrl: 'socks5://127.0.0.1:1080',
      priority: '10',
      note: 'primary',
      websockets: false,
    })
  })

  test('normalizes null fields to empty strings', () => {
    const resource = createCredentialResource('xai', {
      prefix: null,
      proxyUrl: null,
      priority: null,
      note: null,
    })

    expect(buildInlineMetadataInput(resource, { priority: '5' })).toEqual({
      prefix: '',
      proxyUrl: '',
      priority: '5',
      note: '',
      websockets: false,
    })
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
})
