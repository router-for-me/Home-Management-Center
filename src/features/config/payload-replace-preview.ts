import type { PayloadReplacementEntry } from '@/lib/api/management/payload-replace'

const maxPreviewCharacters = 64 * 1024
const maxPreviewSteps = 128

export function getPayloadReplacePreview(text: string, entries: PayloadReplacementEntry[]) {
  if (!entries.length || entries.some(({ from }) => !from.length)) {
    return { status: 'incomplete' } as const
  }
  if (!text) return { status: 'empty' } as const
  if (text.length > maxPreviewCharacters || entries.length > maxPreviewSteps) {
    return { status: 'tooLarge' } as const
  }

  let result = text
  let remaining = maxPreviewCharacters
  const steps: Array<{ result: string; changed: boolean }> = []
  for (const { from, to } of entries) {
    let length = result.length
    const growth = to.length - from.length
    if (growth !== 0) {
      for (let at = result.indexOf(from); at >= 0; at = result.indexOf(from, at + from.length)) {
        length += growth
        if (growth > 0 && length > remaining) return { status: 'tooLarge' } as const
      }
    }
    if (length > remaining) return { status: 'tooLarge' } as const
    remaining -= length
    const previous = result
    result = previous.replaceAll(from, () => to)
    steps.push({ result, changed: result !== previous })
  }
  return { status: 'ready', result, steps } as const
}
