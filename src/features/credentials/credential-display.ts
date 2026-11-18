import type { useTranslation } from 'react-i18next'

import type {
  CredentialOAuthProviderOption,
  CredentialResource,
} from '@/lib/api/management/credentials'

type TranslationFn = ReturnType<typeof useTranslation>['t']

const credentialSourceNameKeys: Record<string, string> = {
  db: 'credentialsPage.sourceNames.db',
  database: 'credentialsPage.sourceNames.db',
  file: 'credentialsPage.sourceNames.file',
  memory: 'credentialsPage.sourceNames.memory',
  unknown: 'credentialsPage.sourceNames.unknown',
}

export function getCredentialSourceLabel(t: TranslationFn, source: string | null | undefined) {
  const normalizedSource = source?.trim().toLowerCase() || 'unknown'
  return t(credentialSourceNameKeys[normalizedSource] ?? 'credentialsPage.sourceNames.unknown')
}

export function getCredentialProviderLabel(t: TranslationFn, provider: string | null | undefined) {
  const normalizedProvider = provider?.trim().toLowerCase()
  if (!normalizedProvider) return t('credentialsPage.status.notAvailable')

  const translationKey = `credentialsPage.oauth.providers.${normalizedProvider}`
  return t(translationKey, { defaultValue: provider ?? normalizedProvider })
}

export function getCredentialOAuthProviderLabel(
  t: TranslationFn,
  option: CredentialOAuthProviderOption,
) {
  if (option.source === 'plugin') return option.displayName ?? option.id
  return t(`credentialsPage.oauth.providers.${option.id}`)
}

export function getCredentialOAuthProviderHint(
  t: TranslationFn,
  option: CredentialOAuthProviderOption,
) {
  if (option.source === 'plugin') {
    return t('credentialsPage.oauth.pluginProviderHint', {
      name: getCredentialOAuthProviderLabel(t, option),
    })
  }
  return t(`credentialsPage.oauth.providerHints.${option.id}`)
}

export function formatCredentialDateTime(value: string | null, locale?: string) {
  const timestamp = Date.parse(value ?? '')
  if (!Number.isFinite(timestamp)) return null

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

export function formatCredentialBytes(value: number | null) {
  if (value === null) return null
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export function getCredentialDisplayName(resource: CredentialResource) {
  return (
    resource.label ?? resource.email ?? resource.account ?? resource.name ?? resource.identifier
  )
}
