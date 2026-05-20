import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { type AppLanguage, SUPPORTED_LANGUAGES, getInitialLanguage } from '@/lib/i18n/languages'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

function normalizeDocumentLanguage(language: string | undefined): AppLanguage {
  return SUPPORTED_LANGUAGES.includes(language as AppLanguage) ? (language as AppLanguage) : 'en'
}

function syncDocumentLanguage(language: string | undefined) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = normalizeDocumentLanguage(language)
}

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    en,
    ru,
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  defaultNS: 'common',
  react: {
    useSuspense: false,
  },
})

i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language)
})

syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
