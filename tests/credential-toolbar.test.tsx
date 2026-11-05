import type { ComponentProps } from 'react'

import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { AccountsToolbar } from '@/features/credentials/accounts-panel'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

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

function renderToolbar(overrides: Partial<ComponentProps<typeof AccountsToolbar>> = {}) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <AccountsToolbar
        resources={[]}
        search=""
        statusFilter="all"
        providerFilter="all"
        quotaAvailable
        attentionOnly
        websocketOnly
        filteredCount={0}
        onSearchChange={() => undefined}
        onStatusFilterChange={() => undefined}
        onProviderFilterChange={() => undefined}
        onAttentionOnlyChange={() => undefined}
        onWebsocketOnlyChange={() => undefined}
        onClearFilters={() => undefined}
        {...overrides}
      />
    </I18nextProvider>,
  )
}

describe('credential toolbar', () => {
  test('uses accessible controls and keeps the two quick filters independently selected', () => {
    const markup = renderToolbar()

    expect(markup).toContain('type="search"')
    expect(markup.match(/role="combobox"/g)).toHaveLength(2)
    expect(markup).toContain('aria-label="Status"')
    expect(markup).toContain('aria-label="Model provider"')
    expect(markup).toContain('aria-label="Credential filters"')
    expect(markup.match(/role="checkbox"/g)).toHaveLength(2)
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(2)
    expect(markup).toContain(en.common.upstreamPage.quotaChips.ws)
    expect(markup).not.toContain('aria-pressed=')
    expect(markup).toContain('Showing 0 of 0 credentials')
  })

  test('keeps either binary condition selected independently', () => {
    for (const attentionOnly of [false, true]) {
      const markup = renderToolbar({ attentionOnly, websocketOnly: !attentionOnly })
      const buttons = markup.match(/<button\b[^>]*>/g) ?? []
      for (const [label, checked] of [
        [en.common.upstreamPage.quotaChips.attention, attentionOnly],
        [en.common.upstreamPage.quotaChips.ws, !attentionOnly],
      ] as const) {
        const button = buttons.find((tag) => tag.includes(`aria-label="${label}"`))
        expect(button).toContain(`aria-checked="${checked}"`)
      }
    }
  })

  test('keeps the WebSocket filter when quota queries are unsupported', () => {
    const markup = renderToolbar({ quotaAvailable: false })
    expect(markup.match(/role="checkbox"/g)).toHaveLength(1)
    expect(markup).toContain(en.common.upstreamPage.quotaChips.ws)
    expect(markup).not.toContain(en.common.upstreamPage.quotaChips.attention)
  })

  test('keeps reset visible but disabled when there are no active filters', () => {
    const markup = renderToolbar({ attentionOnly: false, websocketOnly: false })
    const reset = markup.match(/<button[^>]*>Clear filters<\/button>/)?.[0]
    expect(reset).toContain('disabled=""')
  })

  test('keeps credential table copy aligned across all supported locales', () => {
    const locales = [zhCN, zhTW, en, ru]
    const expectedActionKeys = Object.keys(en.common.credentialsPage.actions).sort()
    const expectedFilterKeys = Object.keys(en.common.credentialsPage.filters).sort()
    const expectedListKeys = Object.keys(en.common.credentialsPage.list).sort()
    const expectedQuickFilterKeys = Object.keys(en.common.upstreamPage.quotaChips).sort()

    expect(expectedListKeys).toContain('inFlight')
    expect(expectedListKeys).toContain('weight')

    for (const locale of locales) {
      expect(Object.keys(locale.common.credentialsPage.actions).sort()).toEqual(expectedActionKeys)
      expect(Object.keys(locale.common.credentialsPage.filters).sort()).toEqual(expectedFilterKeys)
      expect(Object.keys(locale.common.credentialsPage.list).sort()).toEqual(expectedListKeys)
      expect(Object.keys(locale.common.upstreamPage.quotaChips).sort()).toEqual(
        expectedQuickFilterKeys,
      )
      expect(locale.common.credentialsPage.filters.resultCount).toContain('{{visible}}')
      expect(locale.common.credentialsPage.filters.resultCount).toContain('{{total}}')
      expect(locale.common.credentialsPage.form.coolingSchedule).toBeDefined()
      expect(locale.common.credentialsPage.form.coolingScheduleHint).toBeDefined()
    }
  })
})
