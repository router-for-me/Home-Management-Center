import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import {
  AccountsToolbar,
  CredentialRowActions,
  getCredentialActionColumnWidth,
  getCredentialTableMinWidth,
} from '@/features/credentials/accounts-panel'
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

function renderToolbar() {
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
      />
    </I18nextProvider>,
  )
}

function renderRowActions() {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <CredentialRowActions
        mutating={false}
        onDelete={() => undefined}
        onDownload={() => undefined}
        onView={() => undefined}
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
    expect(markup).toContain('aria-label="Quick filters"')
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(2)
    expect(markup).toContain('Showing 0 of 0 credentials')
  })

  test('uses full-width mobile controls before the content-driven two-column breakpoint', () => {
    const markup = renderToolbar()

    expect(markup).toContain('grid-cols-1')
    expect(markup).toContain('min-[480px]:grid-cols-2')
    expect(markup.match(/data-size="xl"/g)).toHaveLength(7)
    // Six of those seven carry the step class: the toggle group root reports the
    // size but renders no box of its own, its items do. The previous count of
    // seven matched `min-h-10` on the alignment row by substring, not a control.
    expect(markup.match(/control-xl/g)).toHaveLength(6)
    expect(markup).not.toContain('h-11')
  })

  test('orders view, download, and delete without a redundant overflow menu', () => {
    const markup = renderRowActions()
    const viewIndex = markup.indexOf('View</button>')
    const downloadIndex = markup.indexOf('Download</button>')
    const deleteIndex = markup.indexOf('Delete</button>')

    expect(markup.match(/<button/g)).toHaveLength(3)
    expect(markup.match(/data-size="md"/g)).toHaveLength(3)
    expect(viewIndex).toBeGreaterThan(-1)
    expect(viewIndex).toBeLessThan(downloadIndex)
    expect(downloadIndex).toBeLessThan(deleteIndex)
    expect(markup).toContain('data-variant="destructiveText"')
    expect(markup).not.toContain('data-size="icon-md"')
    expect(markup).not.toContain('More actions')
  })

  test('sizes the sticky action column for each supported label length', () => {
    expect(getCredentialActionColumnWidth('zh-CN')).toBe(224)
    expect(getCredentialActionColumnWidth('zh-TW')).toBe(224)
    expect(getCredentialActionColumnWidth('en')).toBe(260)
    expect(getCredentialActionColumnWidth('ru')).toBe(284)
    expect(getCredentialTableMinWidth('zh-CN')).toBe(1234)
  })

  test('keeps credential table copy aligned across all supported locales', () => {
    const locales = [zhCN, zhTW, en, ru]
    const expectedActionKeys = Object.keys(en.common.credentialsPage.actions).sort()
    const expectedFilterKeys = Object.keys(en.common.credentialsPage.filters).sort()
    const expectedListKeys = Object.keys(en.common.credentialsPage.list).sort()
    const expectedQuickFilterKeys = Object.keys(en.common.upstreamPage.quotaChips).sort()

    expect(expectedListKeys).not.toContain('inFlight')

    for (const locale of locales) {
      expect(Object.keys(locale.common.credentialsPage.actions).sort()).toEqual(expectedActionKeys)
      expect(Object.keys(locale.common.credentialsPage.filters).sort()).toEqual(expectedFilterKeys)
      expect(Object.keys(locale.common.credentialsPage.list).sort()).toEqual(expectedListKeys)
      expect(Object.keys(locale.common.upstreamPage.quotaChips).sort()).toEqual(
        expectedQuickFilterKeys,
      )
      expect(locale.common.credentialsPage.filters.resultCount).toContain('{{visible}}')
      expect(locale.common.credentialsPage.filters.resultCount).toContain('{{total}}')
    }
  })
})
