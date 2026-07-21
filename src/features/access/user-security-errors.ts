import type { TFunction } from 'i18next'

import { isUserApiError } from '@/lib/api/user/client'

export function userSecurityErrorMessage(t: TFunction, error: unknown) {
  if (!isUserApiError(error)) return t('userRecovery.errors.generic')

  switch (error.code) {
    case 'network':
      return t('userRecovery.errors.network')
    case 'invalid_email':
      return t('userRecovery.errors.invalidEmail')
    case 'email_unavailable':
      return t('userRecovery.errors.emailUnavailable')
    case 'email_feature_unavailable':
      return t('userRecovery.errors.featureUnavailable')
    case 'verification_rate_limited':
      return t('userRecovery.errors.rateLimited')
    case 'email_not_configured':
      return t('userRecovery.errors.emailNotConfigured')
    case 'invalid_or_expired_token':
      return t('userRecovery.errors.invalidToken')
    default:
      return t('userRecovery.errors.generic')
  }
}
