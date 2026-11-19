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

export function groupLabel(groups: AccessGroupResource[], id: number) {
  return groups.find((group) => group.numericId === id)?.name ?? `#${id}`
}

export function groupListLabel(groups: AccessGroupResource[], ids: number[], emptyLabel: string) {
  if (ids.length === 0) return emptyLabel
  return ids.map((id) => groupLabel(groups, id)).join(', ')
}
