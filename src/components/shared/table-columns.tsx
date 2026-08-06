import { useIsCompactViewport } from '@/hooks/use-compact-viewport'

/*
 * Which columns a table shows.
 *
 * A resource table is 1080 to 2086px wide. On a 375px screen that is up to 5.6
 * screens of sideways dragging to read one row, and narrowing the action column
 * only bought back a fraction of it: the width is in the data columns, so that is
 * where a narrow viewport has to give something up.
 *
 * What it gives up is redundancy, not access. Every table here has a detail view
 * behind its first row action, and that view already carries every field. So a
 * hidden column is one more tap away, never gone — which is the difference
 * between a different shape and a smaller feature set.
 *
 * Three roles decide what survives:
 *   identity   which row this is. Always shown; a list of rows you cannot tell
 *              apart is not a list.
 *   status     what state it is in. Always shown, because it is the reason to
 *              scan a table rather than open one row.
 *   secondary  everything else. Hidden below 40rem, reachable in the detail view.
 *
 * Selection checkboxes are not a role. They are an action surface, and bulk
 * operations are a capability, so they stay.
 */

/*
 * Three things have to be true for a table to actually fit, and two of them are
 * easy to miss. Measured at 375px:
 *
 *   1. Hide the secondary columns. Gate the `col`, the `TableHead` and the
 *      `TableCell` on the same value — `<colgroup>` maps columns by position, so
 *      a head hidden without its col silently shifts every width after it by one.
 *   2. Drop the table's min-width below 40rem. A floor is a floor; the columns
 *      being narrower does not help while the table is still told to be 1250px.
 *   3. Use fixed layout below 40rem. This is the one that looks unnecessary and
 *      is not: an auto-layout table sizes a column to its content and ignores the
 *      cell's max-width, so an identity column holding a long id stayed 298px
 *      wider than the viewport with steps 1 and 2 already done.
 *
 * Under fixed layout give the identity column no width at all — the remainder
 * lands on it, which is what makes the table fit any viewport — and give status a
 * fixed one, or the two split the remainder and neither reads well. The widths can
 * come from a `colgroup` or from the heads; fixed layout treats both as
 * authoritative.
 */

/**
 * True where a table should render its secondary columns.
 */
export function useSecondaryColumns() {
  return !useIsCompactViewport()
}
