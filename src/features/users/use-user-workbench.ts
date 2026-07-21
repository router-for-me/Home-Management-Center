import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type AccessGroupDetailInput,
  type AccessGroupDetailResource,
  type AccessGroupInput,
  type AccessGroupKind,
  type AccessGroupResource,
  createAccessGroup,
  createAccessGroupDetail,
  deleteAccessGroup,
  deleteAccessGroupDetail,
  fetchAccessGroupsSnapshot,
  toAccessGroupsApiError,
  updateAccessGroup,
} from '@/lib/api/management/access-groups'
import {
  type AccessKeyFormInput,
  type AccessKeyResource,
  createAccessKey,
  deleteAccessKey,
  fetchAccessKeysSnapshot,
  toAccessKeyApiError,
  updateAccessKeyBindings,
} from '@/lib/api/management/access-keys'
import { createDeduction, createRecharge, toBillingApiError } from '@/lib/api/management/billing'
import type { BalanceOperationInput } from '@/lib/api/management/billing-types'
import {
  type CredentialResource,
  fetchCredentialSnapshot,
  getCredentialBindingAuthId,
  toCredentialApiError,
} from '@/lib/api/management/credentials'
import {
  type ManagementModelScope,
  type ModelResource,
  fetchModelsSnapshot,
  toModelsApiError,
} from '@/lib/api/management/models'
import {
  type ProviderResource,
  fetchProviderSnapshot,
  getProviderBindingAuthId,
} from '@/lib/api/management/providers'
import {
  type UserFormInput,
  type UserPeriodResetInput,
  type UserResource,
  createUser,
  deleteUser,
  fetchUserDetail,
  fetchUserPeriodLimits,
  fetchUsersSnapshot,
  resetUserPeriodLimits,
  toUserApiError,
  updateUser,
} from '@/lib/api/management/users'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

export type CredentialBindingCandidate = {
  id: string
  authId: string
  label: string
  provider: string
  type: string
  status: string | null
  disabled: boolean
  unavailable: boolean
  source: 'credential' | 'provider'
}

type CredentialBindingCandidateSnapshot = {
  candidates: CredentialBindingCandidate[]
  issue: string | null
}

export type ModelBindingCandidate = {
  id: string
  modelId: string
  label: string
  ownedBy: string | null
  type: string | null
  channel: string | null
  scopes: ManagementModelScope[]
}

type ModelBindingCandidateSnapshot = {
  candidates: ModelBindingCandidate[]
  issue: string | null
}

type CreateAccessGroupDetailsInput = {
  kind: AccessGroupKind
  inputs: AccessGroupDetailInput[]
}

type CreateAccessGroupDetailsResult = {
  createdCount: number
  failed: Array<{
    input: AccessGroupDetailInput
    message: string
  }>
}

type BalanceBatchResult = {
  succeeded: number
  failed: number
  firstError: string | null
}

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)
  const capabilityStatus = useCapabilityStore((state) => state.status)
  const capabilities = useCapabilityStore((state) => state.capabilities)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
    checking: status === 'checking',
    capabilityReady: capabilityStatus === 'ready',
    capabilities,
    runtimeMode,
  }
}

function toError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function normalizeCredentialCandidate(resource: CredentialResource): CredentialBindingCandidate {
  const authId = getCredentialBindingAuthId(resource)

  return {
    id: `credential:${authId}`,
    authId,
    label: resource.label ?? resource.email ?? resource.account ?? resource.name ?? authId,
    provider: resource.provider,
    type: resource.type,
    status: resource.status,
    disabled: resource.disabled,
    unavailable: resource.unavailable,
    source: 'credential',
  }
}

function normalizeProviderCandidate(resource: ProviderResource): CredentialBindingCandidate | null {
  const authId = getProviderBindingAuthId(resource)
  if (!authId) return null

  return {
    id: `provider:${authId}`,
    authId,
    label: resource.name ?? resource.identifier ?? authId,
    provider: resource.providerId,
    type: 'api-key',
    status: null,
    disabled: resource.disabled,
    unavailable: false,
    source: 'provider',
  }
}

