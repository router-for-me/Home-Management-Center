import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type CredentialMetadataInput,
  type CredentialOAuthCallbackInput,
  type CredentialOAuthStartInput,
  type CredentialResource,
  type VertexImportInput,
  deleteCredentialResource,
  downloadCredentialResource,
  fetchCredentialModels,
  fetchCredentialOAuthStatus,
  fetchCredentialSnapshot,
  importVertexCredential,
  startCredentialOAuth,
  submitCredentialOAuthCallback,
  toCredentialApiError,
  updateCredentialMetadata,
  updateCredentialStatus,
  uploadCredentialFiles,
} from '@/lib/api/management/credentials'
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

export function useCredentialWorkbench() {
  const queryClient = useQueryClient()
  const { session, connected, connectedAt } = useManagementSession()
  const queryKey = ['management-credentials', session.baseUrl, connectedAt]

  const query = useQuery({
    queryKey,
    enabled: connected && Boolean(session.managementKey),
    queryFn: async () => {
      try {
        return await fetchCredentialSnapshot(session)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey })
  }

  const statusMutation = useMutation({
    mutationFn: async ({
      resource,
      disabled,
    }: {
      resource: CredentialResource
      disabled: boolean
    }) => {
      try {
        return await updateCredentialStatus(session, resource, disabled)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const metadataMutation = useMutation({
    mutationFn: async ({
      resource,
      input,
    }: {
      resource: CredentialResource
      input: CredentialMetadataInput
    }) => {
      try {
        return await updateCredentialMetadata(session, resource, input)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: async (resource: CredentialResource) => {
      try {
        return await deleteCredentialResource(session, resource)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      try {
        return await uploadCredentialFiles(session, files)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const downloadMutation = useMutation({
    mutationFn: async (resource: CredentialResource) => {
      try {
        return await downloadCredentialResource(session, resource)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const modelsMutation = useMutation({
    mutationFn: async (resource: CredentialResource) => {
      try {
        return await fetchCredentialModels(session, resource)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const oauthMutation = useMutation({
    mutationFn: async (input: CredentialOAuthStartInput) => {
      try {
        return await startCredentialOAuth(session, input)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const oauthStatusMutation = useMutation({
    mutationFn: async (state?: string) => {
      try {
        return await fetchCredentialOAuthStatus(session, state)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
  })

  const oauthCallbackMutation = useMutation({
    mutationFn: async (input: CredentialOAuthCallbackInput) => {
      try {
        return await submitCredentialOAuthCallback(session, input)
      } catch (error) {
        throw toCredentialApiError(error)
      }
    },
    onSuccess: invalidate,
  })

  const vertexImportMutation = useMutation({
    mutationFn: async (input: VertexImportInput) => {
      try {
        return await importVertexCredential(session, input)
      } catch (error) {
        throw toCredentialApiError(error)
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
    updateStatus: statusMutation.mutateAsync,
    updateMetadata: metadataMutation.mutateAsync,
    deleteCredential: deleteMutation.mutateAsync,
    uploadCredentials: uploadMutation.mutateAsync,
    downloadCredential: downloadMutation.mutateAsync,
    fetchModels: modelsMutation.mutateAsync,
    startOAuth: oauthMutation.mutateAsync,
    checkOAuthStatus: oauthStatusMutation.mutateAsync,
    submitOAuthCallback: oauthCallbackMutation.mutateAsync,
    importVertexCredential: vertexImportMutation.mutateAsync,
    models: modelsMutation.data ?? null,
    oauthResult: oauthMutation.data ?? null,
    oauthStatus: oauthStatusMutation.data ?? null,
    vertexImportResult: vertexImportMutation.data ?? null,
    mutating:
      statusMutation.isPending ||
      metadataMutation.isPending ||
      deleteMutation.isPending ||
      uploadMutation.isPending ||
      downloadMutation.isPending ||
      modelsMutation.isPending ||
      oauthMutation.isPending ||
      oauthStatusMutation.isPending ||
      oauthCallbackMutation.isPending ||
      vertexImportMutation.isPending,
  }
}
