import { useCallback, useMemo } from 'react'

import { useLocalStoragePreference } from '@/hooks/use-local-storage-preference'
import type { PreferenceNormalizer } from '@/lib/ui-preferences'

type PersistentColumnConfig<Key extends string> = {
  key: Key
  required?: boolean
}

type ColumnVisibilityOverrides = Record<string, boolean>

export function normalizeColumnVisibilityOverrides<Key extends string>(
  value: unknown,
  columns: readonly PersistentColumnConfig<Key>[],
): ColumnVisibilityOverrides | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const stored = value as Record<string, unknown>
  const overrides: ColumnVisibilityOverrides = {}

  for (const column of columns) {
    if (column.required) continue
    const visibility = stored[column.key]
    if (typeof visibility !== 'boolean') continue
    overrides[column.key] = visibility
  }

  return overrides
}

export function resolveVisibleColumns<Key extends string>(
  columns: readonly PersistentColumnConfig<Key>[],
  defaultVisibleColumns: readonly Key[],
  overrides: ColumnVisibilityOverrides,
) {
  const defaultVisible = new Set<string>(defaultVisibleColumns)

  return columns
    .filter(
      (column) => column.required || (overrides[column.key] ?? defaultVisible.has(column.key)),
    )
    .map((column) => column.key)
}

export function usePersistentColumnVisibility<Key extends string>({
  storageKey,
  columns,
  defaultVisibleColumns,
}: {
  storageKey: string
  columns: readonly PersistentColumnConfig<Key>[]
  defaultVisibleColumns: readonly Key[]
}) {
  const normalize = useMemo<PreferenceNormalizer<ColumnVisibilityOverrides>>(
    () => (value) => normalizeColumnVisibilityOverrides(value, columns),
    [columns],
  )
  const [overrides, setOverrides] = useLocalStoragePreference(storageKey, {}, normalize)
  const defaultVisible = useMemo(
    () => new Set<string>(defaultVisibleColumns),
    [defaultVisibleColumns],
  )
  const requiredColumns = useMemo(
    () => new Set(columns.filter((column) => column.required).map((column) => column.key)),
    [columns],
  )
  const visibleColumns = useMemo(
    () => resolveVisibleColumns(columns, defaultVisibleColumns, overrides),
    [columns, defaultVisibleColumns, overrides],
  )
  const visibleColumnSet = useMemo(() => new Set<string>(visibleColumns), [visibleColumns])

  const setColumnVisible = useCallback(
    (column: Key, visible: boolean) => {
      if (requiredColumns.has(column)) return

      setOverrides((current) => {
        const next = { ...current }
        if (visible === defaultVisible.has(column)) delete next[column]
        else next[column] = visible
        return next
      })
    },
    [defaultVisible, requiredColumns, setOverrides],
  )

  return {
    visibleColumns,
    isColumnVisible: (column: Key) => visibleColumnSet.has(column),
    setColumnVisible,
  }
}
