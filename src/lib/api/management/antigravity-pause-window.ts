import { parseGoDurationNanos } from '@/lib/go-duration'

import { createManagementClient, toManagementApiError } from './client'
import type { ManagementSessionInput } from './types'

export function isValidAntigravityPauseWindow(input: string) {
  const value = input.trim()
  if (['', '0', 'off', 'false', 'none', 'disabled'].includes(value.toLowerCase())) return true
  return (parseGoDurationNanos(value) ?? 0n) > 0n
}

export type AntigravityPauseObservation = { observedAt: number; resumeAt: number | null }

function timestamp(value: unknown) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ? Date.parse(value)
    : NaN
}

export async function fetchAntigravityPauseStatus(
  session: ManagementSessionInput,
  signal?: AbortSignal,
): Promise<AntigravityPauseObservation | null> {
  const client = createManagementClient(session)
  let data: Record<string, unknown> | null
  try {
    data = (
      await client.get<Record<string, unknown> | null>('/routing/antigravity/tos-pause', { signal })
    ).data
  } catch (error) {
    const { status } = toManagementApiError(error)
    if (status === 404 || status === 405 || status === 501) return null
    throw error
  }
  const observedAt = timestamp(data?.observed_at)
  if (Number.isFinite(observedAt)) {
    if (data?.paused === false && data.resume_at === null) return { observedAt, resumeAt: null }
    const resumeAt = timestamp(data?.resume_at)
    if (data?.paused === true && Number.isFinite(resumeAt) && resumeAt >= observedAt)
      return { observedAt, resumeAt }
  }
  throw new Error('Invalid Antigravity pause observation')
}
