import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import {
  isValidCredentialPriorityDraft,
  isValidCredentialRequestRetryDraft,
  isValidProxyUrl,
} from '@/features/credentials/credential-detail-drawer'
import { validateProviderForm } from '@/features/providers/providers-panel'
import type { ProviderDescriptor, ProviderEntryFormInput } from '@/lib/api/management/providers'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    resources: { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ru },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
})

describe('isValidProxyUrl', () => {
  test('accepts valid http, https, socks5, and socks5h URLs', () => {
    expect(isValidProxyUrl('http://127.0.0.1:7890')).toBe(true)
    expect(isValidProxyUrl('https://proxy.example.com:8443')).toBe(true)
    expect(isValidProxyUrl('socks5://127.0.0.1:1080')).toBe(true)
    expect(isValidProxyUrl('socks5h://user:pass@127.0.0.1:1080')).toBe(true)
  })

  test('rejects non-proxy protocols and invalid URL strings', () => {
    expect(isValidProxyUrl('ftp://127.0.0.1:21')).toBe(false)
    expect(isValidProxyUrl('ws://127.0.0.1:8080')).toBe(false)
    expect(isValidProxyUrl('not-a-url')).toBe(false)
    expect(isValidProxyUrl('javascript:alert(1)')).toBe(false)
    expect(isValidProxyUrl('')).toBe(false)
  })
})

describe('isValidCredentialPriorityDraft', () => {
  test('accepts empty strings, zero, and positive/negative safe integers', () => {
    expect(isValidCredentialPriorityDraft('')).toBe(true)
    expect(isValidCredentialPriorityDraft('   ')).toBe(true)
    expect(isValidCredentialPriorityDraft('0')).toBe(true)
    expect(isValidCredentialPriorityDraft('10')).toBe(true)
    expect(isValidCredentialPriorityDraft('-5')).toBe(true)
    expect(isValidCredentialPriorityDraft(' 42 ')).toBe(true)
  })

  test('rejects non-numeric characters and decimals', () => {
    expect(isValidCredentialPriorityDraft('abc')).toBe(false)
    expect(isValidCredentialPriorityDraft('1.5')).toBe(false)
    expect(isValidCredentialPriorityDraft('10px')).toBe(false)
  })
})

describe('isValidCredentialRequestRetryDraft', () => {
  test('accepts empty strings, zero, and non-negative safe integers', () => {
    expect(isValidCredentialRequestRetryDraft('')).toBe(true)
    expect(isValidCredentialRequestRetryDraft('   ')).toBe(true)
    expect(isValidCredentialRequestRetryDraft('0')).toBe(true)
    expect(isValidCredentialRequestRetryDraft('1')).toBe(true)
    expect(isValidCredentialRequestRetryDraft('10')).toBe(true)
  })

  test('rejects negative numbers, decimals, and non-numeric characters', () => {
    expect(isValidCredentialRequestRetryDraft('-1')).toBe(false)
    expect(isValidCredentialRequestRetryDraft('1.5')).toBe(false)
    expect(isValidCredentialRequestRetryDraft('abc')).toBe(false)
  })
})

