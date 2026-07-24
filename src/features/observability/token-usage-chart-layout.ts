type TokenUsageChartLayout = {
  innerWidth: number
  bandWidth: number
  barWidth: number
  getCenterX: (index: number) => number
  getBarX: (index: number) => number
  getIndexAtX: (x: number) => number
}

export function createTokenUsageChartLayout({
  width,
  marginLeft,
  marginRight,
  itemCount,
}: {
  width: number
  marginLeft: number
  marginRight: number
  itemCount: number
}): TokenUsageChartLayout {
  const count = Math.max(1, Math.floor(itemCount))
  const innerWidth = Math.max(0, width - marginLeft - marginRight)
  const bandWidth = innerWidth / count
  const preferredBarWidth = Math.max(1, bandWidth * 0.58)
  const barWidth = Math.min(38, bandWidth, preferredBarWidth)
  const clampIndex = (index: number) => Math.min(count - 1, Math.max(0, Math.floor(index)))
  const getCenterX = (index: number) => marginLeft + (clampIndex(index) + 0.5) * bandWidth

  return {
    innerWidth,
    bandWidth,
    barWidth,
    getCenterX,
    getBarX: (index) => getCenterX(index) - barWidth / 2,
    getIndexAtX: (x) => (bandWidth > 0 ? clampIndex((x - marginLeft) / bandWidth) : 0),
  }
}
