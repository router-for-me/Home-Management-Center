import { sameConfigValue } from './config-edit'

type ConfigObject = Record<string, unknown>

export function isOAuthChannelKey(channel: string) {
  return (
    channel.length > 0 &&
    channel === channel.trim() &&
    channel !== '.' &&
    channel !== '..' &&
    !channel.includes('/') &&
    !channel.includes('\\') &&
    !Array.from(channel).some((char) => char.charCodeAt(0) < 32)
  )
}

export function changedOAuthChannels(before: ConfigObject, after: ConfigObject) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => !sameConfigValue(oauthChannelValue(before, key), oauthChannelValue(after, key)),
  )
}

export function oauthChannelValue(map: ConfigObject, channel: string) {
  return Object.hasOwn(map, channel) ? map[channel] : undefined
}
