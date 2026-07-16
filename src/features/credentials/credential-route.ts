import type { CredentialResource } from '@/lib/api/management/credentials'

export function normalizeCredentialRouteSearch(search: Record<string, unknown>) {
  return {
    credential:
      typeof search.credential === 'string' && search.credential.trim()
        ? search.credential.trim()
        : undefined,
    q: typeof search.q === 'string' && search.q.trim() ? search.q.trim() : undefined,
  }
}

export function findCredentialRouteResource(
  resources: CredentialResource[],
  credentialId?: string,
  fallbackSearch?: string,
) {
  if (!credentialId) return null

  const exactMatch = resources.find(
    (resource) =>
      resource.id === credentialId ||
      resource.identifier === credentialId ||
      resource.authIndex === credentialId,
  )
  if (exactMatch) return exactMatch

  const normalizedFallback = fallbackSearch?.trim().toLowerCase()
  if (!normalizedFallback) return null

  return (
    resources.find((resource) =>
      [resource.identifier, resource.authIndex, resource.name]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase() === normalizedFallback),
    ) ?? null
  )
}
