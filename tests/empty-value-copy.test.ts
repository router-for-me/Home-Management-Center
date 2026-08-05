import { describe, expect, test } from 'bun:test'

import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const locales = {
  'zh-CN': zhCN.common,
  'zh-TW': zhTW.common,
  en: en.common,
  ru: ru.common,
}

type Bag = Record<string, unknown>

function at(root: Bag, path: string) {
  return path.split('.').reduce<unknown>((node, key) => (node as Bag | undefined)?.[key], root)
}

describe('empty value copy', () => {
  test('every locale carries the shared wording', () => {
    for (const [language, locale] of Object.entries(locales)) {
      for (const path of [
        'emptyValue.notRecorded',
        'caller.userNotRecorded',
        'caller.userNotBound',
        'caller.userNotBoundHint',
      ]) {
        expect([language, path, typeof at(locale as unknown as Bag, path)]).toEqual([
          language,
          path,
          'string',
        ])
      }
    }
  })

  // An access key that resolved but belongs to no account is a supported setup;
  // a caller the backend never recorded is missing data. Collapsing the two
  // wordings would put the operator back where issue #126 and #127 started.
  test('keeps an unbound caller distinct from an unrecorded one', () => {
    for (const [language, locale] of Object.entries(locales)) {
      const caller = (locale as unknown as Bag).caller as Record<string, string>
      expect([language, caller.userNotBound === caller.userNotRecorded]).toEqual([language, false])
    }
  })

  // The convergence guard. Each of these was a page-local placeholder that
  // rendered the capability word into every empty cell of a sparse table; they
  // now route through the shared component instead.
  test('no page keeps its own empty-cell placeholder', () => {
    for (const [language, locale] of Object.entries(locales)) {
      for (const path of [
        'usageLogsPage.status.notAvailable',
        'billingPage.common.na',
        'requestEventsPage.status.notRecorded',
        'requestEventsPage.caller',
      ]) {
        expect([language, path, at(locale as unknown as Bag, path)]).toEqual([
          language,
          path,
          undefined,
        ])
      }
    }
  })
})
