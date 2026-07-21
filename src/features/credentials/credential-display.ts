import type { useTranslation } from 'react-i18next'

import type { CredentialResource } from '@/lib/api/management/credentials'

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

export function formatCredentialDateTime(value: string | null) {
  if (!value) return null

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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

export function getCredentialStatusTone(resource: CredentialResource) {
  if (resource.disabled || resource.unavailable) return 'warning'
  if (resource.status === 'active') return 'positive'
  return 'neutral'
}
