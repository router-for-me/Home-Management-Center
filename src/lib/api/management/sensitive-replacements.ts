export const replacementKinds = ['literalReplacements', 'patternReplacements'] as const
export type ReplacementKind = (typeof replacementKinds)[number]
// Home preserves omitted RE2 operands. An omitted replacement deletes the match.
export type ReplacementRow = { pattern?: string; replacement?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isReplacementRows(value: unknown): value is ReplacementRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row: unknown) =>
        isRecord(row) &&
        Object.entries(row).every(
          ([key, operand]) =>
            (key === 'pattern' || key === 'replacement') && typeof operand === 'string',
        ),
    )
  )
}

export function replacementIssues(kind: ReplacementKind, rows: ReplacementRow[]) {
  if (kind === 'patternReplacements') return rows.map(() => null)
  const seen = new Set<string>()
  const duplicate = new Set<string>()
  for (const { pattern = '' } of rows) {
    if (seen.has(pattern)) duplicate.add(pattern)
    seen.add(pattern)
  }
  return rows.map(({ pattern = '' }) => {
    if (!pattern.trim()) return 'missing' as const
    return duplicate.has(pattern) ? ('duplicate' as const) : null
  })
}

export function readReplacementRows(kind: ReplacementKind, raw: unknown): ReplacementRow[] | null {
  if (raw == null) return []
  if (kind === 'patternReplacements') return isReplacementRows(raw) ? raw : null
  if (!isRecord(raw)) return null
  const rows: ReplacementRow[] = []
  for (const [pattern, replacement] of Object.entries(raw)) {
    if (!pattern.trim() || typeof replacement !== 'string') return null
    rows.push({ pattern, replacement })
  }
  return rows
}

export function parseReplacementDraft(value: unknown): ReplacementRow[] | null {
  if (typeof value !== 'string') return null
  try {
    const rows: unknown = JSON.parse(value)
    return isReplacementRows(rows) ? rows : null
  } catch {
    return null
  }
}

export function serializeReplacementRows(kind: ReplacementKind, rows: ReplacementRow[] | null) {
  if (!rows || replacementIssues(kind, rows).some(Boolean)) {
    throw new Error('Invalid sensitive replacement rules')
  }
  return kind === 'literalReplacements'
    ? Object.fromEntries(rows.map(({ pattern = '', replacement = '' }) => [pattern, replacement]))
    : rows
}
