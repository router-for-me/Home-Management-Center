import { describe, expect, test } from 'bun:test'

import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const locales = {
  'zh-CN': zhCN.common.requestEventsPage,
  'zh-TW': zhTW.common.requestEventsPage,
  en: en.common.requestEventsPage,
  ru: ru.common.requestEventsPage,
}

describe('request events copy', () => {
  test('carries the same keys in every locale', () => {
    const expected = flatten(en.common.requestEventsPage)

    for (const [language, locale] of Object.entries(locales)) {
      expect([language, flatten(locale)]).toEqual([language, expected])
    }
  })

  // The column stacks the Home node over the CPA node and the username over the
  // client access key, so each header has to name the line it leads with rather
  // than the pair (issues #127 and #125).
  test('names the leading line of every stacked column', () => {
    for (const [language, locale] of Object.entries(locales)) {
      const columns = locale.table.columns as Record<string, string>
      expect([language, columns.runtime.includes('Home')]).toEqual([language, true])
      expect([language, columns.client]).toEqual([language, locale.detail.fields.user])
    }
  })

  test('splits the caller into a user and a client access key', () => {
    for (const [language, locale] of Object.entries(locales)) {
      const fields = locale.detail.fields as Record<string, string | undefined>
      expect([language, typeof fields.user, typeof fields.clientKey]).toEqual([
        language,
        'string',
        'string',
      ])
      expect([language, fields.client]).toEqual([language, undefined])
    }
  })

  // Every one of these filters resolves a caller or an identifier through the
  // same control. Auth index is absent on purpose: the credential filter
  // matches `usage.auth_index` plus the credential uuid and id, so a separate
  // option would be a strict subset of it.
  test('keeps every lookup in the shared input and drops the redundant one', () => {
    for (const [language, locale] of Object.entries(locales)) {
      const filters = locale.filters as Record<string, unknown>
      const searchFields = filters.searchFields as Record<string, string | undefined>

      expect([language, Object.keys(searchFields).sort()]).toEqual([
        language,
        ['clientKey', 'credentialId', 'requestId', 'search', 'user'],
      ])
      expect([language, filters.user, filters.clientKey]).toEqual([language, undefined, undefined])
      expect([language, searchFields.credentialId?.toLowerCase()]).toEqual([
        language,
        expect.stringContaining('auth index'),
      ])
    }
  })

  // "Unavailable" is the page's word for a capability the backend cannot serve.
  // Reusing it for an empty cell put it in every row of a sparse table and left
  // the operator unable to tell sparse data from a degraded backend.
  test('does not reuse the capability word for empty cells', () => {
    for (const [language, locale] of Object.entries(locales)) {
      const status = locale.status as Record<string, string | undefined>

      expect([language, status.notAvailable]).toEqual([language, undefined])
      expect([language, typeof status.notRecorded]).toEqual([language, 'string'])
    }
  })

  test('separates an unbound user from an unrecorded one', () => {
    for (const [language, locale] of Object.entries(locales)) {
      const caller = locale.caller as Record<string, string | undefined>

      expect([language, typeof caller.userNotBound]).toEqual([language, 'string'])
      expect([language, typeof caller.userNotBoundHint]).toEqual([language, 'string'])
      expect([language, typeof caller.userNotRecorded]).toEqual([language, 'string'])
      expect([language, caller.userNotBound]).not.toEqual([language, caller.userNotRecorded])
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
