import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { TooltipProvider } from '@/components/ui/tooltip'
import {
  GrokQuotaDetail,
  UpstreamQuotaDetail,
} from '@/features/credentials/credential-detail-drawer'
import { formatCredentialDateTime } from '@/features/credentials/credential-display'
import { UpstreamQuotaCell, XaiProductUsageList } from '@/features/upstream/quota-cells'
import { getUpstreamQuotaErrorSummary } from '@/features/upstream/quota-format'
import {
  isCredentialQuotaCollectable,
  resolveCredentialQuotaAction,
  resolveXaiOnDemandState,
} from '@/features/upstream/upstream-quota-model'
import { normalizeQuotaCredentialDetail } from '@/lib/api/management/quota'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const i18n = createInstance()
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ru },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
})

function devinEntry() {
  return normalizeQuotaCredentialDetail({
    credential_id: 'devin-test',
    provider: 'devin',
    credential_type: 'oauth',
    credential_status: 'enabled',
    quota_status: 'healthy',
    freshness: 'fresh',
    collection_status: 'success',
    plan: { name: 'Pro', premium: false, expires_at: '2026-11-11T08:42:00Z' },
    windows: [
      {
        id: 'devin-daily',
        scope: 'account',
        unit: 'percentage',
        mode: 'fixed',
        status: 'healthy',
        remaining: 65,
        remaining_ratio: 0.65,
        limit: 100,
        period_unit: 'day',
        period_value: 1,
        reset_at: '2026-11-06T16:00:00Z',
      },
      {
        id: 'devin-weekly',
        scope: 'account',
        unit: 'percentage',
        mode: 'fixed',
        status: 'healthy',
        remaining: 83,
        remaining_ratio: 0.83,
        limit: 100,
        period_unit: 'week',
        period_value: 1,
        reset_at: '2026-11-08T16:00:00Z',
      },
    ],
  })
}

function render(node: React.ReactElement) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>{node}</TooltipProvider>
    </I18nextProvider>,
  )
}

