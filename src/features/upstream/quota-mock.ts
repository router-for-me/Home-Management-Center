import type { QuotaWindow } from '@/lib/api/management/quota'

import type { UpstreamQuotaEntry } from './upstream-quota-model'

// Temporary mock for the Grok (xAI) plan / on-demand quota fields until the backend
// ships them (see .workbench/upstream-quota-backend-api-todo.md, TODO-2). Dev-only;
// removing this file plus the single call site in use-upstream-quota.ts deletes the mock.
const upstreamQuotaMockEnabled =
  import.meta.env.DEV && import.meta.env.PUBLIC_UPSTREAM_QUOTA_MOCK === '1'

function createMockOnDemandWindow(): QuotaWindow {
  return {
    id: 'xai-on-demand-mock',
    label: 'On-Demand',
    scope: 'account',
    scopeId: null,
    mode: 'balance',
    status: 'healthy',
    unit: 'currency',
    currency: 'USD',
    used: 12,
    remaining: 38,
    limit: 50,
    usedRatio: 0.24,
    remainingRatio: 0.76,
    isUnlimited: false,
    resetAt: null,
    windowSeconds: null,
    periodUnit: 'unknown',
    periodValue: null,
    observedAt: null,
    source: 'active_probe',
  }
}

export function withUpstreamQuotaMock(
  entries: UpstreamQuotaEntry[],
  enabled: boolean = upstreamQuotaMockEnabled,
): UpstreamQuotaEntry[] {
  if (!enabled) return entries

  return entries.map((entry) => {
    if (entry.provider.trim().toLowerCase() !== 'xai') return entry

    return {
      ...entry,
      grokPlan: entry.grokPlan ?? {
        name: 'SuperGrok',
        premium: false,
      },
      grokOnDemand: entry.grokOnDemand ?? createMockOnDemandWindow(),
    }
  })
}
