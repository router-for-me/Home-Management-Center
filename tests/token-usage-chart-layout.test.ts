import { describe, expect, test } from 'bun:test'

import { createTokenUsageChartLayout } from '../src/features/observability/token-usage-chart-layout'

const widths = [320, 645, 1100]
const itemCounts = [1, 2, 7, 24, 30, 90, 10_000]

describe('token usage chart layout', () => {
  test('keeps bars, overlay points, and labels on the same category center', () => {
    for (const width of widths) {
      const compact = width < 520
      const marginLeft = compact ? 48 : 64
      const marginRight = compact ? 36 : 74

      for (const itemCount of itemCounts) {
        const layout = createTokenUsageChartLayout({
          width,
          marginLeft,
          marginRight,
          itemCount,
        })

        for (const index of [0, Math.floor(itemCount / 2), itemCount - 1]) {
          const centerX = layout.getCenterX(index)

          expect(layout.getBarX(index) + layout.barWidth / 2).toBeCloseTo(centerX, 10)
          expect(centerX).toBeGreaterThanOrEqual(marginLeft)
          expect(centerX).toBeLessThanOrEqual(width - marginRight)
        }
      }
    }
  })

  test('never lets a dense bar overlap its neighboring category band', () => {
    for (const width of widths) {
      for (const itemCount of itemCounts) {
        const layout = createTokenUsageChartLayout({
          width,
          marginLeft: width < 520 ? 48 : 64,
          marginRight: width < 520 ? 36 : 74,
          itemCount,
        })

        expect(layout.barWidth).toBeGreaterThan(0)
        expect(layout.barWidth).toBeLessThanOrEqual(layout.bandWidth)
      }
    }
  })

  test('maps the full plot area to a clamped category index', () => {
    const layout = createTokenUsageChartLayout({
      width: 645,
      marginLeft: 64,
      marginRight: 74,
      itemCount: 7,
    })

    expect(layout.getIndexAtX(Number.NEGATIVE_INFINITY)).toBe(0)
    expect(layout.getIndexAtX(64)).toBe(0)
    expect(layout.getIndexAtX(layout.getCenterX(3))).toBe(3)
    expect(layout.getIndexAtX(645 - 74)).toBe(6)
    expect(layout.getIndexAtX(Number.POSITIVE_INFINITY)).toBe(6)
  })
})
