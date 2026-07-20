import { describe, expect, test } from 'bun:test'

import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

describe('user email and recovery copy', () => {
  test('keeps the new access, recovery, and workspace keys aligned in every locale', () => {
    const locales = [zhCN.common, zhTW.common, en.common, ru.common]
    const expected = flattenKeys({
      userAccess: en.common.userAccess,
      userRecovery: en.common.userRecovery,
      userWorkspace: en.common.userWorkspace,
    })

    for (const locale of locales) {
      expect(
        flattenKeys({
          userAccess: locale.userAccess,
          userRecovery: locale.userRecovery,
          userWorkspace: locale.userWorkspace,
        }),
      ).toEqual(expected)
    }
  })

  test('keeps registration copy focused on the user task', () => {
    expect(zhCN.common.userAccess.register.description).toBe(
      '创建 Home 用户账号，登录后进入个人工作台。',
    )
    expect(zhTW.common.userAccess.register.description).toBe(
      '建立 Home 使用者帳號，登入後進入個人工作台。',
    )
    expect(en.common.userAccess.register.description).toBe(
      'Create a Home user account and continue to your personal workspace.',
    )
    expect(ru.common.userAccess.register.description).toBe(
      'Создайте аккаунт Home и перейдите в личную рабочую область.',
    )

    for (const locale of [zhCN.common, zhTW.common, en.common, ru.common]) {
      expect('emailCapabilityLoadError' in locale.userAccess.register).toBe(false)
    }
  })

  test('describes password recovery failures without capability jargon', () => {
    expect(zhCN.common.userRecovery.capabilities.loadError).toBe('密码找回暂时不可用，请稍后重试。')
    expect(zhTW.common.userRecovery.capabilities.loadError).toBe(
      '密碼找回暫時無法使用，請稍後重試。',
    )
    expect(en.common.userRecovery.capabilities.loadError).toBe(
      'Password recovery is temporarily unavailable. Try again shortly.',
    )
    expect(ru.common.userRecovery.capabilities.loadError).toBe(
      'Восстановление пароля временно недоступно. Повторите попытку позже.',
    )
  })
})

function flattenKeys(value: unknown, prefix = '', output: string[] = []) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return output

  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof nested === 'object' && nested !== null && !Array.isArray(nested)) {
      flattenKeys(nested, path, output)
    } else {
      output.push(path)
    }
  }

  return output.sort()
}
