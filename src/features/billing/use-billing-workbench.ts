import { useMemo } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { BillingTab } from '@/features/billing/billing-model'
import {
  createModelPrice,
  deleteModelPrice,
  fetchBalanceRecords,
  fetchBillingOverview,
  fetchBillingSettings,
  fetchBillingTierDiagnostics,
  fetchChargeRecords,
  fetchModelPrices,
  toBillingApiError,
  updateBillingSettings,
  updateModelPrice,
} from '@/lib/api/management/billing'
import {
  applyModelPriceImport,
  previewModelPriceImport,
} from '@/lib/api/management/billing-model-price-import'
import type {
  BillingFilters,
  BillingPagination,
  BillingServiceTierSource,
  ModelPrice,
  ModelPriceInput,
} from '@/lib/api/management/billing-types'
import {
  type ManagementModelScope,
  type ModelResource,
  fetchModelsSnapshot,
  toModelsApiError,
} from '@/lib/api/management/models'
import { fetchUsersSnapshot, toUserApiError } from '@/lib/api/management/users'
import type {
  ModelPriceImportApplyInput,
  ModelPriceImportPreviewInput,
  ModelPriceImportProgress,
} from '@/lib/billing/model-price-import-types'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

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

type BillingModelPriceCandidateSnapshot = {
  candidates: BillingModelPriceCandidate[]
  issue: string | null
}

function toError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function readSettledError(result: PromiseSettledResult<unknown>) {
  return result.status === 'rejected' ? toError(result.reason).message : null
}

function normalizeModelProvider(resource: ModelResource) {
  const channel = resource.channel?.trim()
  if (channel) return normalizeBillingProvider(channel)

  const type = resource.type?.trim()
  if (type) return normalizeBillingProvider(type)

  const ownedBy = resource.ownedBy?.trim()
  if (ownedBy) return normalizeBillingProvider(ownedBy)

  return ''
}

function normalizeBillingProvider(value: string) {
  const normalized = value.trim().toLowerCase()
  if (
    normalized === 'codex-free' ||
    normalized === 'codex-team' ||
    normalized === 'codex-plus' ||
    normalized === 'codex-pro'
  ) {
    return 'codex'
  }

  return normalized
}

function normalizeModelPriceCandidate(resource: ModelResource): BillingModelPriceCandidate | null {
  const provider = normalizeModelProvider(resource)
  if (!provider) return null

  return {
    id: `${provider}:${resource.id}`,
    provider,
    model: resource.id,
    label: resource.displayName,
    description: resource.name ?? resource.id,
    ownedBy: resource.ownedBy,
    type: resource.type,
    scopes: [resource.scope],
  }
}

function createModelPriceCandidates(available: ModelResource[], staticModels: ModelResource[]) {
  const candidates = new Map<string, BillingModelPriceCandidate>()

  for (const resource of [...staticModels, ...available]) {
    const candidate = normalizeModelPriceCandidate(resource)
    if (!candidate) continue

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
    existing.description = existing.description || candidate.description
    existing.ownedBy = existing.ownedBy ?? candidate.ownedBy
    existing.type = existing.type ?? candidate.type
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

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)
  const capabilityStatus = useCapabilityStore((state) => state.status)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
    checking: status === 'checking',
    ready: status === 'connected' && capabilityStatus === 'ready' && Boolean(managementKey),
    runtimeMode,
  }
}

