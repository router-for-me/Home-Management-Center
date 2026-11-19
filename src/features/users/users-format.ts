import type { AccessGroupResource } from '@/lib/api/management/access-groups'

export function formatDateTime(value: string | null) {
  if (!value) return null

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatOptionalTime(value: string | null, fallback: string) {
  return formatDateTime(value) ?? fallback
}

export function scopeNames(groups: AccessGroupResource[]) {
  const repeated = repeatedNames(groups.map((group) => group.name))
  return new Map(
    groups.map(({ numericId, name }) => [
      numericId,
      repeated.has(name) ? `${name} (#${numericId})` : name,
    ]),
  )
}

export function groupLabel(groups: AccessGroupResource[], id: number) {
  return scopeNames(groups).get(id) ?? `#${id}`
}

export function groupListLabel(groups: AccessGroupResource[], ids: number[], emptyLabel: string) {
  if (ids.length === 0) return emptyLabel
  const names = scopeNames(groups)
  return ids.map((id) => names.get(id) ?? `#${id}`).join(', ')
}

export function repeatedNames(names: (string | undefined)[]) {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const name of names) {
    if (!name) continue
    if (seen.has(name)) repeated.add(name)
    seen.add(name)
  }
  return repeated
}