function createCredentialBindingCandidates(
  credentials: CredentialResource[],
  providers: ProviderResource[],
) {
  const candidates = [
    ...credentials.map(normalizeCredentialCandidate),
    ...providers
      .map(normalizeProviderCandidate)
      .filter((item): item is CredentialBindingCandidate => Boolean(item)),
  ]
  const seenAuthIds = new Set<string>()

  return candidates.filter((candidate) => {
    if (seenAuthIds.has(candidate.authId)) return false
    seenAuthIds.add(candidate.authId)
    return true
  })
}

function normalizeModelCandidate(resource: ModelResource): ModelBindingCandidate {
  return {
    id: `model:${resource.id}`,
    modelId: resource.id,
    label: resource.displayName,
    ownedBy: resource.ownedBy,
    type: resource.type,
    channel: resource.channel,
    scopes: [resource.scope],
  }
}

function createModelBindingCandidates(available: ModelResource[], staticModels: ModelResource[]) {
  const candidates = new Map<string, ModelBindingCandidate>()

  for (const resource of [...available, ...staticModels]) {
    const existing = candidates.get(resource.id)

    if (!existing) {
      candidates.set(resource.id, normalizeModelCandidate(resource))
      continue
    }

    if (!existing.scopes.includes(resource.scope)) {
      existing.scopes.push(resource.scope)
    }

    existing.ownedBy = existing.ownedBy ?? resource.ownedBy
    existing.type = existing.type ?? resource.type
    existing.channel = existing.channel ?? resource.channel
  }

  return [...candidates.values()].sort((left, right) => {
    const leftAvailable = left.scopes.includes('available') ? 0 : 1
    const rightAvailable = right.scopes.includes('available') ? 0 : 1

    return leftAvailable - rightAvailable || left.modelId.localeCompare(right.modelId)
  })
}

function readSettledError(result: PromiseSettledResult<unknown>) {
  return result.status === 'rejected' ? toError(result.reason).message : null
}

