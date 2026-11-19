import { sameConfigValue } from './config-edit'
import { changedOAuthChannels, isOAuthChannelKey, oauthChannelValue } from './oauth-model-channels'

type ConfigObject = Record<string, unknown>
type ModelSetting = ConfigObject & {
  name?: string | null
  alias?: string | null
  'max-context-length'?: number | string | null
}

// Home uses these channel IDs when applying settings to OAuth credentials.
export const oauthSettingChannels = [
  'claude',
  'codex',
  'vertex',
  'antigravity',
  'devin',
  'kimi',
  'kimi-ai',
  'meta',
  'xai',
]

export function canEditModelSetting(value: unknown, channel: string): value is ModelSetting {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as ConfigObject
  const limit = row['max-context-length']
  return (
    (row.name == null || typeof row.name === 'string') &&
    (row.alias == null || typeof row.alias === 'string') &&
    (limit == null || typeof limit === 'number' || typeof limit === 'string') &&
    (channel.toLowerCase() !== 'vertex' || row.openapi == null || typeof row.openapi === 'boolean')
  )
}

export function validContextLength(value: unknown) {
  return value == null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
}

export function editModelSetting(
  raw: ModelSetting,
  patch: { name?: string; alias?: string; contextLength?: string; openapi?: boolean | null },
): ModelSetting {
  const next = { ...raw }
  if (patch.name !== undefined) next.name = patch.name
  if (patch.alias !== undefined) {
    if (patch.alias) next.alias = patch.alias
    else delete next.alias
  }
  if (patch.contextLength !== undefined) {
    const text = patch.contextLength.trim()
    if (!text) delete next['max-context-length']
    else {
      const number = Number(text)
      // Keep invalid text visible in the draft without coercing it to zero or a rounded integer.
      next['max-context-length'] =
        /^\d+$/.test(text) && validContextLength(number) ? number : patch.contextLength
    }
  }
  if (patch.openapi === null) delete next.openapi
  else if (patch.openapi !== undefined) next.openapi = patch.openapi
  return next
}

export function hasInvalidModelSettingChanges(before: ConfigObject, after: ConfigObject) {
  return changedOAuthChannels(before, after).some((channel) => {
    if (!isOAuthChannelKey(channel)) return true
    const rows = oauthChannelValue(after, channel)
    if (rows === undefined) return false
    if (!Array.isArray(rows)) return true
    const original = oauthChannelValue(before, channel)
    const unmatched = Array.isArray(original) ? Array.from<unknown>(original) : []
    return rows.some((row) => {
      if (
        canEditModelSetting(row, channel) &&
        row.name?.trim() &&
        validContextLength(row['max-context-length'])
      )
        return false
      // Each unchanged legacy row can account for only one row in the draft.
      const match = unmatched.findIndex((old) => sameConfigValue(old, row))
      if (match < 0) return true
      unmatched.splice(match, 1)
      return false
    })
  })
}
