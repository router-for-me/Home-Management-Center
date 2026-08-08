import { type RefObject, useLayoutEffect, useRef } from 'react'

import { useVirtualizer } from '@tanstack/react-virtual'

/*
 * Row virtualisation for the two tables that carry a full page of records.
 *
 * The cost these tables pay is not rendering, it is document size. Every Radix
 * overlay that opens modally writes `pointer-events: none` onto <body>, and
 * because that property inherits, the browser has to re-resolve the computed
 * style of every element in the document. Measured at 4x CPU throttling on a
 * 50 row request table (3624 elements): opening and closing one filter cost
 * 78 ms, and the same interaction with only a viewport's worth of rows in the
 * DOM cost nothing at all. Route mount showed the same shape, 161-229 ms
 * against 0 ms on a small page.
 *
 * CSS containment does not help here and was measured: `content-visibility:
 * auto` on the rows, the same on the scroll container, and `contain: layout
 * style paint` on the rows all left the recalculation within a millisecond of
 * the 22.7 ms baseline. Containment scopes layout, paint and size; it does not
 * stop an inherited value from propagating. Only removing elements works.
 *
 * This keeps the native table: <table>, <tbody> and <tr> stay as they are, and
 * the rows outside the window are replaced by two spacer rows that hold the
 * scroll height. That preserves everything the responsive table rules depend
 * on - fixed layout, authoritative column widths from <colgroup> or the heads,
 * the locale-aware .table-action-column-* widths, and the useSecondaryColumns
 * gating - none of which survive the CSS-grid rewrite the upstream examples
 * use to support variable row heights. Both tables here render uniform rows,
 * so that trade buys nothing.
 */

type VirtualTableRowsOptions = {
  rowCount: number
  /** The scroll container, i.e. the element carrying `overflow-auto`. */
  scrollRef: RefObject<HTMLDivElement | null>
  /**
   * Height of one row in px. Rows are measured after mount, so this only has to
   * be close enough to keep the scrollbar honest on the first frame.
   */
  estimatedRowHeight: number
  overscan?: number
  /**
   * Scrolls back to the top whenever this value changes. A new filter or page is
   * a different list, and both of these tables keep their previous rows on
   * screen while the next ones arrive, so nothing else would move the scroll
   * position off a row that no longer exists.
   */
  resetKey?: unknown
}

export function useVirtualTableRows({
  rowCount,
  scrollRef,
  estimatedRowHeight,
  overscan = 8,
  resetKey,
}: VirtualTableRowsOptions) {
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
  })

  const lastResetKey = useRef(resetKey)
  useLayoutEffect(() => {
    if (Object.is(lastResetKey.current, resetKey)) return
    lastResetKey.current = resetKey
    virtualizer.scrollToOffset(0)
  }, [resetKey, virtualizer])

  const items = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return {
    items,
    /** Attach to each rendered row so a design change cannot desync the estimate. */
    measureRow: virtualizer.measureElement,
    paddingTop: items.length > 0 ? items[0].start : 0,
    paddingBottom: items.length > 0 ? totalSize - items[items.length - 1].end : 0,
  }
}

/**
 * Holds the height of the rows that are not rendered. A bare <tr> rather than
 * TableRow: the row variants paint a border and a hover background, and a
 * spacer must be invisible.
 */
export function TableSpacerRow({ height, colSpan }: { height: number; colSpan: number }) {
  if (height <= 0) return null

  return (
    <tr aria-hidden="true">
      <td colSpan={colSpan} style={{ height, padding: 0, border: 0 }} />
    </tr>
  )
}
