import { describe, expect, test } from 'bun:test'

import {
  type CredentialFilterState,
  filterCredentialResources,
  hasCredentialFilters,
} from '@/features/credentials/credential-filters'
import type { UpstreamQuotaEntry } from '@/features/upstream/upstream-quota-model'
import type { CredentialResource } from '@/lib/api/management/credentials'

function createCredential(
  id: string,
  overrides: Partial<CredentialResource> = {},
): CredentialResource {
  return {
    id,
    index: 0,
    identifier: id,
    name: id,
    authIndex: id,
    provider: 'codex',
    type: 'oauth',
    label: null,
    status: 'active',
    statusMessage: null,
    disabled: false,
    unavailable: false,
    runtimeOnly: false,
    source: 'db',
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
    priority: null,
    note: null,
    prefix: null,
    proxyUrl: null,
    websockets: false,
    metadataAvailability: {
      prefix: false,
      proxyUrl: false,
      websockets: true,
    },
    maxInFlight: null,
    maxInFlightByModel: {},
    concurrencyFieldsValid: true,
    selector: {},
    raw: {},
    ...overrides,
  }
}

function createQuotaEntry(status: UpstreamQuotaEntry['status']): UpstreamQuotaEntry {
  return {
    status,
    freshness: 'fresh',
    collectionStatus: 'success',
  } as UpstreamQuotaEntry
}

const defaultFilters: CredentialFilterState = {
  search: '',
  statusFilter: 'all',
  providerFilter: 'all',
  quotaAvailable: true,
  attentionOnly: false,
  websocketOnly: false,
}

describe('credential resource filters', () => {
  test('combines attention and WebSocket filters instead of treating them as exclusive views', () => {
    const resources = [
      createCredential('attention-ws', { websockets: true }),
      createCredential('attention-http'),
      createCredential('healthy-ws', { provider: 'xai', websockets: true }),
    ]
    const quotaMap = new Map<string, UpstreamQuotaEntry>([
      ['attention-ws', createQuotaEntry('low')],
      ['attention-http', createQuotaEntry('error')],
      ['healthy-ws', createQuotaEntry('healthy')],
    ])

    expect(
      filterCredentialResources(resources, quotaMap, {
        ...defaultFilters,
        attentionOnly: true,
        websocketOnly: true,
      }).map((resource) => resource.id),
    ).toEqual(['attention-ws'])
  })

  test('keeps WebSocket filtering available when quota capability is absent', () => {
    const resources = [createCredential('ws', { websockets: true }), createCredential('http')]

    expect(
      filterCredentialResources(resources, new Map(), {
        ...defaultFilters,
        quotaAvailable: false,
        attentionOnly: true,
        websocketOnly: true,
      }).map((resource) => resource.id),
    ).toEqual(['ws'])
  })

  test('composes search, status, and provider filters', () => {
    const resources = [
      createCredential('disabled-codex', {
        label: 'Backup Alpha',
        disabled: true,
      }),
      createCredential('disabled-xai', {
        label: 'Backup Alpha',
        provider: 'xai',
        disabled: true,
      }),
      createCredential('active-codex', { label: 'Primary Alpha' }),
    ]

    expect(
      filterCredentialResources(resources, new Map(), {
        ...defaultFilters,
        search: ' backup ',
        statusFilter: 'disabled',
        providerFilter: 'codex',
      }).map((resource) => resource.id),
    ).toEqual(['disabled-codex'])
  })

  test('does not count a hidden quota condition as an active filter', () => {
    expect(
      hasCredentialFilters({
        ...defaultFilters,
        quotaAvailable: false,
        attentionOnly: true,
      }),
    ).toBe(false)
    expect(hasCredentialFilters({ ...defaultFilters, websocketOnly: true })).toBe(true)
  })
})
