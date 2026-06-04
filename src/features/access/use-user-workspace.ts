import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchUserMe,
} from '@/lib/api/user/auth'
import {
  type UserApiKeyInput,
  type UserApiKeyResource,
  createUserApiKey,
  deleteUserApiKey,
  fetchUserApiKeys,
  updateUserApiKey,
} from '@/lib/api/user/api-keys'
import { createUserPasskeyWithBrowser } from '@/lib/api/user/passkeys'
import {
  type BindTotpInput,
  type ChangePasswordInput,
  bindUserTotp,
  changeUserPassword,
  fetchUserTotpSetup,
} from '@/lib/api/user/security'
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
  const updateUser = useUserSessionStore((state) => state.updateUser)
  const authenticated = status === 'authenticated' && Boolean(token)
  const session = {
    baseUrl,
    token: token ?? '',
  }
  const apiKeysQueryKey = ['user-api-keys', baseUrl, token]
  const userQueryKey = ['user-info', baseUrl, token]

  const userQuery = useQuery({
    queryKey: userQueryKey,
    enabled: authenticated,
    queryFn: () => fetchUserMe(session),
    staleTime: 30_000,
  })

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

  const showTotpMutation = useMutation({
    mutationFn: (input: { regenerate?: boolean }) => fetchUserTotpSetup(session, input),
    onError: toError,
  })

  const bindTotpMutation = useMutation({
    mutationFn: (input: BindTotpInput) => bindUserTotp(session, input),
    onSuccess: (nextUser) => {
      updateUser(nextUser)
    },
    onError: toError,
  })

  const changePasswordMutation = useMutation({
    mutationFn: (input: ChangePasswordInput) => changeUserPassword(session, input),
    onSuccess: (nextUser) => {
      updateUser(nextUser)
    },
    onError: toError,
  })

  const createPasskeyMutation = useMutation({
    mutationFn: (input: { name?: string }) => createUserPasskeyWithBrowser(session, input),
    onSuccess: () => {
      if (!user) return

      updateUser({
        ...user,
        passkeyCount: user.passkeyCount + 1,
      })
    },
    onError: toError,
  })

  const effectiveUser = userQuery.data ?? user

  return {
    user: effectiveUser,
    userLoading: userQuery.isLoading,
    authenticated,
    apiKeys: apiKeysQuery.data ?? [],
    apiKeysLoading: apiKeysQuery.isLoading,
    apiKeysFetching: apiKeysQuery.isFetching,
    apiKeysError: apiKeysQuery.error ? toError(apiKeysQuery.error).message : null,
    refreshApiKeys: apiKeysQuery.refetch,
    createApiKey: createKeyMutation.mutateAsync,
    updateApiKey: updateKeyMutation.mutateAsync,
    deleteApiKey: deleteKeyMutation.mutateAsync,
    showTotpSetup: showTotpMutation.mutateAsync,
    totpSetup: showTotpMutation.data ?? null,
    totpSetupLoading: showTotpMutation.isPending,
    bindTotp: bindTotpMutation.mutateAsync,
    totpBinding: bindTotpMutation.isPending,
    changePassword: changePasswordMutation.mutateAsync,
    passwordChanging: changePasswordMutation.isPending,
    createPasskey: createPasskeyMutation.mutateAsync,
    passkeyCreating: createPasskeyMutation.isPending,
    apiKeysMutating:
      createKeyMutation.isPending || updateKeyMutation.isPending || deleteKeyMutation.isPending,
    mutating:
      createKeyMutation.isPending ||
      updateKeyMutation.isPending ||
      deleteKeyMutation.isPending ||
      showTotpMutation.isPending ||
      bindTotpMutation.isPending ||
      changePasswordMutation.isPending ||
      createPasskeyMutation.isPending,
  }
}
