import { describe, expect, test } from 'bun:test'

import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

describe('custom column copy', () => {
  test('uses one shared action label in every supported locale', () => {
    expect(zhCN.common.actions.customizeColumns).toBe('自定义列')
    expect(zhTW.common.actions.customizeColumns).toBe('自訂欄位')
    expect(en.common.actions.customizeColumns).toBe('Customize columns')
    expect(ru.common.actions.customizeColumns).toBe('Настроить столбцы')
  })

  test('does not keep page-specific column button labels', () => {
    for (const locale of [zhCN, zhTW, en, ru]) {
      expect('columnsButton' in locale.common.requestEventsPage.table).toBe(false)
      expect('columnsButton' in locale.common.usageLogsPage.rankings).toBe(false)
      expect('columnsButton' in locale.common.usageLogsPage.records).toBe(false)
      expect('columnsButton' in locale.common.usageLogsPage.credentials).toBe(false)
    }
  })
})
