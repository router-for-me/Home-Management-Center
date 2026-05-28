import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type UserFormInput,
  type UserResource,
  createUser,
  disableUser,
  enableUser,
  fetchUserDetail,
  fetchUsersSnapshot,
  toUserApiError,
  updateUser,
} from '@/lib/api/management/users'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

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
    capabilityReady: capabilityStatus === 'ready',
    capabilities,
    runtimeMode,
  }
}

export function useUserWorkbench(selectedUserId?: string | null) {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const queryKey = ['management-users', session.baseUrl, connectedAt, capabilities.users]
  const detailQueryKey = ['management-user-detail', session.baseUrl, connectedAt, selectedUserId]
  const enabled =
    connected && capabilityReady && capabilities.users && Boolean(session.managementKey)

  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      try {
        return await fetchUsersSnapshot(session)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
  })

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    enabled: enabled && Boolean(selectedUserId),
    queryFn: async () => {
      if (!selectedUserId) {
        throw new Error('Missing user id')
      }

      try {
        return await fetchUserDetail(session, selectedUserId)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: detailQueryKey }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: async (input: UserFormInput) => {
      try {
        return await createUser(session, input)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ user, input }: { user: UserResource; input: UserFormInput }) => {
      try {
        return await updateUser(session, user, input)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const enableMutation = useMutation({
    mutationFn: async (user: UserResource) => {
      try {
        return await enableUser(session, user)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const disableMutation = useMutation({
    mutationFn: async (user: UserResource) => {
      try {
        return await disableUser(session, user)
      } catch (error) {
        throw toUserApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  return {
    connected,
    capabilityReady,
    capabilities,
    runtimeMode,
    snapshot: query.data,
    selectedUser: detailQuery.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    isFetchingSelectedUser: detailQuery.isFetching,
    selectedUserErrorMessage: detailQuery.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
    refetchSelectedUser: () => {
      void detailQuery.refetch()
    },
    createUser: createMutation.mutateAsync,
    updateUser: updateMutation.mutateAsync,
    enableUser: enableMutation.mutateAsync,
    disableUser: disableMutation.mutateAsync,
    mutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      enableMutation.isPending ||
      disableMutation.isPending,
  }
}
