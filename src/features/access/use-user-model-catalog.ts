import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'

import {
  type UserModel,
  fetchAccessibleUserModels,
  fetchPublicUserModels,
  isUserModelCatalogUnsupportedError,
} from '@/lib/api/user/models'
import { useUserSessionStore } from '@/stores/user-session-store'

import { useUserCapabilities } from './use-user-capabilities'

/**
 * A catalog entry as the page renders it.
 *
 * `accessible` is tri-state on purpose. `null` means nobody is signed in, so
 * the question of what this account may call has not been asked — which is not
 * the same as asking and being told no.
 */
export type UserCatalogModel = UserModel & {
  accessible: boolean | null
}

function toError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function indexByLowerCaseID(models: UserModel[]) {
  const index = new Map<string, UserModel>()
  for (const model of models) {
    index.set(model.id.toLowerCase(), model)
  }
  return index
}

function mergeCatalogs(
  publicModels: UserModel[] | null,
  accessibleModels: UserModel[] | null,
): UserCatalogModel[] {
  // Signed out, or the signed-in request has not landed: everything the cluster
  // sells, with no claim about what this account may call.
  if (!accessibleModels) {
    return (publicModels ?? []).map((model) => ({ ...model, accessible: null }))
  }

  const accessibleIndex = indexByLowerCaseID(accessibleModels)

  // The public catalog is the spine even when signed in. A narrow key should
  // still show the buyer the whole shelf, marked with what their key reaches,
  // rather than silently shrinking the shelf to fit the key.
  const merged: UserCatalogModel[] = (publicModels ?? []).map((model) => {
    const granted = accessibleIndex.get(model.id.toLowerCase())
    if (!granted) return { ...model, accessible: false }

    accessibleIndex.delete(model.id.toLowerCase())
    return { ...granted, accessible: true }
  })

  // The accessible set should be a subset of the public one. If a server ever
  // disagrees, the models the user can actually call are the ones that must not
  // go missing.
  for (const remaining of accessibleIndex.values()) {
    merged.push({ ...remaining, accessible: true })
  }

  return merged
}

export function useUserModelCatalog() {
  const status = useUserSessionStore((state) => state.status)
  const baseUrl = useUserSessionStore((state) => state.baseUrl)
  const token = useUserSessionStore((state) => state.token)
  const authenticated = status === 'authenticated' && Boolean(token)

  const capabilitiesQuery = useUserCapabilities()
  const capabilities = capabilitiesQuery.data ?? null

  // A server that answered `/capabilities` and did not advertise the catalog
  // does not have one; asking anyway would turn a known answer into a 404 the
  // page would have to guess about. A server too old to answer `/capabilities`
  // at all tells us nothing either way, so the catalog request goes out and its
  // own 404 becomes the answer.
  const catalogSupported =
    !capabilities || !capabilities.endpointSupported || capabilities.modelCatalog
  const capabilitiesResolved = !capabilitiesQuery.isLoading

  const publicQuery = useQuery({
    queryKey: ['user-models-public', baseUrl],
    enabled: capabilitiesResolved && catalogSupported,
    queryFn: () => fetchPublicUserModels({ baseUrl }),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const accessibleQuery = useQuery({
    queryKey: ['user-models-accessible', baseUrl, token],
    enabled: capabilitiesResolved && catalogSupported && authenticated,
    queryFn: () => fetchAccessibleUserModels({ baseUrl, token: token ?? '' }),
    staleTime: 60_000,
    retry: 1,
  })

  const publicError = publicQuery.error ? toError(publicQuery.error) : null
  const accessibleError = accessibleQuery.error ? toError(accessibleQuery.error) : null

  const unsupported =
    (capabilitiesResolved && !catalogSupported) ||
    isUserModelCatalogUnsupportedError(publicQuery.error)

  const models = useMemo(
    () => mergeCatalogs(publicQuery.data?.models ?? null, accessibleQuery.data?.models ?? null),
    [publicQuery.data, accessibleQuery.data],
  )

  const refresh = () => {
    void publicQuery.refetch()
    if (authenticated) void accessibleQuery.refetch()
  }

  return {
    models,
    authenticated,
    unsupported,
    /** Why the accessible set has the shape it has; `null` when signed out. */
    access: accessibleQuery.data?.access ?? null,
    loading: !capabilitiesResolved || publicQuery.isLoading,
    fetching: publicQuery.isFetching || accessibleQuery.isFetching,
    /** Only a failed public catalog is fatal — it is the whole page. */
    error: unsupported ? null : (publicError?.message ?? null),
    /**
     * A failed accessible request leaves the page usable but degraded: the
     * catalog still renders, without prices. Surfaced separately so the page
     * can say that rather than pretending nothing is missing.
     */
    accessibleError: accessibleError?.message ?? null,
    fetchedAt: publicQuery.data?.fetchedAt ?? null,
    refresh,
  }
}
