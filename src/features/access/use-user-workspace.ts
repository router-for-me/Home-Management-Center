import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type UserApiKeyInput,
  type UserApiKeyResource,
  createUserApiKey,
  deleteUserApiKey,
  fetchUserApiKeys,
  updateUserApiKey,
} from '@/lib/api/user/api-keys'
import { type UserAccount, type UserPasskeyResource, fetchUserMe } from '@/lib/api/user/auth'
import { createUserPasskeyWithBrowser, deleteUserPasskey } from '@/lib/api/user/passkeys'
import {
  type BindTotpInput,
  type ChangePasswordInput,
  bindUserTotp,
  changeUserPassword,
  deleteUserTotp,
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
  const syncUser = (nextUser: UserAccount) => {
    updateUser(nextUser)
    queryClient.setQueryData(userQueryKey, nextUser)
  }

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
      syncUser(nextUser)
    },
    onError: toError,
  })

  const deleteTotpMutation = useMutation({
    mutationFn: () => deleteUserTotp(session),
    onSuccess: (nextUser) => {
      syncUser(nextUser)
    },
    onError: toError,
  })

  const changePasswordMutation = useMutation({
    mutationFn: (input: ChangePasswordInput) => changeUserPassword(session, input),
    onSuccess: (nextUser) => {
      syncUser(nextUser)
    },
    onError: toError,
  })

  const createPasskeyMutation = useMutation({
    mutationFn: (input: { name?: string }) => createUserPasskeyWithBrowser(session, input),
    onSuccess: (passkey) => {
      const currentUser =
        queryClient.getQueryData<UserAccount>(userQueryKey) ?? useUserSessionStore.getState().user

      if (!currentUser) return

      syncUser({
        ...currentUser,
        passkeyCount: currentUser.passkeyCount + 1,
        passkeys: passkey
          ? [...currentUser.passkeys.filter((item) => item.id !== passkey.id), passkey]
          : currentUser.passkeys,
      })
    },
    onError: toError,
  })

  const deletePasskeyMutation = useMutation({
    mutationFn: (passkey: UserPasskeyResource) => deleteUserPasskey(session, passkey),
    onSuccess: (_, passkey) => {
      const currentUser =
        queryClient.getQueryData<UserAccount>(userQueryKey) ?? useUserSessionStore.getState().user

      if (!currentUser) return

      syncUser({
        ...currentUser,
        passkeyCount: Math.max(0, currentUser.passkeyCount - 1),
        passkeys: currentUser.passkeys.filter((item) => item.id !== passkey.id),
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
    deleteTotp: deleteTotpMutation.mutateAsync,
    totpDeleting: deleteTotpMutation.isPending,
    changePassword: changePasswordMutation.mutateAsync,
    passwordChanging: changePasswordMutation.isPending,
    passkeys: effectiveUser?.passkeys ?? [],
    createPasskey: createPasskeyMutation.mutateAsync,
    passkeyCreating: createPasskeyMutation.isPending,
    deletePasskey: deletePasskeyMutation.mutateAsync,
    passkeyDeleting: deletePasskeyMutation.isPending,
    apiKeysMutating:
      createKeyMutation.isPending || updateKeyMutation.isPending || deleteKeyMutation.isPending,
    mutating:
      createKeyMutation.isPending ||
      updateKeyMutation.isPending ||
      deleteKeyMutation.isPending ||
      showTotpMutation.isPending ||
      bindTotpMutation.isPending ||
      deleteTotpMutation.isPending ||
      changePasswordMutation.isPending ||
      createPasskeyMutation.isPending ||
      deletePasskeyMutation.isPending,
  }
}
