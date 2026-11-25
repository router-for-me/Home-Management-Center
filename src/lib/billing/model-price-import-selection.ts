import type {
  ModelPriceImportPreviewAction,
  ModelPriceImportPreviewRow,
} from './model-price-import-types'

type SelectionRow = Pick<
  ModelPriceImportPreviewRow,
  'key' | 'action' | 'applicable' | 'selectedByDefault'
>

// A 'default' entry lets a newly resolved match follow the preview's recommendation for that row.
export type ModelPriceImportSelection = ReadonlyMap<
  string,
  ModelPriceImportPreviewAction | 'default'
>

export function resolveModelPriceImportSelection(
  rows: readonly SelectionRow[],
  selection: ModelPriceImportSelection | null,
) {
  const selected = new Map<string, ModelPriceImportPreviewAction>()
  for (const row of rows) {
    if (!row.applicable) continue
    // Only an untouched selection uses defaults for every row. Clearing leaves an empty map.
    const choice = selection === null ? 'default' : selection.get(row.key)
    if (choice === undefined || (choice === 'default' && !row.selectedByDefault)) continue
    if (row.action === 'overwrite' && choice !== 'overwrite') continue
    selected.set(row.key, row.action)
  }
  return selected
}
