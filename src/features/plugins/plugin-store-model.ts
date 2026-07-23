import type { PluginStoreEntry } from '@/lib/api/management/plugin-store'

export type PluginStatusFilter = 'all' | 'installed' | 'notInstalled' | 'updates' | 'authRequired'

export function matchesPluginStatusFilter(
  plugin: Pick<PluginStoreEntry, 'authRequired' | 'installed' | 'updateAvailable'>,
  filter: PluginStatusFilter,
) {
  if (filter === 'installed') return plugin.installed
  if (filter === 'notInstalled') return !plugin.installed
  if (filter === 'updates') return plugin.installed && plugin.updateAvailable
  if (filter === 'authRequired') return plugin.authRequired
  return true
}

export function isPluginInstallActionDisabled(installingKey: string | null) {
  return Boolean(installingKey)
}
