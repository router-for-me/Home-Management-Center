import { sameConfigValue } from './config-edit'
import { changedOAuthChannels, isOAuthChannelKey, oauthChannelValue } from './oauth-model-channels'

type ConfigObject = Record<string, unknown>
export type ModelAliasRule = {
  name?: string
  alias?: string
  displayName?: string
  fork?: boolean
  forceMapping?: boolean
  openapi?: boolean | null
}

export function canEditAliasRule(value: unknown, channel: string): value is ConfigObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rule = value as ConfigObject
  return (
    ['name', 'alias', 'display-name', 'displayName'].every(
      (key) => rule[key] == null || typeof rule[key] === 'string',
    ) &&
    ['fork', 'force-mapping', 'forceMapping'].every(
      (key) => rule[key] == null || typeof rule[key] === 'boolean',
    ) &&
    (channel !== 'vertex' || rule.openapi == null || typeof rule.openapi === 'boolean')
  )
}

export function normalizeModelAliasRule(rule: ConfigObject): ModelAliasRule {
  const displayName = rule['display-name'] ?? rule.displayName
  const forceMapping = rule['force-mapping'] ?? rule.forceMapping
  return {
    ...(typeof rule.name === 'string' ? { name: rule.name } : {}),
    ...(typeof rule.alias === 'string' ? { alias: rule.alias } : {}),
    ...(typeof displayName === 'string' ? { displayName } : {}),
    ...(typeof rule.fork === 'boolean' ? { fork: rule.fork } : {}),
    ...(typeof forceMapping === 'boolean' ? { forceMapping } : {}),
    ...(typeof rule.openapi === 'boolean' || rule.openapi === null
      ? { openapi: rule.openapi }
      : {}),
  }
}

/** A row edit supplies only the changed fields; all other wire values keep their original spelling. */
export function serializeModelAliasRule(patch: ModelAliasRule, raw: ConfigObject = {}) {
  const next = { ...raw }
  if (patch.name !== undefined) next.name = patch.name
  if (patch.alias !== undefined) next.alias = patch.alias
  if (patch.fork !== undefined) next.fork = patch.fork
  if (patch.displayName !== undefined) {
    delete next.displayName
    if (patch.displayName) next['display-name'] = patch.displayName
    else delete next['display-name']
  }
  if (patch.forceMapping !== undefined) {
    delete next.forceMapping
    next['force-mapping'] = patch.forceMapping
  }
  if (patch.openapi === null) delete next.openapi
  else if (patch.openapi !== undefined) next.openapi = patch.openapi
  return next
}

export function hasIncompleteAliasChanges(before: ConfigObject, after: ConfigObject) {
  return changedOAuthChannels(before, after).some((channel) => {
    const rows = oauthChannelValue(after, channel)
    if (rows === undefined) return false
    if (!isOAuthChannelKey(channel) || !Array.isArray(rows)) return true
    const original = oauthChannelValue(before, channel)
    return rows.some((row) => {
      if (canEditAliasRule(row, channel)) {
        const { name, alias } = normalizeModelAliasRule(row)
        if (name?.trim() && alias?.trim()) return false
      }
      return !Array.isArray(original) || !original.some((old) => sameConfigValue(old, row))
    })
  })
}
