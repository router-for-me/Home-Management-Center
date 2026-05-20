import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type AccessKeyResource,
  createAccessKey,
  deleteAccessKey,
  fetchAccessKeysSnapshot,
  replaceAccessKeys,
  toAccessKeyApiError,
  updateAccessKey,
} from '@/lib/api/management/access-keys'
import { useSessionStore } from '@/stores/session-store'

function useManagementSession() {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const status = useSessionStore((state) => state.status)

  return {
    session: {
      baseUrl,
      managementKey,
    },
    connectedAt,
    connected: status === 'connected',
  }
}

export function useAccessKeyWorkbench() {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt } = useManagementSession()
  const queryKey = ['management-access-keys', session.baseUrl, connectedAt]

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
    snapshot: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    refetch: () => {
      void query.refetch()
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
