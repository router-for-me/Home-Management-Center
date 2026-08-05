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

describe('model catalog copy', () => {
  test('carries the same keys in every locale', () => {
    const expected = flatten({
      userModels: en.common.userModels,
      header: en.common.embeddedPortal.header,
      hero: en.common.embeddedPortal.hero,
      userWorkspace: en.common.userWorkspace,
    })

    for (const [language, locale] of Object.entries(locales)) {
      expect([
        language,
        flatten({
          userModels: locale.userModels,
          header: locale.embeddedPortal.header,
          hero: locale.embeddedPortal.hero,
          userWorkspace: locale.userWorkspace,
        }),
      ]).toEqual([language, expected])
    }
  })

  test('keeps the same interpolation variables in every locale', () => {
    // A translated string that drops `{{samples}}` silently renders a sentence
    // with a hole in it, and these sentences are the ones that explain why a
    // number is missing. They are exactly the ones that must not break.
    const expected = placeholders(en.common.userModels)

    for (const [language, locale] of Object.entries(locales)) {
      expect([language, placeholders(locale.userModels)]).toEqual([language, expected])
    }
  })

  test('never leaves a model catalog string empty', () => {
    for (const [language, locale] of Object.entries(locales)) {
      for (const [path, value] of Object.entries(leaves(locale.userModels))) {
        expect([language, path, value.trim().length > 0]).toEqual([language, path, true])
      }
    }
  })

  test('states in every locale that a missing price is not a free price', () => {
    for (const [language, locale] of Object.entries(locales)) {
      const detail = locale.userModels.price.unpublishedDetail
      expect([language, detail.length > 40]).toEqual([language, true])
      expect([language, detail === en.common.userModels.price.unpublishedDetail]).toEqual([
        language,
        language === 'en',
      ])
    }
  })

  test('offers the catalog from the entry page and the workspace in every locale', () => {
    for (const [language, locale] of Object.entries(locales)) {
      expect([language, Boolean(locale.embeddedPortal.header.models)]).toEqual([language, true])
      expect([language, Boolean(locale.embeddedPortal.hero.browseModels)]).toEqual([language, true])
      expect([language, Boolean(locale.userWorkspace.browseModels)]).toEqual([language, true])
    }
  })
})

function flatten(value: unknown, prefix = '', output: string[] = []) {
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof nested === 'object' && nested !== null && !Array.isArray(nested)) {
      flatten(nested, path, output)
    } else {
      output.push(path)
    }
  }

  return output.sort()
}

function leaves(value: unknown, prefix = '', output: Record<string, string> = {}) {
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof nested === 'object' && nested !== null && !Array.isArray(nested)) {
      leaves(nested, path, output)
    } else if (typeof nested === 'string') {
      output[path] = nested
    }
  }

  return output
}

function placeholders(value: unknown) {
  const found: Record<string, string[]> = {}

  for (const [path, text] of Object.entries(leaves(value))) {
    const names = [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort()
    if (names.length > 0) found[path] = names
  }

  return found
}
