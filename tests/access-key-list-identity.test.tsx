import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { TooltipProvider } from '@/components/ui/tooltip'
import { AccessKeyList } from '@/features/access-keys/access-keys-workbench-page'
import { type AccessKeyResource, normalizeAccessKey } from '@/lib/api/management/access-keys'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const i18n = createInstance()
const noop = () => undefined

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { en }, lng: 'en', defaultNS: 'common' })
})

function renderRows(resources: AccessKeyResource[]) {
  const markup = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <AccessKeyList
          resources={resources}
          users={[]}
          channelGroups={[]}
          modelGroups={[]}
          selectedKeyId={null}
          selectedKeyIds={new Set()}
          onSelectKey={noop}
          onEditKey={noop}
          onDeleteKey={noop}
          onToggleSelection={noop}
          onToggleAll={noop}
          onCopy={noop}
          onCopyIdentifier={noop}
        />
      </TooltipProvider>
    </I18nextProvider>,
  )
  const body = markup.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
  return [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
      cell[1].replace(/<[^>]*>/g, '').trim(),
    ),
  )
}

describe('access-key list identity disclosure', () => {
  test('keeps the canonical identifier in its own list column when the key has a name', () => {
    const resource = normalizeAccessKey(
      { id: 41, display_name: 'Production', api_key: 'sk-production-secret-1111' },
      0,
    )
    const [cells] = renderRows([resource])
    expect(cells[1]).toContain('Production')
    expect(cells[1]).toContain(resource.maskedValue)
    expect(cells[1]).not.toContain(resource.value)
    expect(cells[2]).toBe('api-key-41')
  })

  test('distinguishes keys whose display names and masked values are identical', () => {
    const resources = [
      normalizeAccessKey({ id: 41, display_name: 'Production', api_key: 'sk-match-first-1111' }, 0),
      normalizeAccessKey(
        { id: 42, display_name: 'Production', api_key: 'sk-match-second-1111' },
        1,
      ),
    ]
    expect(resources[0].maskedValue).toBe(resources[1].maskedValue)
    const rows = renderRows(resources)
    expect(rows[0][1]).toBe(rows[1][1])
    expect(rows.map((cells) => cells[2])).toEqual(['api-key-41', 'api-key-42'])
  })

  test('keeps the visible identifier unchanged after a rename and key rotation', () => {
    const before = normalizeAccessKey(
      { id: 41, display_name: 'Old name', api_key: 'sk-old-value-1111' },
      0,
    )
    const after = normalizeAccessKey(
      { id: 41, display_name: 'New name', api_key: 'sk-new-value-2222' },
      0,
    )
    expect(renderRows([before])[0][2]).toBe('api-key-41')
    expect(renderRows([after])[0][2]).toBe('api-key-41')
    expect(renderRows([after])[0][1]).toContain('New name')
  })

  test('does not invent a stable identifier from the position of a legacy key', () => {
    const [cells] = renderRows([normalizeAccessKey('sk-legacy-value-1111', 4)])
    expect(cells[2]).toBe('—')
  })

  test('keeps identifier disclosure copy complete across all supported locales', () => {
    for (const locale of [en, ru, zhCN, zhTW]) {
      const copy = locale.common.accessKeysPage
      expect(Object.keys(copy.list).sort()).toEqual(
        Object.keys(en.common.accessKeysPage.list).sort(),
      )
      expect(copy.list.identifier).toBeTruthy()
      expect(copy.list.identifierHint).toBeTruthy()
      expect(copy.actions.copyIdentifier).toContain('{{identifier}}')
      expect(copy.detail.fields.identifier).toBeTruthy()
      expect(copy.detail.fields.status).toBeTruthy()
    }
  })
})
