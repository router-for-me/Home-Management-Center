type PayloadReplacementEntry = {
  from: string
  to: string
}

type PayloadReplaceContent = {
  target: {
    all: boolean
    positions: string
  }
  replacements: PayloadReplacementEntry[]
}

type PayloadReplaceIssueKey =
  | 'replacePositionsRequired'
  | 'replacePositionsInvalid'
  | 'replaceReplacementRequired'
  | 'replaceSourceRequired'

const draftPositionsKey = '__hmc_payload_positions'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parsePayloadReplacePositions(value: string): number[] | null {
  const parts = value.split(/[,，\s]+/).filter(Boolean)
  if (
    parts.length === 0 ||
    parts.some(
      (part) => !/^\d+$/.test(part) || !Number.isSafeInteger(Number(part)) || Number(part) < 1,
    )
  ) {
    return null
  }
  return parts.map(Number)
}

function normalizePayloadReplaceContent(value: unknown): PayloadReplaceContent {
  const rule = isRecord(value) ? value : {}
  const target = isRecord(rule.target) ? rule.target : {}

  return {
    target: {
      all: target.all === true,
      positions:
        typeof target[draftPositionsKey] === 'string'
          ? target[draftPositionsKey]
          : Array.isArray(target.positions)
            ? target.positions.join(', ')
            : target.all === true
              ? '1'
              : '',
    },
    replacements: Array.isArray(rule.replacements)
      ? rule.replacements.map((entry) => {
          const [from, to] = Object.entries(isRecord(entry) ? entry : {})[0] ?? ['', '']
          return { from, to: typeof to === 'string' ? to : '' }
        })
      : [],
  }
}

function getPayloadReplaceIssues(content: PayloadReplaceContent): PayloadReplaceIssueKey[] {
  const issues: PayloadReplaceIssueKey[] = []
  if (!content.target.all) {
    if (!content.target.positions.trim()) issues.push('replacePositionsRequired')
    else if (!parsePayloadReplacePositions(content.target.positions))
      issues.push('replacePositionsInvalid')
  }
  if (content.replacements.length === 0) issues.push('replaceReplacementRequired')
  if (content.replacements.some((entry) => entry.from.length === 0))
    issues.push('replaceSourceRequired')
  return issues
}

function serializePayloadReplaceContent(content: PayloadReplaceContent, draft = false) {
  const positions = parsePayloadReplacePositions(content.target.positions)
  const canonicalPositions = content.target.all ? '1' : positions?.join(', ')
  // Keep partially typed positions in the draft without sending UI metadata to CPA.
  const keepPositionsDraft = draft && content.target.positions !== canonicalPositions

  return {
    target: {
      role: 'user',
      ...(content.target.all ? { all: true } : { positions: positions ?? [] }),
      ...(keepPositionsDraft ? { [draftPositionsKey]: content.target.positions } : {}),
    },
    // The array owns order and duplicates; neither operand is trimmed.
    replacements: content.replacements.map(({ from, to }) => ({ [from]: to })),
  }
}

function canEditPayloadReplaceContent(value: Record<string, unknown>) {
  const { target, replacements } = value
  if (!isRecord(target) || target.role !== 'user') return false
  if (
    Object.keys(target).some(
      (key) => !['role', 'all', 'positions', draftPositionsKey].includes(key),
    )
  )
    return false
  if (target.all !== undefined && typeof target.all !== 'boolean') return false
  if (target[draftPositionsKey] !== undefined && typeof target[draftPositionsKey] !== 'string')
    return false
  if (
    target.positions !== undefined &&
    (!Array.isArray(target.positions) ||
      target.positions.some((position) => typeof position !== 'number'))
  )
    return false
  if (target.all === true && Array.isArray(target.positions) && target.positions.length > 0)
    return false

  return (
    Array.isArray(replacements) &&
    replacements.every(
      (entry) =>
        isRecord(entry) &&
        Object.keys(entry).length === 1 &&
        Object.values(entry).every((operand) => typeof operand === 'string'),
    )
  )
}

export {
  canEditPayloadReplaceContent,
  getPayloadReplaceIssues,
  normalizePayloadReplaceContent,
  serializePayloadReplaceContent,
}
export type { PayloadReplaceContent, PayloadReplaceIssueKey, PayloadReplacementEntry }
