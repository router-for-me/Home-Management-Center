import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchAccessGroupsSnapshot } from '@/lib/api/management/access-groups'
import {
  type AccessKeyResource,
  createAccessKey,
  deleteAccessKey,
  fetchAccessKeysSnapshot,
  replaceAccessKeys,
  toAccessKeyApiError,
  updateAccessKey,
} from '@/lib/api/management/access-keys'
import { fetchUsersSnapshot } from '@/lib/api/management/users'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)
  const capabilityStatus = useCapabilityStore((state) => state.status)
  const capabilities = useCapabilityStore((state) => state.capabilities)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
    capabilityReady: capabilityStatus === 'ready',
    capabilities,
  }
}

export function useAccessKeyWorkbench() {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt, capabilityReady, capabilities } = useManagementSession()
  const queryKey = ['management-access-keys', session.baseUrl, connectedAt]
  const usersQueryKey = [
    'management-access-keys-users',
    session.baseUrl,
    connectedAt,
    capabilities.users,
  ]
  const groupsQueryKey = [
    'management-access-keys-groups',
    session.baseUrl,
    connectedAt,
    capabilities.accessGroups,
  ]
  const canReadUsers =
    connected && capabilityReady && capabilities.users && Boolean(session.managementKey)
  const canReadAccessGroups =
    connected && capabilityReady && capabilities.accessGroups && Boolean(session.managementKey)

  const query = useQuery({
    queryKey,
    enabled: connected && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchAccessKeysSnapshot(session)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
  })
  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    enabled: canReadUsers,
    queryFn: async () => {
      try {
        return await fetchUsersSnapshot(session)
      } catch {
        return {
          fetchedAt: new Date().toISOString(),
          resources: [],
        }
      }
    },
  })
  const groupsQuery = useQuery({
    queryKey: groupsQueryKey,
    enabled: canReadAccessGroups,
    queryFn: async () => {
      try {
        return await fetchAccessGroupsSnapshot(session)
      } catch {
        return {
          fetchedAt: new Date().toISOString(),
          channelGroups: [],
          channelGroupDetails: [],
          modelGroups: [],
          modelGroupDetails: [],
        }
      }
    },
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey })
  }

  const createMutation = useMutation({
    mutationFn: async (value: string) => {
      try {
        return await createAccessKey(session, value)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ resource, value }: { resource: AccessKeyResource; value: string }) => {
      try {
        return await updateAccessKey(session, resource, value)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const replaceMutation = useMutation({
    mutationFn: async (values: string[]) => {
      try {
        return await replaceAccessKeys(session, values)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: async (resource: AccessKeyResource) => {
      try {
        return await deleteAccessKey(session, resource)
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (resources: AccessKeyResource[]) => {
      try {
        const sortedResources = [...resources].sort((left, right) => right.index - left.index)

        for (const resource of sortedResources) {
          await deleteAccessKey(session, resource)
        }
      } catch (error) {
        throw toAccessKeyApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  return {
    connected,
    capabilityReady,
    capabilities,
    snapshot: query.data,
    users: usersQuery.data?.resources ?? [],
    groups: groupsQuery.data ?? null,
    isPending:
      query.isPending ||
      (canReadUsers && usersQuery.isPending) ||
      (canReadAccessGroups && groupsQuery.isPending),
    isFetching:
      query.isFetching ||
      (canReadUsers && usersQuery.isFetching) ||
      (canReadAccessGroups && groupsQuery.isFetching),
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    refetch: () => {
      void query.refetch()
      if (canReadUsers) void usersQuery.refetch()
      if (canReadAccessGroups) void groupsQuery.refetch()
    },
    createKey: createMutation.mutateAsync,
    updateKey: updateMutation.mutateAsync,
    replaceKeys: replaceMutation.mutateAsync,
    deleteKey: deleteMutation.mutateAsync,
    bulkDeleteKeys: bulkDeleteMutation.mutateAsync,
    mutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      replaceMutation.isPending ||
      deleteMutation.isPending ||
      bulkDeleteMutation.isPending,
  }
}
