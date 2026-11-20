import { useTranslation } from 'react-i18next'

import type { ManagementApiError } from '@/lib/api/management/types'

export function ManagementConnectionError({
  inputError,
  error,
}: {
  inputError: string | null
  error: ManagementApiError | null
}) {
  const { t } = useTranslation()
  if (!inputError && !error) return null

  let message = inputError ?? error?.message
  if (error && !inputError) {
    switch (error.backendCode) {
      case 'unsupported-api-version':
        message = t('connectionDialog.errors.legacyApi')
        break
      case 'management-route-unavailable':
        message = t('connectionDialog.errors.routeUnavailable')
        break
      case 'unexpected-management-response':
        message = t('connectionDialog.errors.unexpectedResponse')
        break
      case 'incompatible-config-version':
        message = t('connectionDialog.errors.incompatibleConfigVersion', {
          version: error.configVersion,
        })
        break
      default:
        if (error.code === 'network') message = t('connectionDialog.errors.unreachable')
    }
  }

  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
    >
      {message}
    </div>
  )
}
