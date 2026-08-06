import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { Copy, Download, Eye, Pencil, Trash2 } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { RowActions } from '@/components/shared/row-actions'
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

const noop = () => undefined

const view = { id: 'view', label: 'View', icon: Eye, onSelect: noop }
const edit = { id: 'edit', label: 'Edit', icon: Pencil, onSelect: noop }
const download = { id: 'download', label: 'Download', icon: Download, onSelect: noop }
const copy = { id: 'copy', label: 'Copy', icon: Copy, onSelect: noop }
const remove = {
  id: 'delete',
  label: 'Delete',
  icon: Trash2,
  tone: 'destructive' as const,
  onSelect: noop,
}

/*
 * Static rendering has no matchMedia, and `useIsCompactViewport` deliberately
 * falls back to the wide shape there, so these assertions describe the wide
 * layout. The compact one is a single trigger by construction and is verified in
 * the browser, where a media query can actually be asked.
 */
function render(actions: Parameters<typeof RowActions>[0]['actions']) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <RowActions menuLabel="sk-live-9f2a" actions={actions} />
    </I18nextProvider>,
  )
}

const buttonCount = (markup: string) => markup.match(/<button/g)?.length ?? 0
const labelOrder = (markup: string) =>
  [...markup.matchAll(/>([A-Za-z]+)<\/(?:button|div)>/g)].map(([, label]) => label)

describe('row action contract', () => {
  test('renders one button per action while the column has slots', () => {
    expect(buttonCount(render([view, edit]))).toBe(2)
    expect(buttonCount(render([view, edit, remove]))).toBe(3)
  })

  test('never puts more than three controls in the column', () => {
    // Four and five actions both have to fit the same three slots, which means
    // two labelled buttons and a trigger — not three buttons and a trigger.
    for (const actions of [
      [view, edit, remove, copy],
      [view, edit, remove, copy, download],
    ]) {
      const markup = render(actions)
      expect(buttonCount(markup)).toBe(3)
      expect(markup).toContain('More actions for sk-live-9f2a')
    }
  })

  test('spends the third slot on a trigger rather than a third label', () => {
    const markup = render([view, edit, remove, copy])
    expect(labelOrder(markup)).toEqual(['View', 'Edit'])
    expect(markup).not.toContain('>Delete</button>')
    expect(markup).not.toContain('>Copy</button>')
  })

  test('adds no trigger when every action fits', () => {
    expect(render([view, edit, remove])).not.toContain('More actions')
  })

  /*
   * Only the inline group can be asserted here: the menu's items are rendered by
   * Radix when it opens, into a portal, so they are absent from static markup.
   * The same rule inside the open menu is verified in the browser.
   */
  test('keeps the destructive action last inline, wherever it was authored', () => {
    expect(labelOrder(render([view, remove, edit]))).toEqual(['View', 'Edit', 'Delete'])
    expect(labelOrder(render([remove, view, edit]))).toEqual(['View', 'Edit', 'Delete'])
    expect(labelOrder(render([remove, view]))).toEqual(['View', 'Delete'])
  })

  test('gives every row action the same text treatment, trigger included', () => {
    const markup = render([view, edit, remove, copy])
    const variants = [...markup.matchAll(/data-variant="([^"]+)"/g)].map(([, value]) => value)
    expect(variants).toEqual(['text', 'text', 'text'])
    expect(markup).not.toContain('data-variant="outline"')
    expect(markup).not.toContain('data-variant="default"')
    expect(markup).not.toContain('data-variant="ghost"')
  })

  test('keeps one control step across the column', () => {
    const markup = render([view, edit, remove, copy])
    const sizes = [...markup.matchAll(/data-size="([^"]+)"/g)].map(([, value]) => value)
    expect(sizes).toEqual(['md', 'md', 'icon-md'])
  })

  test('drops falsy entries so conditional actions need no filtering', () => {
    expect(buttonCount(render([view, false, edit, null, undefined]))).toBe(2)
  })

  test('renders nothing when a row has no actions', () => {
    expect(render([false, null, undefined])).toBe('')
  })

  test('names the row in the overflow trigger for every locale', () => {
    for (const bundle of [zhCN, zhTW, en, ru]) {
      expect(bundle.common.rowActions.more).toContain('{{target}}')
    }
  })
})
