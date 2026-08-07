/**
 * Filter patches are dispatched for every dropdown selection and every
 * committed keystroke, including the ones that re-pick the value already in
 * effect — switching the search field with an empty box rewrites six keys to
 * the empty strings they already hold. Handing back the current object for
 * those makes React bail out of the render, so the table is never reconciled
 * for a change that is not one, and TanStack Query never sees a new key.
 */
export function applyFilterPatch<T extends Record<string, unknown>>(
  currentFilters: T,
  nextFilters: Partial<T>,
): T {
  const mergedFilters = { ...currentFilters, ...nextFilters }
  const changed = (Object.keys(mergedFilters) as Array<keyof T>).some(
    (key) => mergedFilters[key] !== currentFilters[key],
  )

  return changed ? mergedFilters : currentFilters
}
