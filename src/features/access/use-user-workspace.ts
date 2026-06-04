import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type UserApiKeyInput,
  type UserApiKeyResource,
  createUserApiKey,
  deleteUserApiKey,
  fetchUserApiKeys,
  updateUserApiKey,
} from '@/lib/api/user/api-keys'
import { useUserSessionStore } from '@/stores/user-session-store'

function toError(error: unknown) {
  if (error instanceof Error) return error
  if (
    typeof error === 'object' &&
    error !== null &&
    !Array.isArray(error) &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return new Error((error as { message: string }).message, { cause: error })
  }

  return new Error(String(error))
}

export function useUserWorkspace() {
  const queryClient = useQueryClient()
  const status = useUserSessionStore((state) => state.status)
  const baseUrl = useUserSessionStore((state) => state.baseUrl)
  const token = useUserSessionStore((state) => state.token)
  const user = useUserSessionStore((state) => state.user)
  const authenticated = status === 'authenticated' && Boolean(token)
  const session = {
    baseUrl,
    token: token ?? '',
  }
  const apiKeysQueryKey = ['user-api-keys', baseUrl, token]

  const apiKeysQuery = useQuery({
    queryKey: apiKeysQueryKey,
    enabled: authenticated,
    queryFn: () => fetchUserApiKeys(session),
  })

  const invalidateApiKeys = () => queryClient.invalidateQueries({ queryKey: apiKeysQueryKey })

  const createKeyMutation = useMutation({
    mutationFn: (input: UserApiKeyInput) => createUserApiKey(session, input),
    onSuccess: () => {
      void invalidateApiKeys()
    },
    onError: toError,
  })

  const updateKeyMutation = useMutation({
    mutationFn: ({ resource, input }: { resource: UserApiKeyResource; input: UserApiKeyInput }) =>
      updateUserApiKey(session, resource, input),
    onSuccess: () => {
      void invalidateApiKeys()
    },
    onError: toError,
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (resource: UserApiKeyResource) => deleteUserApiKey(session, resource),
    onSuccess: () => {
      void invalidateApiKeys()
    },
    onError: toError,
  })

  return {
    user,
    authenticated,
    apiKeys: apiKeysQuery.data ?? [],
    apiKeysLoading: apiKeysQuery.isLoading,
    apiKeysFetching: apiKeysQuery.isFetching,
    apiKeysError: apiKeysQuery.error ? toError(apiKeysQuery.error).message : null,
    refreshApiKeys: apiKeysQuery.refetch,
    createApiKey: createKeyMutation.mutateAsync,
    updateApiKey: updateKeyMutation.mutateAsync,
    deleteApiKey: deleteKeyMutation.mutateAsync,
    mutating:
      createKeyMutation.isPending || updateKeyMutation.isPending || deleteKeyMutation.isPending,
  }
}
