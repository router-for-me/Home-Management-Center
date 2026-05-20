export const SUPPORTED_LANGUAGES = ['zh-CN', 'zh-TW', 'en', 'ru'] as const

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const LANGUAGE_STORAGE_KEY = 'home-management-center.language'

export const LANGUAGE_OPTIONS: Array<{
  code: AppLanguage
  nativeLabel: string
  englishLabel: string
}> = [
  { code: 'zh-CN', nativeLabel: '简体中文', englishLabel: 'Simplified Chinese' },
  { code: 'zh-TW', nativeLabel: '繁體中文', englishLabel: 'Traditional Chinese' },
  { code: 'en', nativeLabel: 'English', englishLabel: 'English' },
  { code: 'ru', nativeLabel: 'Русский', englishLabel: 'Russian' },
]

const TRADITIONAL_CHINESE_PREFIXES = ['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'] as const

function isSupportedLanguage(value: string): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage)
}

function getStoredLanguage(): AppLanguage | null {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)

  return stored && isSupportedLanguage(stored) ? stored : null
}

function getBrowserLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') {
    return 'en'
  }

  const raw = navigator.languages?.[0] ?? navigator.language ?? 'en'
  const lower = raw.toLowerCase()

  if (TRADITIONAL_CHINESE_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return 'zh-TW'
  }

  if (lower.startsWith('zh')) {
    return 'zh-CN'
  }

  if (lower.startsWith('ru')) {
    return 'ru'
  }

  return 'en'
}

export function getInitialLanguage(): AppLanguage {
  return getStoredLanguage() ?? getBrowserLanguage()
}

export function persistLanguage(language: AppLanguage) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}