describe('Devin quota integration', () => {
  test('allows collecting Devin credentials and keeps backend unsupported decisions', () => {
    const resource = { provider: 'devin', disabled: false, status: 'active' }
    expect(isCredentialQuotaCollectable(resource)).toBe(true)
    expect(resolveCredentialQuotaAction({ resource, entry: null, available: true })).toBe('collect')
    expect(
      resolveCredentialQuotaAction({
        resource,
        entry: { ...devinEntry(), status: 'unsupported' },
        available: true,
      }),
    ).toBe('unsupported')
  })

  test('renders daily and weekly remaining amounts, with subscription expiry in details', async () => {
    await i18n.changeLanguage('en')
    const entry = devinEntry()
    expect(entry.plan?.expiresAt).toBe('2026-11-11T08:42:00Z')
    const cell = render(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(cell).toContain('Daily limit')
    expect(cell).toContain('Weekly')
    expect(cell.indexOf('65%')).toBeLessThan(cell.indexOf('83%'))
    expect(cell.match(/role="progressbar"/g)).toHaveLength(2)
    expect(cell).toContain('Subscription ends:')
    const detail = render(<UpstreamQuotaDetail item={entry} />)
    expect(detail).toContain('Subscription ends')
    expect(detail).toContain('2026')
  })

  test('does not fabricate a percentage for an unknown weekly remainder', () => {
    const entry = devinEntry()
    entry.windows[1] = {
      ...entry.windows[1]!,
      remaining: null,
      remainingRatio: null,
      status: 'unknown',
    }
    const cell = render(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(cell).toContain('65%')
    expect(cell).not.toContain('0%')
    expect(cell).toContain('aria-valuetext="Not available"')
  })

  test('tolerates old backends without plan expiry and ignores invalid dates', () => {
    expect(normalizeQuotaCredentialDetail({ plan: { name: 'Pro', premium: false } }).plan).toEqual({
      name: 'Pro',
      premium: false,
    })
    expect(
      normalizeQuotaCredentialDetail({ plan: { name: 'Pro', expires_at: 'not-a-date' } }).plan
        ?.expiresAt,
    ).toBeUndefined()
  })

  test('formats quota window times in the selected language and tolerates invalid timestamps', async () => {
    await i18n.changeLanguage('ru')
    const detail = render(<UpstreamQuotaDetail item={devinEntry()} />)
    expect(detail).toContain('нояб.')
    expect(detail).not.toContain('年')
    expect(formatCredentialDateTime('not-a-date', 'ru')).toBeNull()
  })
})

describe('xAI quota recovery states', () => {
  test('treats a successful empty snapshot as no on-demand cap, without inferring paid eligibility', () => {
    const entry = normalizeQuotaCredentialDetail({
      provider: 'xai',
      collection_status: 'success',
      freshness: 'fresh',
      source: 'active_probe',
      observed_at: new Date().toISOString(),
      quota_status: 'unknown',
      windows: [],
      plan: { name: 'Free', premium: false },
    })
    expect(resolveXaiOnDemandState(entry)).toBe('disabled')
    expect(entry.status).toBe('unknown')
    expect(resolveXaiOnDemandState({ ...entry, source: 'response_header' })).toBe('unknown')
    expect(resolveXaiOnDemandState({ ...entry, collectionStatus: 'partial' })).toBe('unknown')
  })

  test('keeps retained and expired on-demand caps distinct from a current enabled cap', () => {
    const now = Date.now()
    const entry = normalizeQuotaCredentialDetail({
      provider: 'xai',
      collection_status: 'partial',
      freshness: 'fresh',
      observed_at: new Date(now).toISOString(),
      expires_at: new Date(now + 60_000).toISOString(),
      windows: [
        {
          id: 'xai-on-demand',
          unit: 'currency',
          observed_at: new Date(now - 60_000).toISOString(),
        },
      ],
    })
    expect(resolveXaiOnDemandState(entry)).toBe('unknown')
    entry.windows[0]!.observedAt = entry.observedAt
    expect(resolveXaiOnDemandState(entry)).toBe('enabled')
    expect(resolveXaiOnDemandState({ ...entry, freshness: 'stale' })).toBe('unknown')
    expect(resolveXaiOnDemandState({ ...entry, expiresAt: new Date(now - 1).toISOString() })).toBe(
      'unknown',
    )
  })

  test('preserves the backend aggregate and discloses retained product observation times', async () => {
    await i18n.changeLanguage('en')
    const now = Date.now()
    const older = new Date(now - 10 * 60_000).toISOString()
    const entry = normalizeQuotaCredentialDetail({
      provider: 'xai',
      quota_status: 'healthy',
      collection_status: 'partial',
      freshness: 'fresh',
      observed_at: new Date(now).toISOString(),
      windows: [
        {
          id: 'xai-weekly-usage',
          unit: 'percentage',
          remaining_ratio: 0.9,
          period_unit: 'week',
          period_value: 1,
          status: 'healthy',
          observed_at: new Date(now).toISOString(),
        },
        {
          id: 'xai-product-grokbuild',
          label: 'GrokBuild',
          scope_id: 'xai-product-usage',
          status: 'exhausted',
          used: 100,
          observed_at: older,
        },
      ],
    })
    const cell = render(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(entry.status).toBe('healthy')
    expect(cell).toContain('90%')
    expect(cell.match(/role="progressbar"/g)).toHaveLength(1)
    const productDetail = render(<XaiProductUsageList entry={entry} />)
    expect(productDetail).toContain('GrokBuild')
    expect(productDetail).toContain('100%')
    expect(productDetail).toContain(`dateTime="${older}"`)
    expect(productDetail).toContain('Collected')
    const detail = render(<GrokQuotaDetail entry={entry} />)
    expect(detail).toContain(`dateTime="${older}"`)
    entry.windows[1]!.observedAt = entry.observedAt
    expect(render(<XaiProductUsageList entry={entry} />)).not.toContain('<time')
  })

  test('keeps absent on-demand state unknown after incomplete collection', () => {
    const entry = { ...devinEntry(), provider: 'xai' }
    expect(resolveXaiOnDemandState(entry)).toBe('disabled')
    expect(resolveXaiOnDemandState({ ...entry, source: 'response_header' })).toBe('unknown')
    expect(resolveXaiOnDemandState({ ...entry, collectionStatus: 'partial' })).toBe('unknown')
    expect(resolveXaiOnDemandState({ ...entry, collectionStatus: 'failed' })).toBe('unknown')
    expect(
      resolveXaiOnDemandState({
        ...entry,
        windows: [{ ...entry.windows[0]!, id: 'xai-on-demand' }],
        collectionStatus: 'partial',
      }),
    ).toBe('enabled')
  })

  test.each(['en', 'zh-CN', 'zh-TW', 'ru'])(
    'distinguishes outdated clients from rejected credentials in %s',
    async (locale) => {
      await i18n.changeLanguage(locale)
      const summary = getUpstreamQuotaErrorSummary(
        {
          lastError: {
            code: 'UPSTREAM_CLIENT_OUTDATED',
            message: '',
            retryable: false,
            occurredAt: null,
            upstreamStatusCode: 426,
            requestId: null,
          },
        },
        i18n.t,
      )
      expect(summary.title).toBe(i18n.t('upstreamPage.quota.errors.clientOutdated.title'))
      expect(summary.title).not.toBe(i18n.t('upstreamPage.quota.errors.authorization.title'))
      expect(summary.description).not.toContain('upstreamPage.')
    },
  )

  test.each(['en', 'zh-CN', 'zh-TW', 'ru'])(
    'localizes missing credential recovery and HTTP 426 fallbacks in %s',
    async (locale) => {
      await i18n.changeLanguage(locale)
      const missing = getUpstreamQuotaErrorSummary(
        {
          lastError: {
            code: 'AUTH_TOKEN_UNAVAILABLE',
            message: 'Credential session token is unavailable.',
            retryable: true,
            occurredAt: null,
            upstreamStatusCode: null,
            requestId: null,
          },
        },
        i18n.t,
      )
      expect(missing.title).toBe(i18n.t('upstreamPage.quota.errors.missingToken.title'))
      expect(missing.description).not.toContain('Meta')
      expect(missing.description).not.toContain('upstreamPage.')
      const outdated = getUpstreamQuotaErrorSummary(
        {
          lastError: {
            code: 'UPSTREAM_RESPONSE_INVALID',
            message: 'Upgrade required.',
            retryable: false,
            occurredAt: null,
            upstreamStatusCode: 426,
            requestId: null,
          },
        },
        i18n.t,
      )
      expect(outdated.title).toBe(i18n.t('upstreamPage.quota.errors.clientOutdated.title'))
    },
  )
})