describe('validateProviderForm', () => {
  const customDescriptor: ProviderDescriptor = {
    id: 'openaiCompatibility',
    name: 'OpenAI Compatibility',
    supportsName: true,
    supportsApiKey: true,
    requiresBaseUrl: true,
    supportsModels: true,
    supportsHeaders: true,
    supportsPrefix: true,
    supportsTestModel: true,
    supportsCloak: true,
  }

  const defaultValidForm: ProviderEntryFormInput = {
    apiKey: 'sk-test-key',
    name: 'My Custom Provider',
    baseUrl: 'https://api.openai.com/v1',
    proxyUrl: 'socks5://127.0.0.1:1080',
    prefix: 'custom',
    disabled: false,
    disableCooling: false,
    websockets: false,
    priority: 10,
    requestRetry: 2,
    models: [],
    headers: [],
    excludedModelsText: '',
  }

  test('returns no errors for a fully valid provider form', () => {
    const result = validateProviderForm(customDescriptor, defaultValidForm, 'create', testI18n.t)
    expect(Object.keys(result.fieldErrors)).toHaveLength(0)
    expect(result.generalError).toBeNull()
  })

  test('detects missing name, api key, and base URL at the field level', () => {
    const invalidForm: ProviderEntryFormInput = {
      ...defaultValidForm,
      name: '   ',
      apiKey: '   ',
      baseUrl: '   ',
    }
    const result = validateProviderForm(customDescriptor, invalidForm, 'create', testI18n.t)
    expect(result.fieldErrors.name).toBe(testI18n.t('providersPage.form.validation.nameRequired'))
    expect(result.fieldErrors.apiKey).toBe(
      testI18n.t('providersPage.form.validation.apiKeyRequired'),
    )
    expect(result.fieldErrors.baseUrl).toBe(
      testI18n.t('providersPage.form.validation.baseUrlRequired'),
    )
  })

  test('detects invalid proxy URL at the field level', () => {
    const invalidForm: ProviderEntryFormInput = {
      ...defaultValidForm,
      proxyUrl: 'ftp://bad-protocol',
    }
    const result = validateProviderForm(customDescriptor, invalidForm, 'create', testI18n.t)
    expect(result.fieldErrors.proxyUrl).toBe(
      testI18n.t('configPage.proxyPools.validation.urlInvalid'),
    )
  })

  test('validates requestRetry: accepts 0, positive integers, undefined, and rejects negative/float numbers', () => {
    // 0 = disable retry rounds
    const zeroRetry = validateProviderForm(
      customDescriptor,
      { ...defaultValidForm, requestRetry: 0 },
      'create',
      testI18n.t,
    )
    expect(zeroRetry.fieldErrors.requestRetry).toBeUndefined()

    // undefined = inherit global
    const unconfiguredRetry = validateProviderForm(
      customDescriptor,
      { ...defaultValidForm, requestRetry: undefined },
      'create',
      testI18n.t,
    )
    expect(unconfiguredRetry.fieldErrors.requestRetry).toBeUndefined()

    // negative number
    const negativeRetry = validateProviderForm(
      customDescriptor,
      { ...defaultValidForm, requestRetry: -1 },
      'create',
      testI18n.t,
    )
    expect(negativeRetry.fieldErrors.requestRetry).toBe(
      testI18n.t('providersPage.form.validation.requestRetryInvalid'),
    )

    // float number
    const floatRetry = validateProviderForm(
      customDescriptor,
      { ...defaultValidForm, requestRetry: 1.5 },
      'create',
      testI18n.t,
    )
    expect(floatRetry.fieldErrors.requestRetry).toBe(
      testI18n.t('providersPage.form.validation.requestRetryInvalid'),
    )
  })

  test('detects incomplete model entries and incomplete custom headers as general errors', () => {
    const incompleteModelForm: ProviderEntryFormInput = {
      ...defaultValidForm,
      models: [{ name: '', alias: 'gpt-alias', displayName: '', forceMapping: false }],
    }
    const modelResult = validateProviderForm(
      customDescriptor,
      incompleteModelForm,
      'create',
      testI18n.t,
    )
    expect(modelResult.generalError).toBe(
      testI18n.t('providersPage.form.validation.modelNameRequired'),
    )

    const incompleteHeaderForm: ProviderEntryFormInput = {
      ...defaultValidForm,
      headers: [{ key: '', value: 'Bearer token123' }],
    }
    const headerResult = validateProviderForm(
      customDescriptor,
      incompleteHeaderForm,
      'create',
      testI18n.t,
    )
    expect(headerResult.generalError).toBe(
      testI18n.t('providersPage.form.validation.headerNameRequired'),
    )
  })
})
