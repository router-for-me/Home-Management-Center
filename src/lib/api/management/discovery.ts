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
  const cpaVersion = response.headers.get('x-cpa-version')
  const homeVersion = response.headers.get('x-cpa-home-version')
  const contentType = response.headers.get('content-type') ?? ''

  if (cpaVersion || homeVersion) return true
  if (!contentType.includes('application/json')) return false

  return response.status === 200 || response.status === 401 || response.status === 403
}

async function probeManagementBaseUrl(
  candidate: Pick<ManagementRuntimeDiscoveryResult, 'baseUrl' | 'source'>,
): Promise<ManagementRuntimeDiscoveryResult | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const response = await window.fetch(`${candidate.baseUrl}/config`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!isManagementResponse(response)) {
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
  const results = await Promise.all(
    candidates.map((candidate) => probeManagementBaseUrl(candidate)),
  )

  return (
    results.find((result): result is ManagementRuntimeDiscoveryResult => Boolean(result)) ?? null
  )
}
