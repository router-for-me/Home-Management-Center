import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import type { i18n as I18n } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { CallerUser, EmptyValue } from '@/components/shared/empty-value'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const resources = { 'zh-CN': zhCN, 'zh-TW': zhTW, en, ru }
const instances: Record<string, I18n> = {}

beforeAll(async () => {
  for (const [language, bundle] of Object.entries(resources)) {
    const instance = createInstance()
    await instance.use(initReactI18next).init({
      resources: { [language]: bundle },
      lng: language,
      fallbackLng: false,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    })
    instances[language] = instance
  }
})

function render(language: string, node: React.ReactElement) {
  return renderToStaticMarkup(<I18nextProvider i18n={instances[language]}>{node}</I18nextProvider>)
}

describe('empty value', () => {
  // The component is rendered rather than the keys looked up: `common` is the
  // namespace, so `t('common.caller.x')` resolves to nothing and paints the raw
  // key into the cell. Asserting the keys alone passes either way.
  test('never paints a raw i18n key', () => {
    const nodes = [
      <EmptyValue key="dash" />,
      <CallerUser key="bound" username={null} keyResolved />,
      <CallerUser key="unbound" username={null} keyResolved={false} />,
    ]

    for (const language of Object.keys(instances)) {
      for (const node of nodes) {
        const markup = render(language, node)
        expect([language, markup.includes('caller.')]).toEqual([language, false])
        expect([language, markup.includes('emptyValue.')]).toEqual([language, false])
      }
    }
  })

  test('renders the username when there is one', () => {
    for (const language of Object.keys(instances)) {
      const markup = render(language, <CallerUser username="alice" keyResolved />)
      expect([language, markup.includes('alice')]).toEqual([language, true])
    }
  })

  // An access key that resolved but belongs to no account is a supported setup;
  // a caller the backend never recorded is missing data. Collapsing the two
  // would put the operator back where issues #126 and #127 started.
  test('separates an unbound caller from an unrecorded one', () => {
    for (const [language, instance] of Object.entries(instances)) {
      const unbound = render(language, <CallerUser username={null} keyResolved />)
      const unrecorded = render(language, <CallerUser username={null} keyResolved={false} />)

      expect([language, unbound.includes(instance.t('caller.userNotBound'))]).toEqual([
        language,
        true,
      ])
      expect([language, unrecorded.includes(instance.t('caller.userNotRecorded'))]).toEqual([
        language,
        true,
      ])
      expect([language, unbound]).not.toEqual([language, unrecorded])
    }
  })

  test('gives a bare dash an accessible reason', () => {
    for (const [language, instance] of Object.entries(instances)) {
      const markup = render(language, <EmptyValue />)
      expect([language, markup.includes('—')]).toEqual([language, true])
      expect([language, markup.includes(instance.t('emptyValue.notRecorded'))]).toEqual([
        language,
        true,
      ])
    }
  })

  // The convergence guard: each of these was a page-local placeholder that put
  // the capability word into every empty cell of a sparse table.
  test('no page keeps its own empty-cell placeholder', () => {
    const retired = [
      'usageLogsPage.status.notAvailable',
      'billingPage.common.na',
      'requestEventsPage.status.notRecorded',
      'requestEventsPage.caller.userNotBound',
    ]

    for (const [language, instance] of Object.entries(instances)) {
      for (const key of retired) {
        expect([language, key, instance.exists(key)]).toEqual([language, key, false])
      }
    }
  })
})