export function useBillingWorkbench(
  activeTab: BillingTab,
  filters: BillingFilters,
  chargePagination: BillingPagination,
  balancePagination: BillingPagination,
) {
  const queryClient = useQueryClient()
  const { session, connected, checking, connectedAt, ready, runtimeMode } = useManagementSession()
  const queryScope = useMemo(
    () => [session.baseUrl, connectedAt, filters] as const,
    [connectedAt, filters, session.baseUrl],
  )
  const overviewQueryKey = ['billing', 'overview', ...queryScope]
  const chargesQueryKey = ['billing', 'charges', ...queryScope, chargePagination]
  const balanceRecordsQueryKey = ['billing', 'balanceRecords', ...queryScope, balancePagination]
  const modelPricesQueryKey = ['billing', 'modelPrices', session.baseUrl, connectedAt]
  const modelPriceCandidatesQueryKey = [
    'billing',
    'modelPriceCandidates',
    session.baseUrl,
    connectedAt,
  ]
  const usersQueryKey = ['billing', 'users', session.baseUrl, connectedAt]

  const overviewQuery = useQuery({
    queryKey: overviewQueryKey,
    enabled: ready && activeTab === 'overview',
    retry: false,
    queryFn: async () => {
      try {
        return await fetchBillingOverview(session, filters)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })

  const chargesQuery = useQuery({
    queryKey: chargesQueryKey,
    enabled: ready && activeTab === 'charges',
    retry: false,
    queryFn: async () => {
      try {
        return await fetchChargeRecords(session, filters, chargePagination)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })

  const balanceRecordsQuery = useQuery({
    queryKey: balanceRecordsQueryKey,
    enabled: ready && activeTab === 'balanceRecords',
    retry: false,
    queryFn: async () => {
      try {
        return await fetchBalanceRecords(session, filters, balancePagination)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })

  const modelPricesQuery = useQuery({
    queryKey: modelPricesQueryKey,
    enabled: ready && activeTab === 'modelPrices',
    retry: false,
    queryFn: async () => {
      try {
        return await fetchModelPrices(session, { provider: '', model: '' })
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })

  const billingSettingsQuery = useQuery({
    queryKey: ['billing', 'settings', session.baseUrl, connectedAt],
    enabled: ready && activeTab === 'modelPrices',
    retry: false,
    queryFn: async () => {
      try {
        return await fetchBillingSettings(session)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })

  const billingTierDiagnosticsQuery = useQuery({
    queryKey: ['billing', 'settingsDiagnostics', session.baseUrl, connectedAt],
    enabled: ready && activeTab === 'modelPrices',
    retry: false,
    queryFn: async () => {
      try {
        return await fetchBillingTierDiagnostics(session)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })

  const modelPriceCandidatesQuery = useQuery({
    queryKey: modelPriceCandidatesQueryKey,
    enabled: ready && activeTab === 'modelPrices',
    retry: false,
    queryFn: async (): Promise<BillingModelPriceCandidateSnapshot> => {
      const [availableResult, staticResult] = await Promise.allSettled([
        fetchModelsSnapshot(session, { scope: 'available' }),
        fetchModelsSnapshot(session, { scope: 'static' }),
      ])
      const availableResources =
        availableResult.status === 'fulfilled' ? availableResult.value.resources : []
      const staticResources =
        staticResult.status === 'fulfilled' ? staticResult.value.resources : []
      const candidates = createModelPriceCandidates(availableResources, staticResources)
      const issue = [readSettledError(availableResult), readSettledError(staticResult)]
        .filter(Boolean)
        .join('\n')

      if (candidates.length === 0 && issue) {
        throw toModelsApiError(new Error(issue))
      }

      return {
        candidates,
        issue: issue || null,
      }
    },
  })

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    enabled: ready && activeTab === 'balanceRecords',
    retry: false,
    queryFn: async () => {
      try {
        return await fetchUsersSnapshot(session)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
  })

  const invalidateModelPrices = () =>
    queryClient.invalidateQueries({ queryKey: ['billing', 'modelPrices'] })

  const createPriceMutation = useMutation({
    mutationFn: (input: ModelPriceInput) => createModelPrice(session, input),
    onSuccess: () => {
      void invalidateModelPrices()
    },
    onError: toError,
  })

  const updateBillingSettingsMutation = useMutation({
    mutationFn: (source: BillingServiceTierSource) => updateBillingSettings(session, source),
    onSuccess: (settings) => {
      queryClient.setQueryData(['billing', 'settings', session.baseUrl, connectedAt], settings)
    },
    onError: toError,
  })

  const previewModelPriceImportMutation = useMutation({
    mutationFn: (input: ModelPriceImportPreviewInput) => previewModelPriceImport(session, input),
    onError: toError,
  })

  const applyModelPriceImportMutation = useMutation({
    mutationFn: ({
      input,
      onProgress,
    }: {
      input: ModelPriceImportApplyInput
      onProgress?: (progress: ModelPriceImportProgress) => void
    }) => applyModelPriceImport(session, input, onProgress),
    onSuccess: () => {
      void invalidateModelPrices()
    },
    onError: toError,
  })

  const createPricesMutation = useMutation({
    mutationFn: async (inputs: ModelPriceInput[]) => {
      for (const input of inputs) {
        await createModelPrice(session, input)
      }
    },
    onSuccess: () => {
      void invalidateModelPrices()
    },
    onError: toError,
  })

  const updatePriceMutation = useMutation({
    mutationFn: ({ resource, input }: { resource: ModelPrice; input: ModelPriceInput }) =>
      updateModelPrice(session, resource, input),
    onSuccess: () => {
      void invalidateModelPrices()
    },
    onError: toError,
  })

  const deletePriceMutation = useMutation({
    mutationFn: (resource: ModelPrice) => deleteModelPrice(session, resource),
    onSuccess: () => {
      void invalidateModelPrices()
    },
    onError: toError,
  })

  return {
    connected,
    checking,
    ready,
    runtimeMode,
    modelPriceImportPreferenceScope: session.baseUrl,
    overview: overviewQuery.data?.overview ?? null,
    overviewFetchedAt: overviewQuery.data?.fetchedAt ?? null,
    overviewLoading: overviewQuery.isLoading,
    overviewFetching: overviewQuery.isFetching,
    overviewError: overviewQuery.error ? toError(overviewQuery.error).message : null,
    charges: chargesQuery.data?.items ?? [],
    chargesTotal: chargesQuery.data?.total ?? 0,
    chargesLoading: chargesQuery.isLoading,
    chargesFetching: chargesQuery.isFetching,
    chargesError: chargesQuery.error ? toError(chargesQuery.error).message : null,
    balanceRecords: balanceRecordsQuery.data?.items ?? [],
    balanceRecordsTotal: balanceRecordsQuery.data?.total ?? 0,
    balanceRecordsLoading: balanceRecordsQuery.isLoading,
    balanceRecordsFetching: balanceRecordsQuery.isFetching,
    balanceRecordsError: balanceRecordsQuery.error
      ? toError(balanceRecordsQuery.error).message
      : null,
    modelPrices: modelPricesQuery.data?.items ?? [],
    modelPriceSchemaVersion: modelPricesQuery.data?.schemaVersion ?? null,
    modelPricesLoading: modelPricesQuery.isLoading,
    modelPricesFetching: modelPricesQuery.isFetching,
    modelPricesError: modelPricesQuery.error ? toError(modelPricesQuery.error).message : null,
    billingSettings: billingSettingsQuery.data ?? null,
    billingSettingsLoading: billingSettingsQuery.isLoading,
    billingSettingsFetching: billingSettingsQuery.isFetching,
    billingSettingsError: billingSettingsQuery.error
      ? toError(billingSettingsQuery.error).message
      : null,
    billingTierDiagnostics: billingTierDiagnosticsQuery.data ?? null,
    billingTierDiagnosticsFetching: billingTierDiagnosticsQuery.isFetching,
    billingTierDiagnosticsError: billingTierDiagnosticsQuery.error
      ? toError(billingTierDiagnosticsQuery.error).message
      : null,
    modelPriceImportServerEnabled: (modelPricesQuery.data?.schemaVersion ?? 0) >= 2,
    modelPriceCandidates: modelPriceCandidatesQuery.data?.candidates ?? [],
    modelPriceCandidatesLoading: modelPriceCandidatesQuery.isLoading,
    modelPriceCandidatesFetching: modelPriceCandidatesQuery.isFetching,
    modelPriceCandidatesIssue: modelPriceCandidatesQuery.data?.issue ?? null,
    modelPriceCandidatesError: modelPriceCandidatesQuery.error
      ? toError(modelPriceCandidatesQuery.error).message
      : null,
    users: usersQuery.data?.resources ?? [],
    usersLoading: usersQuery.isLoading,
    usersError: usersQuery.error ? toError(usersQuery.error).message : null,
    refreshOverview: overviewQuery.refetch,
    refreshCharges: chargesQuery.refetch,
    refreshBalanceRecords: balanceRecordsQuery.refetch,
    refreshModelPrices: modelPricesQuery.refetch,
    refreshBillingSettings: billingSettingsQuery.refetch,
    refreshBillingTierDiagnostics: billingTierDiagnosticsQuery.refetch,
    refreshModelPriceCandidates: modelPriceCandidatesQuery.refetch,
    createModelPrice: createPriceMutation.mutateAsync,
    createModelPrices: createPricesMutation.mutateAsync,
    updateBillingSettings: updateBillingSettingsMutation.mutateAsync,
    previewModelPriceImport: previewModelPriceImportMutation.mutateAsync,
    applyModelPriceImport: (
      input: ModelPriceImportApplyInput,
      onProgress?: (progress: ModelPriceImportProgress) => void,
    ) => applyModelPriceImportMutation.mutateAsync({ input, onProgress }),
    updateModelPrice: updatePriceMutation.mutateAsync,
    deleteModelPrice: deletePriceMutation.mutateAsync,
    mutating:
      createPriceMutation.isPending ||
      createPricesMutation.isPending ||
      updateBillingSettingsMutation.isPending ||
      previewModelPriceImportMutation.isPending ||
      applyModelPriceImportMutation.isPending ||
      updatePriceMutation.isPending ||
      deletePriceMutation.isPending,
  }
}
