import { useMemo } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { BillingTab } from '@/features/billing/billing-model'
import {
  createDeduction,
  createModelPrice,
  createProxyPool,
  createRecharge,
  deleteModelPrice,
  deleteProxyPool,
  fetchBalanceRecords,
  fetchBillingOverview,
  fetchChargeRecords,
  fetchModelPrices,
  fetchProxyPools,
  testProxyPool,
  toBillingApiError,
  updateModelPrice,
  updateProxyPool,
} from '@/lib/api/management/billing'
import type {
  BalanceOperationInput,
  BillingFilters,
  BillingPagination,
  ModelPrice,
  ModelPriceInput,
  ProxyPoolInput,
  ProxyPoolItem,
} from '@/lib/api/management/billing-types'
import { fetchUsersSnapshot, toUserApiError } from '@/lib/api/management/users'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

function toError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(String(error))
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
  const { session, connected, connectedAt, ready, runtimeMode } = useManagementSession()
  const queryScope = useMemo(
    () => [session.baseUrl, connectedAt, filters] as const,
    [connectedAt, filters, session.baseUrl],
  )
  const overviewQueryKey = ['billing', 'overview', ...queryScope]
  const chargesQueryKey = ['billing', 'charges', ...queryScope, chargePagination]
  const balanceRecordsQueryKey = ['billing', 'balanceRecords', ...queryScope, balancePagination]
  const modelPricesQueryKey = [
    'billing',
    'modelPrices',
    session.baseUrl,
    connectedAt,
    filters.provider,
    filters.model,
  ]
  const proxyPoolsQueryKey = ['billing', 'proxyPools', session.baseUrl, connectedAt]
  const usersQueryKey = ['billing', 'users', session.baseUrl, connectedAt]

  const overviewQuery = useQuery({
    queryKey: overviewQueryKey,
    enabled: ready && activeTab === 'overview',
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
    queryFn: async () => {
      try {
        return await fetchModelPrices(session, filters)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })

  const proxyPoolsQuery = useQuery({
    queryKey: proxyPoolsQueryKey,
    enabled: ready && activeTab === 'proxyPools',
    queryFn: async () => {
      try {
        return await fetchProxyPools(session)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
  })

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    enabled: ready && activeTab === 'balanceRecords',
    queryFn: async () => {
      try {
        return await fetchUsersSnapshot(session)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
  })

  const invalidateOverview = () => queryClient.invalidateQueries({ queryKey: overviewQueryKey })
  const invalidateBalanceRecords = () =>
    queryClient.invalidateQueries({ queryKey: ['billing', 'balanceRecords'] })
  const invalidateModelPrices = () =>
    queryClient.invalidateQueries({ queryKey: ['billing', 'modelPrices'] })
  const invalidateProxyPools = () =>
    queryClient.invalidateQueries({ queryKey: ['billing', 'proxyPools'] })
  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: usersQueryKey })
  const invalidateUserBilling = () => queryClient.invalidateQueries({ queryKey: ['userBilling'] })

  const rechargeMutation = useMutation({
    mutationFn: (input: BalanceOperationInput) => createRecharge(session, input),
    onSuccess: () => {
      void invalidateOverview()
      void invalidateBalanceRecords()
      void invalidateUsers()
      void invalidateUserBilling()
    },
    onError: toError,
  })

  const deductionMutation = useMutation({
    mutationFn: (input: BalanceOperationInput) => createDeduction(session, input),
    onSuccess: () => {
      void invalidateOverview()
      void invalidateBalanceRecords()
      void invalidateUsers()
      void invalidateUserBilling()
    },
    onError: toError,
  })

  const createPriceMutation = useMutation({
    mutationFn: (input: ModelPriceInput) => createModelPrice(session, input),
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

  const createProxyMutation = useMutation({
    mutationFn: (input: ProxyPoolInput) => createProxyPool(session, input),
    onSuccess: () => {
      void invalidateProxyPools()
    },
    onError: toError,
  })

  const updateProxyMutation = useMutation({
    mutationFn: ({ resource, input }: { resource: ProxyPoolItem; input: ProxyPoolInput }) =>
      updateProxyPool(session, resource, input),
    onSuccess: () => {
      void invalidateProxyPools()
    },
    onError: toError,
  })

  const deleteProxyMutation = useMutation({
    mutationFn: (resource: ProxyPoolItem) => deleteProxyPool(session, resource),
    onSuccess: () => {
      void invalidateProxyPools()
    },
    onError: toError,
  })

  const testProxyMutation = useMutation({
    mutationFn: (resource: ProxyPoolItem) => testProxyPool(session, resource),
    onSuccess: () => {
      void invalidateProxyPools()
    },
    onError: toError,
  })

  return {
    connected,
    ready,
    runtimeMode,
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
    modelPricesLoading: modelPricesQuery.isLoading,
    modelPricesFetching: modelPricesQuery.isFetching,
    modelPricesError: modelPricesQuery.error ? toError(modelPricesQuery.error).message : null,
    proxyPools: proxyPoolsQuery.data?.items ?? [],
    proxyPoolsLoading: proxyPoolsQuery.isLoading,
    proxyPoolsFetching: proxyPoolsQuery.isFetching,
    proxyPoolsError: proxyPoolsQuery.error ? toError(proxyPoolsQuery.error).message : null,
    users: usersQuery.data?.resources ?? [],
    usersLoading: usersQuery.isLoading,
    usersError: usersQuery.error ? toError(usersQuery.error).message : null,
    refreshOverview: overviewQuery.refetch,
    refreshCharges: chargesQuery.refetch,
    refreshBalanceRecords: balanceRecordsQuery.refetch,
    refreshModelPrices: modelPricesQuery.refetch,
    refreshProxyPools: proxyPoolsQuery.refetch,
    recharge: rechargeMutation.mutateAsync,
    deduct: deductionMutation.mutateAsync,
    createModelPrice: createPriceMutation.mutateAsync,
    updateModelPrice: updatePriceMutation.mutateAsync,
    deleteModelPrice: deletePriceMutation.mutateAsync,
    createProxyPool: createProxyMutation.mutateAsync,
    updateProxyPool: updateProxyMutation.mutateAsync,
    deleteProxyPool: deleteProxyMutation.mutateAsync,
    testProxyPool: testProxyMutation.mutateAsync,
    mutating:
      rechargeMutation.isPending ||
      deductionMutation.isPending ||
      createPriceMutation.isPending ||
      updatePriceMutation.isPending ||
      deletePriceMutation.isPending ||
      createProxyMutation.isPending ||
      updateProxyMutation.isPending ||
      deleteProxyMutation.isPending ||
      testProxyMutation.isPending,
  }
}
