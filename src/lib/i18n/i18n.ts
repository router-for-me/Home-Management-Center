import i18n from 'i18next'
import type { ResourceLanguage } from 'i18next'
import { initReactI18next } from 'react-i18next'

import { type AppLanguage, SUPPORTED_LANGUAGES, getInitialLanguage } from '@/lib/i18n/languages'

const FALLBACK_LANGUAGE: AppLanguage = 'en'

// Each locale is its own async chunk. Importing all four statically put ~519 KB
// of translations into a chunk that every HTML entry loaded synchronously, and
// a session only ever renders one of them.
const localeLoaders: Record<AppLanguage, () => Promise<ResourceLanguage>> = {
  'zh-CN': () => import('@/lib/i18n/locales/zh-CN').then((module) => module.zhCN),
  'zh-TW': () => import('@/lib/i18n/locales/zh-TW').then((module) => module.zhTW),
  en: () => import('@/lib/i18n/locales/en').then((module) => module.en),
  ru: () => import('@/lib/i18n/locales/ru').then((module) => module.ru),
}

const loadedLanguages = new Set<AppLanguage>()

function normalizeDocumentLanguage(language: string | undefined): AppLanguage {
  return SUPPORTED_LANGUAGES.includes(language as AppLanguage) ? (language as AppLanguage) : 'en'
}

function syncDocumentLanguage(language: string | undefined) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = normalizeDocumentLanguage(language)
}

function registerBundles(language: AppLanguage, resources: ResourceLanguage) {
  for (const [namespace, bundle] of Object.entries(resources)) {
    i18n.addResourceBundle(language, namespace, bundle, true, true)
  }
  loadedLanguages.add(language)
}

/**
 * Fetches a locale bundle and registers it. Callers must await this before
 * switching to that language, otherwise the first render after the switch has
 * nothing to resolve keys against.
 */
export async function loadLanguageBundle(language: AppLanguage) {
  if (loadedLanguages.has(language)) {
    return
  }

  registerBundles(language, await localeLoaders[language]())
}

/**
 * Loads the fallback locale off the critical path. It is only consulted when a
 * key is missing from the active locale, so blocking first paint on it would
 * cost 156 KB for a safety net that is normally never read.
 */
function loadFallbackLanguageWhenIdle() {
  const load = () => {
    void loadLanguageBundle(FALLBACK_LANGUAGE)
  }

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(load, { timeout: 5_000 })
    return
  }

  setTimeout(load, 1_000)
}

/**
 * Initializes i18next with only the language this session will render. Entries
 * must await this before mounting so the first paint has strings.
 */
export async function initI18n() {
  const language = getInitialLanguage()
  const resources = await localeLoaders[language]()

  await i18n.use(initReactI18next).init({
    resources: { [language]: resources },
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    defaultNS: 'common',
    react: {
      useSuspense: false,
    },
  })

  loadedLanguages.add(language)

  i18n.on('languageChanged', (changed) => {
    syncDocumentLanguage(changed)
  })

  syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)

  if (language !== FALLBACK_LANGUAGE) {
    loadFallbackLanguageWhenIdle()
  }
}
