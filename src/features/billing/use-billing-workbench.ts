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
  BillingSettingsUpdate,
  ModelPrice,
  ModelPriceInput,
} from '@/lib/api/management/billing-types'
import { fetchModelsSnapshot, toModelsApiError } from '@/lib/api/management/models'
import { fetchUsersSnapshot, toUserApiError } from '@/lib/api/management/users'
import {
  type BillingModelPriceCandidate,
  createModelPriceCandidates,
} from '@/lib/billing/model-price-candidates'
import type {
  ModelPriceImportApplyInput,
  ModelPriceImportPreviewInput,
  ModelPriceImportProgress,
} from '@/lib/billing/model-price-import-types'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

export type { BillingModelPriceCandidate } from '@/lib/billing/model-price-candidates'

type BillingModelPriceCandidateSnapshot = {
  candidates: BillingModelPriceCandidate[]
  issue: string | null
  missingProviderMetadataCount: number
}

function toError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function readSettledError(result: PromiseSettledResult<unknown>) {
  return result.status === 'rejected' ? toError(result.reason).message : null
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
  const billingSettingsQueryKey = ['billing', 'settings', session.baseUrl, connectedAt]
  const billingSettingsQuery = useQuery({
    queryKey: billingSettingsQueryKey,
    enabled: ready,
    retry: false,
    queryFn: async () => {
      try {
        return await fetchBillingSettings(session)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })
  const reportTimezone = billingSettingsQuery.data?.reportTimezone ?? null
  const reportReady =
    ready &&
    billingSettingsQuery.isSuccess &&
    Boolean(reportTimezone) &&
    filters.timezone === reportTimezone &&
    Boolean(filters.from && filters.to)
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
    enabled: reportReady && activeTab === 'overview',
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
    enabled: reportReady && activeTab === 'charges',
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
    enabled: reportReady && activeTab === 'balanceRecords',
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
      const missingProviderMetadataCount =
        (availableResult.status === 'fulfilled'
          ? availableResult.value.missingProviderMetadataCount
          : 0) +
        (staticResult.status === 'fulfilled' ? staticResult.value.missingProviderMetadataCount : 0)

      if (candidates.length === 0 && issue && missingProviderMetadataCount === 0) {
        throw toModelsApiError(new Error(issue))
      }

      return {
        candidates,
        issue: issue || null,
        missingProviderMetadataCount,
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
    mutationFn: (input: BillingSettingsUpdate) => updateBillingSettings(session, input),
    onSuccess: (settings) => {
      queryClient.setQueryData(billingSettingsQueryKey, settings)
      void queryClient.invalidateQueries({ queryKey: ['billing', 'overview'] })
      void queryClient.invalidateQueries({ queryKey: ['billing', 'charges'] })
      void queryClient.invalidateQueries({ queryKey: ['billing', 'balanceRecords'] })
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
    reportTimezone,
    modelPriceImportPreferenceScope: session.baseUrl,
    overview: overviewQuery.data?.overview ?? null,
    overviewFetchedAt: overviewQuery.data?.fetchedAt ?? null,
    overviewLoading: billingSettingsQuery.isLoading || overviewQuery.isLoading,
    overviewFetching: overviewQuery.isFetching,
    overviewError: billingSettingsQuery.error
      ? toError(billingSettingsQuery.error).message
      : overviewQuery.error
        ? toError(overviewQuery.error).message
        : null,
    charges: chargesQuery.data?.items ?? [],
    chargesTotal: chargesQuery.data?.total ?? 0,
    chargesLoading: billingSettingsQuery.isLoading || chargesQuery.isLoading,
    chargesFetching: chargesQuery.isFetching,
    chargesError: billingSettingsQuery.error
      ? toError(billingSettingsQuery.error).message
      : chargesQuery.error
        ? toError(chargesQuery.error).message
        : null,
    balanceRecords: balanceRecordsQuery.data?.items ?? [],
    balanceRecordsTotal: balanceRecordsQuery.data?.total ?? 0,
    balanceRecordsLoading: billingSettingsQuery.isLoading || balanceRecordsQuery.isLoading,
    balanceRecordsFetching: balanceRecordsQuery.isFetching,
    balanceRecordsError: billingSettingsQuery.error
      ? toError(billingSettingsQuery.error).message
      : balanceRecordsQuery.error
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
    modelPriceCandidatesMissingProviderMetadataCount:
      modelPriceCandidatesQuery.data?.missingProviderMetadataCount ?? 0,
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
