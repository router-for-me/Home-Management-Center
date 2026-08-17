import type { AccessKeyResource } from '@/lib/api/management/access-keys'
import type { UserResource } from '@/lib/api/management/users'

export type ClientKeyIdentityTarget = {
  id?: string | null
  label?: string | null
  metadata?: Record<string, unknown> | null
}

export function formatClientKeyIdentityLabel(
  item: ClientKeyIdentityTarget,
  accessKeys?: AccessKeyResource[],
  users?: UserResource[],
): string {
  const directUsername =
    typeof item.metadata?.username === 'string' ? item.metadata.username.trim() : ''
  if (directUsername) return directUsername

  const metadataUserIdRaw = item.metadata?.user_id ?? item.metadata?.userId
  const metadataUserId =
    typeof metadataUserIdRaw === 'number'
      ? metadataUserIdRaw
      : typeof metadataUserIdRaw === 'string'
        ? Number(metadataUserIdRaw)
        : null

  if (metadataUserId !== null && Number.isFinite(metadataUserId) && metadataUserId > 0) {
    const matchedUser = users?.find(
      (user) => user.numericId === metadataUserId || user.id === String(metadataUserId),
    )
    if (matchedUser?.username) return matchedUser.username
  }

  const apiKeyIdRaw = item.metadata?.api_key_id ?? item.metadata?.apiKeyId ?? item.metadata?.id
  const apiKeyId =
    typeof apiKeyIdRaw === 'number'
      ? apiKeyIdRaw
      : typeof apiKeyIdRaw === 'string'
        ? Number(apiKeyIdRaw)
        : null
  const validApiKeyId =
    apiKeyId !== null && Number.isFinite(apiKeyId) && apiKeyId > 0 ? apiKeyId : null

  const apiKeyLabel =
    typeof item.metadata?.api_key_label === 'string' ? item.metadata.api_key_label.trim() : ''
  const apiKeyMasked =
    typeof item.metadata?.api_key_masked === 'string' ? item.metadata.api_key_masked.trim() : ''

  const matchedKey = accessKeys?.find((key) => {
    if (validApiKeyId !== null && key.numericId === validApiKeyId) return true
    if (item.id && key.id === item.id) return true
    if (
      key.identifier &&
      ((item.id && key.identifier === item.id) ||
        (item.label && key.identifier === item.label) ||
        (apiKeyLabel && key.identifier === apiKeyLabel))
    ) {
      return true
    }
    if (
      key.value &&
      ((item.id && key.value === item.id) || (item.label && key.value === item.label))
    ) {
      return true
    }
    if (
      key.maskedValue &&
      ((item.label && key.maskedValue === item.label) ||
        (apiKeyMasked && key.maskedValue === apiKeyMasked))
    ) {
      return true
    }
    if (validApiKeyId !== null && key.id === String(validApiKeyId)) return true
    return false
  })

  if (matchedKey) {
    if (matchedKey.userId !== null && matchedKey.userId > 0) {
      const matchedUser = users?.find(
        (user) => user.numericId === matchedKey.userId || user.id === String(matchedKey.userId),
      )
      if (matchedUser?.username) return matchedUser.username
    }
    if (matchedKey.displayName) return matchedKey.displayName
    if (matchedKey.identifier) return matchedKey.identifier
  }

  return item.label ?? ''
}

export const formatClientKeyRankLabel = formatClientKeyIdentityLabel
