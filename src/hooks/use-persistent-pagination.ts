import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'

import { useLocalStoragePreference } from '@/hooks/use-local-storage-preference'
import { createChoicePreferenceNormalizer } from '@/lib/ui-preferences'

type Pagination = {
  limit: number
  offset: number
}

export function usePersistentPagination<T extends Pagination>(
  storageKey: string,
  defaultPagination: T,
  pageSizeOptions: readonly number[],
): [T, Dispatch<SetStateAction<T>>] {
  const normalizePageSize = useMemo(
    () => createChoicePreferenceNormalizer(pageSizeOptions),
    [pageSizeOptions],
  )
  const [storedPageSize, setStoredPageSize] = useLocalStoragePreference(
    storageKey,
    defaultPagination.limit,
    normalizePageSize,
  )
  const [pagination, setPagination] = useState<T>(() => ({
    ...defaultPagination,
    limit: storedPageSize,
  }))

  useEffect(() => {
    if (pageSizeOptions.includes(pagination.limit)) setStoredPageSize(pagination.limit)
  }, [pageSizeOptions, pagination.limit, setStoredPageSize])

  return [pagination, setPagination]
}
