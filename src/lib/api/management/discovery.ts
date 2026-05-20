import { normalizeManagementBaseUrl } from '@/lib/api/management/client'

const PROBE_TIMEOUT_MS = 1_800

type ManagementRuntimeDiscoveryResult = {
  baseUrl: string
  status: number
}

function getCandidateBaseUrls() {
  const envBaseUrl = import.meta.env.PUBLIC_MANAGEMENT_BASE_URL
  const candidates = [
    envBaseUrl,
    typeof window === 'undefined' ? null : window.location.origin,
    'http://127.0.0.1:8317',
    'http://localhost:8317',
    'http://127.0.0.1:8327',
    'http://localhost:8327',
    'http://127.0.0.1:8137',
    'http://localhost:8137',
  ].filter((candidate): candidate is string => Boolean(candidate))

  return Array.from(new Set(candidates.map((candidate) => normalizeManagementBaseUrl(candidate))))
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
  baseUrl: string,
): Promise<ManagementRuntimeDiscoveryResult | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const response = await window.fetch(`${baseUrl}/config`, {
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
      baseUrl,
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
