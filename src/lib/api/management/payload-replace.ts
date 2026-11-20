const payloadReplaceTargetModes = ['user', 'system', 'developer', 'paths'] as const
type PayloadReplaceTargetMode = (typeof payloadReplaceTargetModes)[number]

type PayloadReplacementEntry = {
  kind: 'literal' | 'regex'
  from: string
  to: string
}

type PayloadReplaceContent = {
  target: {
    mode: PayloadReplaceTargetMode
    all: boolean
    positions: string
    paths: string[]
  }
  replacements: PayloadReplacementEntry[]
}

type PayloadReplaceIssueKey =
  | 'replacePathsRequired'
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

function readReplacement(value: unknown): PayloadReplacementEntry | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.length === 1 && typeof entries[0][1] === 'string') {
    return { kind: 'literal', from: entries[0][0], to: entries[0][1] }
  }
  if (
    entries.length === 2 &&
    typeof value.pattern === 'string' &&
    typeof value.replacement === 'string'
  ) {
    return { kind: 'regex', from: value.pattern, to: value.replacement }
  }
  return null
}

function normalizePayloadReplaceContent(value: unknown): PayloadReplaceContent {
  const rule = isRecord(value) ? value : {}
  const target = isRecord(rule.target) ? rule.target : {}

  return {
    target: {
      mode: Array.isArray(target.paths)
        ? 'paths'
        : target.role === 'system' || target.role === 'developer'
          ? target.role
          : 'user',
      paths: Array.isArray(target.paths)
        ? target.paths.filter((path) => typeof path === 'string')
        : [],
      all: target.all === true,
      positions: Array.isArray(target.positions)
        ? target.positions.join(', ')
        : target.all === true || Array.isArray(target.paths)
          ? '1'
          : '',
    },
    replacements: Array.isArray(rule.replacements)
      ? rule.replacements.map(readReplacement).filter((entry) => entry !== null)
      : [],
  }
}

function getPayloadReplaceTargetIssue(
  target: PayloadReplaceContent['target'],
): PayloadReplaceIssueKey | null {
  if (target.mode === 'paths') {
    return target.paths.length && target.paths.every((path) => path.trim())
      ? null
      : 'replacePathsRequired'
  }
  if (target.all) return null
  if (!target.positions.trim()) return 'replacePositionsRequired'
  return parsePayloadReplacePositions(target.positions) ? null : 'replacePositionsInvalid'
}

function getPayloadReplaceIssues(content: PayloadReplaceContent): PayloadReplaceIssueKey[] {
  const targetIssue = getPayloadReplaceTargetIssue(content.target)
  const issues: PayloadReplaceIssueKey[] = targetIssue ? [targetIssue] : []
  if (content.replacements.length === 0) issues.push('replaceReplacementRequired')
  if (content.replacements.some((entry) => entry.kind === 'literal' && entry.from.length === 0))
    issues.push('replaceSourceRequired')
  return issues
}

function serializePayloadReplaceContent(content: PayloadReplaceContent) {
  const { target } = content
  return {
    target:
      target.mode === 'paths'
        ? { paths: [...target.paths] }
        : {
            role: target.mode,
            ...(target.all
              ? { all: true }
              : { positions: parsePayloadReplacePositions(target.positions) ?? [] }),
          },
    // The array owns order and duplicates; neither operand is trimmed.
    replacements: content.replacements.map(({ kind, from, to }) =>
      kind === 'regex' ? { pattern: from, replacement: to } : { [from]: to },
    ),
  }
}

function canEditPayloadReplaceContent(value: Record<string, unknown>) {
  const { target, replacements } = value
  if (
    !isRecord(target) ||
    !Array.isArray(replacements) ||
    !replacements.every((entry) => readReplacement(entry) !== null)
  )
    return false
  if ('paths' in target) {
    return (
      Object.keys(target).length === 1 &&
      Array.isArray(target.paths) &&
      target.paths.every((path) => typeof path === 'string')
    )
  }
  if (target.role !== 'user' && target.role !== 'system' && target.role !== 'developer')
    return false
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

  return true
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

function canEditPayloadReplaceRule(rule: Record<string, unknown>): rule is Record<
  string,
  unknown
> & {
  models: unknown[]
  target: Record<string, unknown>
  replacements: Record<string, string>[]
} {
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
  const first = Array.isArray(rule.replacements) ? readReplacement(rule.replacements[0]) : null
  return { scope, first }
}

export {
  canEditPayloadModel,
  canEditPayloadReplaceRule,
  describeReadOnlyPayloadReplace,
  getPayloadReplaceIssues,
  getPayloadReplaceTargetIssue,
  normalizePayloadReplaceContent,
  payloadReplaceTargetModes,
  serializePayloadReplaceContent,
}
export type { PayloadReplaceContent, PayloadReplaceIssueKey, PayloadReplacementEntry }