export function useUserWorkbench(
  selectedUserId?: string | null,
  loadCredentialCandidates = false,
  loadModelCandidates = false,
  loadPeriodLimits = false,
) {
  const queryClient = useQueryClient()
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const usersEnabled =
    connected && capabilityReady && capabilities.users && Boolean(session.managementKey)
  const accessGroupsEnabled =
    connected && capabilityReady && capabilities.accessGroups && Boolean(session.managementKey)
  const usersQueryKey = ['management-users', session.baseUrl, connectedAt, capabilities.users]
  const accessKeysQueryKey = ['management-access-keys', session.baseUrl, connectedAt]
  const groupsQueryKey = [
    'management-access-groups',
    session.baseUrl,
    connectedAt,
    capabilities.accessGroups,
  ]
  const credentialCandidatesQueryKey = [
    'management-credential-binding-candidates',
    session.baseUrl,
    connectedAt,
    runtimeMode,
  ]
  const modelCandidatesQueryKey = [
    'management-model-binding-candidates',
    session.baseUrl,
    connectedAt,
  ]
  const detailQueryKey = ['management-user-detail', session.baseUrl, connectedAt, selectedUserId]
  const periodLimitsQueryKey = [
    'management-user-period-limits',
    session.baseUrl,
    connectedAt,
    selectedUserId,
  ]

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    enabled: usersEnabled,
    queryFn: async () => {
      try {
        return await fetchUsersSnapshot(session)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
  })

  const accessKeysQuery = useQuery({
    queryKey: accessKeysQueryKey,
    enabled: usersEnabled,
    queryFn: async () => {
      try {
        return await fetchAccessKeysSnapshot(session)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
  })

  const groupsQuery = useQuery({
    queryKey: groupsQueryKey,
    enabled: accessGroupsEnabled,
    queryFn: async () => {
      try {
        return await fetchAccessGroupsSnapshot(session)
      } catch (error) {
        throw toAccessGroupsApiError(error)
      }
    },
  })

  const credentialCandidatesQuery = useQuery({
    queryKey: credentialCandidatesQueryKey,
    enabled: accessGroupsEnabled && loadCredentialCandidates,
    queryFn: async (): Promise<CredentialBindingCandidateSnapshot> => {
      const [credentialsResult, providersResult] = await Promise.allSettled([
        fetchCredentialSnapshot(session),
        fetchProviderSnapshot(session, runtimeMode),
      ])
      const credentialResources =
        credentialsResult.status === 'fulfilled' ? credentialsResult.value.resources : []
      const providerResources =
        providersResult.status === 'fulfilled'
          ? providersResult.value.groups.flatMap((group) => group.resources)
          : []
      const candidates = createCredentialBindingCandidates(credentialResources, providerResources)
      const issue = [readSettledError(credentialsResult), readSettledError(providersResult)]
        .filter(Boolean)
        .join('\n')

      if (candidates.length === 0 && issue) {
        throw toCredentialApiError(new Error(issue))
      }

      return {
        candidates,
        issue: issue || null,
      }
    },
  })

  const modelCandidatesQuery = useQuery({
    queryKey: modelCandidatesQueryKey,
    enabled: accessGroupsEnabled && loadModelCandidates,
    queryFn: async (): Promise<ModelBindingCandidateSnapshot> => {
      const [availableResult, staticResult] = await Promise.allSettled([
        fetchModelsSnapshot(session, { scope: 'available' }),
        fetchModelsSnapshot(session, { scope: 'static' }),
      ])
      const availableResources =
        availableResult.status === 'fulfilled' ? availableResult.value.resources : []
      const staticResources =
        staticResult.status === 'fulfilled' ? staticResult.value.resources : []
      const candidates = createModelBindingCandidates(availableResources, staticResources)
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

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    enabled: usersEnabled && Boolean(selectedUserId),
    queryFn: async () => {
      if (!selectedUserId) throw new Error('Missing user id')

      try {
        return await fetchUserDetail(session, selectedUserId)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
  })

  const periodLimitsQuery = useQuery({
    queryKey: periodLimitsQueryKey,
    enabled:
      usersEnabled && capabilities.userPeriodLimits && Boolean(selectedUserId) && loadPeriodLimits,
    queryFn: async () => {
      if (!selectedUserId) throw new Error('Missing user id')

      try {
        return await fetchUserPeriodLimits(session, selectedUserId)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
  })

  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: usersQueryKey }),
      queryClient.invalidateQueries({ queryKey: detailQueryKey }),
      queryClient.invalidateQueries({ queryKey: periodLimitsQueryKey }),
    ])
  }

  const invalidateAccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: usersQueryKey }),
      queryClient.invalidateQueries({ queryKey: accessKeysQueryKey }),
      queryClient.invalidateQueries({ queryKey: groupsQueryKey }),
      queryClient.invalidateQueries({ queryKey: detailQueryKey }),
    ])
  }

  const createUserMutation = useMutation({
    mutationFn: async (input: UserFormInput) => {
      try {
        return await createUser(session, input)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
    onSuccess: invalidateUsers,
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({ user, input }: { user: UserResource; input: UserFormInput }) => {
      try {
        return await updateUser(session, user, input)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
    onSuccess: invalidateUsers,
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (user: UserResource) => {
      try {
        return await deleteUser(session, user)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const resetPeriodLimitsMutation = useMutation({
    mutationFn: async ({ user, input }: { user: UserResource; input: UserPeriodResetInput }) => {
      try {
        return await resetUserPeriodLimits(session, user.id, input)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
    onSuccess: async (status) => {
      // The reset response carries the complete post-reset status; write it
      // straight into the cache and only fall back to a refetch when the
      // backend does not return it.
      if (status) {
        queryClient.setQueryData(periodLimitsQueryKey, status)
        return
      }
      await queryClient.invalidateQueries({ queryKey: periodLimitsQueryKey })
    },
  })

  const invalidateBalanceAfterOperation = async () => {
    await Promise.all([
      invalidateUsers(),
      queryClient.invalidateQueries({ queryKey: ['billing', 'balanceRecords'] }),
      queryClient.invalidateQueries({ queryKey: ['billing', 'overview'] }),
      queryClient.invalidateQueries({ queryKey: ['userBilling'] }),
    ])
  }

  const rechargeMutation = useMutation({
    mutationFn: async (input: BalanceOperationInput) => {
      try {
        return await createRecharge(session, input)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
    onSuccess: invalidateBalanceAfterOperation,
  })

  const deductionMutation = useMutation({
    mutationFn: async (input: BalanceOperationInput) => {
      try {
        return await createDeduction(session, input)
      } catch (error) {
        throw toBillingApiError(error)
      }
    },
    onSuccess: invalidateBalanceAfterOperation,
  })

  const rechargeBatchMutation = useMutation({
    mutationFn: async (inputs: BalanceOperationInput[]): Promise<BalanceBatchResult> => {
      let succeeded = 0
      let failed = 0
      let firstError: string | null = null

      for (const input of inputs) {
        try {
          await createRecharge(session, input)
          succeeded += 1
        } catch (error) {
          failed += 1
          firstError ??= toBillingApiError(error).message
        }
      }

      return { succeeded, failed, firstError }
    },
    onSuccess: invalidateBalanceAfterOperation,
  })

  const deductionBatchMutation = useMutation({
    mutationFn: async (inputs: BalanceOperationInput[]): Promise<BalanceBatchResult> => {
      let succeeded = 0
      let failed = 0
      let firstError: string | null = null

      for (const input of inputs) {
        try {
          await createDeduction(session, input)
          succeeded += 1
        } catch (error) {
          failed += 1
          firstError ??= toBillingApiError(error).message
        }
      }

      return { succeeded, failed, firstError }
    },
    onSuccess: invalidateBalanceAfterOperation,
  })

  const createAccessKeyMutation = useMutation({
    mutationFn: async (input: AccessKeyFormInput) => {
      try {
        return await createAccessKey(session, input)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const updateAccessKeyBindingsMutation = useMutation({
    mutationFn: async ({
      resource,
      input,
    }: {
      resource: AccessKeyResource
      input: Omit<AccessKeyFormInput, 'value'>
    }) => {
      try {
        return await updateAccessKeyBindings(session, resource, input)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const deleteAccessKeyMutation = useMutation({
    mutationFn: async (resource: AccessKeyResource) => {
      try {
        return await deleteAccessKey(session, resource)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const createGroupMutation = useMutation({
    mutationFn: async ({ kind, input }: { kind: AccessGroupKind; input: AccessGroupInput }) => {
      try {
        return await createAccessGroup(session, kind, input)
      } catch (error) {
        throw toAccessGroupsApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const updateGroupMutation = useMutation({
    mutationFn: async ({
      group,
      input,
    }: {
      group: AccessGroupResource
      input: AccessGroupInput
    }) => {
      try {
        return await updateAccessGroup(session, group, input)
      } catch (error) {
        throw toAccessGroupsApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const deleteGroupMutation = useMutation({
    mutationFn: async (group: AccessGroupResource) => {
      try {
        return await deleteAccessGroup(session, group)
      } catch (error) {
        throw toAccessGroupsApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const createGroupDetailMutation = useMutation({
    mutationFn: async ({
      kind,
      input,
    }: {
      kind: AccessGroupKind
      input: AccessGroupDetailInput
    }) => {
      try {
        return await createAccessGroupDetail(session, kind, input)
      } catch (error) {
        throw toAccessGroupsApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const createGroupDetailsMutation = useMutation({
    mutationFn: async ({
      kind,
      inputs,
    }: CreateAccessGroupDetailsInput): Promise<CreateAccessGroupDetailsResult> => {
      const results = await Promise.allSettled(
        inputs.map((input) => createAccessGroupDetail(session, kind, input)),
      )
      const failed = results.flatMap((result, index) => {
        if (result.status === 'fulfilled') return []

        return [
          {
            input: inputs[index],
            message: toAccessGroupsApiError(result.reason).message,
          },
        ]
      })

      return {
        createdCount: results.length - failed.length,
        failed,
      }
    },
    onSuccess: invalidateAccess,
  })

  const deleteGroupDetailMutation = useMutation({
    mutationFn: async (detail: AccessGroupDetailResource) => {
      try {
        return await deleteAccessGroupDetail(session, detail)
      } catch (error) {
        throw toAccessGroupsApiError(error)
      }
    },
    onSuccess: invalidateAccess,
  })

  const firstError =
    usersQuery.error ?? accessKeysQuery.error ?? groupsQuery.error ?? detailQuery.error ?? null
  const mutating =
    createUserMutation.isPending ||
    updateUserMutation.isPending ||
    deleteUserMutation.isPending ||
    resetPeriodLimitsMutation.isPending ||
    rechargeMutation.isPending ||
    deductionMutation.isPending ||
    rechargeBatchMutation.isPending ||
    deductionBatchMutation.isPending ||
    createAccessKeyMutation.isPending ||
    updateAccessKeyBindingsMutation.isPending ||
    deleteAccessKeyMutation.isPending ||
    createGroupMutation.isPending ||
    updateGroupMutation.isPending ||
    deleteGroupMutation.isPending ||
    createGroupDetailMutation.isPending ||
    createGroupDetailsMutation.isPending ||
    deleteGroupDetailMutation.isPending

  return {
    connected,
    checking,
    capabilityReady,
    capabilities,
    runtimeMode,
    users: usersQuery.data?.resources ?? [],
    accessKeys: accessKeysQuery.data?.resources ?? [],
    groups: groupsQuery.data ?? null,
    credentialCandidates: credentialCandidatesQuery.data?.candidates ?? [],
    credentialCandidatesPending: credentialCandidatesQuery.isPending,
    credentialCandidatesIssueMessage: credentialCandidatesQuery.data?.issue ?? null,
    credentialCandidatesErrorMessage: credentialCandidatesQuery.error
      ? toError(credentialCandidatesQuery.error).message
      : null,
    modelCandidates: modelCandidatesQuery.data?.candidates ?? [],
    modelCandidatesPending: modelCandidatesQuery.isPending,
    modelCandidatesIssueMessage: modelCandidatesQuery.data?.issue ?? null,
    modelCandidatesErrorMessage: modelCandidatesQuery.error
      ? toError(modelCandidatesQuery.error).message
      : null,
    selectedUser: detailQuery.data ?? null,
    selectedUserPeriodLimits: periodLimitsQuery.data ?? null,
    isFetchingPeriodLimits: periodLimitsQuery.isFetching,
    periodLimitsErrorMessage: periodLimitsQuery.error
      ? toError(periodLimitsQuery.error).message
      : null,
    refetchPeriodLimits: () => {
      void periodLimitsQuery.refetch()
    },
    fetchedAt: usersQuery.data?.fetchedAt ?? null,
    isPending:
      usersQuery.isPending ||
      accessKeysQuery.isPending ||
      (accessGroupsEnabled && groupsQuery.isPending),
    isFetching:
      usersQuery.isFetching ||
      accessKeysQuery.isFetching ||
      (accessGroupsEnabled && groupsQuery.isFetching),
    isError:
      usersQuery.isError || accessKeysQuery.isError || (accessGroupsEnabled && groupsQuery.isError),
    errorMessage: firstError ? toError(firstError).message : null,
    isFetchingSelectedUser: detailQuery.isFetching,
    selectedUserErrorMessage: detailQuery.error ? toError(detailQuery.error).message : null,
    refetch: () => {
      void usersQuery.refetch()
      void accessKeysQuery.refetch()
      if (accessGroupsEnabled) void groupsQuery.refetch()
    },
    refetchCredentialCandidates: () => {
      void credentialCandidatesQuery.refetch()
    },
    refetchModelCandidates: () => {
      void modelCandidatesQuery.refetch()
    },
    createUser: createUserMutation.mutateAsync,
    updateUser: updateUserMutation.mutateAsync,
    deleteUser: deleteUserMutation.mutateAsync,
    resetPeriodLimits: resetPeriodLimitsMutation.mutateAsync,
    recharge: rechargeMutation.mutateAsync,
    deduct: deductionMutation.mutateAsync,
    rechargeBatch: rechargeBatchMutation.mutateAsync,
    deductBatch: deductionBatchMutation.mutateAsync,
    createAccessKey: createAccessKeyMutation.mutateAsync,
    updateAccessKeyBindings: updateAccessKeyBindingsMutation.mutateAsync,
    deleteAccessKey: deleteAccessKeyMutation.mutateAsync,
    createGroup: createGroupMutation.mutateAsync,
    updateGroup: updateGroupMutation.mutateAsync,
    deleteGroup: deleteGroupMutation.mutateAsync,
    createGroupDetail: createGroupDetailMutation.mutateAsync,
    createGroupDetails: createGroupDetailsMutation.mutateAsync,
    deleteGroupDetail: deleteGroupDetailMutation.mutateAsync,
    mutating,
  }
}
