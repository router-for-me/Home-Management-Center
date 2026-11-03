import {
  CAN_CUSTOMIZE_MANAGEMENT_ENDPOINT,
  normalizeManagementBaseUrl,
} from '@/lib/api/management/client'

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
  const sameOriginCandidate = {
    baseUrl: typeof window === 'undefined' ? null : window.location.origin,
    source: 'same-origin' as const,
  }
  const devCandidates = CAN_CUSTOMIZE_MANAGEMENT_ENDPOINT
    ? [
        { baseUrl: envBaseUrl, source: getCandidateSource(envBaseUrl) },
        sameOriginCandidate,
        { baseUrl: 'http://127.0.0.1:8327', source: 'runtime' },
        { baseUrl: 'http://localhost:8327', source: 'runtime' },
        { baseUrl: 'http://127.0.0.1:8317', source: 'runtime' },
        { baseUrl: 'http://localhost:8317', source: 'runtime' },
        { baseUrl: 'http://127.0.0.1:8137', source: 'runtime' },
        { baseUrl: 'http://localhost:8137', source: 'runtime' },
      ]
    : []
  const candidates = [...devCandidates, sameOriginCandidate].filter(
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

function hasManagementServerHeaders(response: Response) {
  const exposeHeaders = (response.headers.get('access-control-expose-headers') ?? '').toLowerCase()
  if (exposeHeaders.includes('x-cpa-version') || exposeHeaders.includes('x-server-version')) {
    return true
  }
  return Boolean(
    response.headers.get('x-cpa-version') ||
      response.headers.get('x-cpa-home-version') ||
      response.headers.get('x-server-version'),
  )
}

function isManagementResponse(response: Response) {
  const allowedMethods = response.headers.get('access-control-allow-methods') ?? ''

  return response.ok && allowedMethods.split(',').some((method) => method.trim() === 'GET')
}

async function verifySameOriginProxyBackend(baseUrl: string, signal: AbortSignal) {
  try {
    const response = await window.fetch(`${baseUrl}/config`, {
      method: 'GET',
      signal,
    })
    return (response.ok || response.status === 401 || response.status === 403) && hasManagementServerHeaders(response)
  } catch {
    return false
  }
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

    if (!response.ok) {
      return null
    }

    if (candidate.source === 'same-origin') {
      if (!isManagementResponse(response)) {
        return null
      }
      // Dev servers such as Rsbuild answer OPTIONS locally before hitting proxy rules;
      // verify that the proxied backend actually responds with CPA/Home headers when OPTIONS lacks them.
      if (
        CAN_CUSTOMIZE_MANAGEMENT_ENDPOINT &&
        !hasManagementServerHeaders(response) &&
        !(await verifySameOriginProxyBackend(candidate.baseUrl, controller.signal))
      ) {
        return null
      }
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
