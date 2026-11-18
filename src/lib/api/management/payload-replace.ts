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
      positions: Array.isArray(target.positions)
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

function serializePayloadReplaceContent(content: PayloadReplaceContent) {
  const positions = parsePayloadReplacePositions(content.target.positions)

  return {
    target: {
      role: 'user',
      ...(content.target.all ? { all: true } : { positions: positions ?? [] }),
    },
    // The array owns order and duplicates; neither operand is trimmed.
    replacements: content.replacements.map(({ from, to }) => ({ [from]: to })),
  }
}

function canEditPayloadReplaceContent(value: Record<string, unknown>) {
  const { target, replacements } = value
  if (!isRecord(target) || target.role !== 'user') return false
  if (Object.keys(target).some((key) => !['role', 'all', 'positions'].includes(key))) return false
  if (target.all !== undefined && typeof target.all !== 'boolean') return false
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

function canEditPayloadModel(model: unknown) {
  if (typeof model === 'string') return true
  if (!isRecord(model)) return false
  return Object.entries(model).every(([key, value]) => {
    switch (key) {
      case 'name':
      case 'protocol':
      case 'from-protocol':
        return typeof value === 'string'
      case 'headers':
        return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string')
      case 'match':
      case 'not-match':
        return Array.isArray(value) && value.every(isRecord)
      case 'exist':
      case 'not-exist':
        return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
      default:
        return false
    }
  })
}

function canEditPayloadReplaceRule(rule: Record<string, unknown>) {
  return (
    Object.keys(rule).every((key) => ['models', 'target', 'replacements'].includes(key)) &&
    Array.isArray(rule.models) &&
    rule.models.every(canEditPayloadModel) &&
    canEditPayloadReplaceContent(rule)
  )
}

function describeReadOnlyPayloadReplace(rule: Record<string, unknown>) {
  const target = isRecord(rule.target) ? rule.target : {}
  const scope =
    typeof target.role === 'string'
      ? target.role
      : Array.isArray(target.paths)
        ? target.paths.filter((path) => typeof path === 'string').join(', ')
        : ''
  const entry: unknown = Array.isArray(rule.replacements) ? rule.replacements[0] : null
  let first: PayloadReplacementEntry | undefined
  let regex = false
  if (isRecord(entry)) {
    const pairs = Object.entries(entry)
    if (typeof entry.pattern === 'string' && typeof entry.replacement === 'string') {
      first = { from: entry.pattern, to: entry.replacement }
      regex = true
    } else if (pairs.length === 1 && typeof pairs[0][1] === 'string') {
      first = { from: pairs[0][0], to: pairs[0][1] }
    }
  }
  return { scope, first, regex }
}

export {
  canEditPayloadModel,
  canEditPayloadReplaceRule,
  describeReadOnlyPayloadReplace,
  getPayloadReplaceIssues,
  normalizePayloadReplaceContent,
  serializePayloadReplaceContent,
}
export type { PayloadReplaceContent, PayloadReplaceIssueKey, PayloadReplacementEntry }
