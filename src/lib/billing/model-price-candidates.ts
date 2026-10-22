import type { ManagementModelScope, ModelResource } from '@/lib/api/management/models'

export type BillingModelPriceCandidate = {
  id: string
  provider: string
  model: string
  label: string
  description: string
  ownedBy: string | null
  type: string | null
  scopes: ManagementModelScope[]
}

export function createBillingModelPriceCandidateId(provider: string, model: string) {
  return JSON.stringify([provider, model])
}

function createCandidatesForResource(resource: ModelResource): BillingModelPriceCandidate[] {
  const targets =
    resource.billingModels ??
    resource.providers.map((provider) => ({ provider, model: resource.id }))

  return targets.map(({ provider, model }) => ({
    id: createBillingModelPriceCandidateId(provider, model),
    provider,
    model,
    label: resource.displayName,
    description: [resource.id, resource.name].filter(Boolean).join(' '),
    ownedBy: resource.ownedBy,
    type: resource.type,
    scopes: [resource.scope],
  }))
}

export function createModelPriceCandidates(
  available: ModelResource[],
  staticModels: ModelResource[],
) {
  const candidates = new Map<string, BillingModelPriceCandidate>()

  for (const resource of [...staticModels, ...available]) {
    for (const candidate of createCandidatesForResource(resource)) {
      const existing = candidates.get(candidate.id)
      if (!existing) {
        candidates.set(candidate.id, candidate)
        continue
      }

      for (const scope of candidate.scopes) {
        if (!existing.scopes.includes(scope)) {
          existing.scopes.push(scope)
        }
      }

      existing.label = existing.label || candidate.label
      existing.description = [...new Set([existing.description, candidate.description])]
        .filter(Boolean)
        .join(' ')
      existing.ownedBy = existing.ownedBy ?? candidate.ownedBy
      existing.type = existing.type ?? candidate.type
    }
  }

  return [...candidates.values()].sort((left, right) => {
    const leftAvailable = left.scopes.includes('available') ? 0 : 1
    const rightAvailable = right.scopes.includes('available') ? 0 : 1

    return (
      leftAvailable - rightAvailable ||
      left.provider.localeCompare(right.provider) ||
      left.model.localeCompare(right.model)
    )
  })
}
