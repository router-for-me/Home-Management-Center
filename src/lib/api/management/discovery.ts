import { normalizeManagementBaseUrl } from '@/lib/api/management/client'

const PROBE_TIMEOUT_MS = 1_800

type ManagementRuntimeDiscoverySource = 'runtime' | 'same-origin'

type ManagementRuntimeDiscoveryResult = {
  baseUrl: string
  status: number
  source: ManagementRuntimeDiscoverySource
}

function getCandidateSource(baseUrl: string | undefined): ManagementRuntimeDiscoverySource {
  return baseUrl?.startsWith('/') ? 'same-origin' : 'runtime'
}

function getCandidateBaseUrls() {
  const envBaseUrl = import.meta.env.PUBLIC_MANAGEMENT_BASE_URL
  const candidates = [
    { baseUrl: envBaseUrl, source: getCandidateSource(envBaseUrl) },
    { baseUrl: 'http://127.0.0.1:8327', source: 'runtime' },
    { baseUrl: 'http://localhost:8327', source: 'runtime' },
    { baseUrl: 'http://127.0.0.1:8317', source: 'runtime' },
    { baseUrl: 'http://localhost:8317', source: 'runtime' },
    { baseUrl: 'http://127.0.0.1:8137', source: 'runtime' },
    { baseUrl: 'http://localhost:8137', source: 'runtime' },
    {
      baseUrl: typeof window === 'undefined' ? null : window.location.origin,
      source: 'same-origin',
    },
  ].filter(
    (candidate): candidate is { baseUrl: string; source: ManagementRuntimeDiscoverySource } =>
      Boolean(candidate.baseUrl),
  )

  const seen = new Set<string>()
  return candidates.flatMap((candidate) => {
    const baseUrl = normalizeManagementBaseUrl(candidate.baseUrl)
    if (seen.has(baseUrl)) return []
    seen.add(baseUrl)
    return [{ ...candidate, baseUrl }]
  })
}

function isManagementResponse(response: Response) {
  const allowedMethods = response.headers.get('access-control-allow-methods') ?? ''

  return response.ok && allowedMethods.split(',').some((method) => method.trim() === 'GET')
}

function isDiscoverableManagementResponse(
  candidate: Pick<ManagementRuntimeDiscoveryResult, 'source'>,
  response: Response,
) {
  if (!response.ok) return false
  if (candidate.source === 'runtime') return true
  return isManagementResponse(response)
}

async function probeManagementBaseUrl(
  candidate: Pick<ManagementRuntimeDiscoveryResult, 'baseUrl' | 'source'>,
): Promise<ManagementRuntimeDiscoveryResult | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const response = await window.fetch(`${candidate.baseUrl}/config`, {
      method: 'OPTIONS',
      signal: controller.signal,
    })

    if (!isDiscoverableManagementResponse(candidate, response)) {
      return null
    }

    return {
      baseUrl: candidate.baseUrl,
      source: candidate.source,
      status: response.status,
    }
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function detectLocalManagementRuntime() {
  if (typeof window === 'undefined') return null

  const candidates = getCandidateBaseUrls()
  for (const candidate of candidates) {
    const result = await probeManagementBaseUrl(candidate)
    if (result) return result
  }

  return null
}
