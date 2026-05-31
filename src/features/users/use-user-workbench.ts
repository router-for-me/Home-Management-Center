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
import {
  type UserFormInput,
  type UserResource,
  createUser,
  deleteUser,
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

function toError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(String(error))
}

export function useUserWorkbench(selectedUserId?: string | null) {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt, capabilityReady, capabilities, runtimeMode } =
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
  const detailQueryKey = ['management-user-detail', session.baseUrl, connectedAt, selectedUserId]

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

  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: usersQueryKey }),
      queryClient.invalidateQueries({ queryKey: detailQueryKey }),
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
    createAccessKeyMutation.isPending ||
    updateAccessKeyBindingsMutation.isPending ||
    deleteAccessKeyMutation.isPending ||
    createGroupMutation.isPending ||
    updateGroupMutation.isPending ||
    deleteGroupMutation.isPending ||
    createGroupDetailMutation.isPending ||
    deleteGroupDetailMutation.isPending

  return {
    connected,
    capabilityReady,
    capabilities,
    runtimeMode,
    users: usersQuery.data?.resources ?? [],
    accessKeys: accessKeysQuery.data?.resources ?? [],
    groups: groupsQuery.data ?? null,
    selectedUser: detailQuery.data ?? null,
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
    createUser: createUserMutation.mutateAsync,
    updateUser: updateUserMutation.mutateAsync,
    deleteUser: deleteUserMutation.mutateAsync,
    createAccessKey: createAccessKeyMutation.mutateAsync,
    updateAccessKeyBindings: updateAccessKeyBindingsMutation.mutateAsync,
    deleteAccessKey: deleteAccessKeyMutation.mutateAsync,
    createGroup: createGroupMutation.mutateAsync,
    updateGroup: updateGroupMutation.mutateAsync,
    deleteGroup: deleteGroupMutation.mutateAsync,
    createGroupDetail: createGroupDetailMutation.mutateAsync,
    deleteGroupDetail: deleteGroupDetailMutation.mutateAsync,
    mutating,
  }
}
