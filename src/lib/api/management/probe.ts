import type { AxiosInstance, AxiosResponse } from 'axios'

import { createManagementClient } from '@/lib/api/management/client'
import type {
  CapabilityKey,
  CapabilityMap,
  CapabilityProbeResult,
  ManagementServerInfo,
  ManagementSessionInput,
  RuntimeMode,
} from '@/lib/api/management/types'

const capabilityRequests: Record<
  CapabilityKey,
  {
    method?: 'GET' | 'HEAD'
    path: string
    params?: Record<string, string | number>
    methodNotAllowedMeansAvailable?: boolean
  }
> = {
  nodes: {
    path: '/nodes',
  },
  usage: {
    path: '/api-key-usage',
  },
  usageQueue: {
    method: 'HEAD',
    path: '/usage-queue',
    // GET /usage-queue pops records, so capability probing must never call it with GET.
    // 405 still proves that the path exists but does not accept HEAD.
    methodNotAllowedMeansAvailable: true,
  },
  logs: {
    path: '/logs',
    params: { limit: 1 },
  },
  requestErrorLogs: {
    path: '/request-error-logs',
  },
}

const emptyCapabilities: CapabilityMap = {
  nodes: false,
  usage: false,
  usageQueue: false,
  logs: false,
  requestErrorLogs: false,
}

function getHeader(response: AxiosResponse, name: string): string | undefined {
  const headers = response.headers as Record<string, unknown>
  const value = headers[name.toLowerCase()]
  if (Array.isArray(value)) {
    const firstValue = value[0] as unknown
    return typeof firstValue === 'string' ? firstValue : undefined
  }
  if (typeof value === 'string') return value
  return undefined
}

function readServerInfo(response: AxiosResponse): ManagementServerInfo {
  return {
    cpaVersion: getHeader(response, 'X-CPA-VERSION'),
    cpaCommit: getHeader(response, 'X-CPA-COMMIT'),
    cpaBuildDate: getHeader(response, 'X-CPA-BUILD-DATE'),
    homeVersion: getHeader(response, 'x-cpa-home-version'),
    homeCommit: getHeader(response, 'x-cpa-home-commit'),
    homeBuildDate: getHeader(response, 'x-cpa-home-build-date'),
  }
}

function inferRuntimeMode(
  capabilities: CapabilityMap,
  serverInfo: ManagementServerInfo,
): RuntimeMode {
  if (!capabilities.nodes && !serverInfo.homeVersion) {
    return 'cpa'
  }

  if (
    capabilities.nodes &&
    (!capabilities.logs || !capabilities.usage || !capabilities.usageQueue)
  ) {
    return 'home-cluster'
  }

  if (capabilities.nodes || serverInfo.homeVersion) {
    return 'home-standalone'
  }

  return 'unknown'
}

async function probeCapability(client: AxiosInstance, key: CapabilityKey) {
  const request = capabilityRequests[key]
  const response = await client.request({
    method: request.method ?? 'GET',
    url: request.path,
    params: request.params,
    validateStatus: () => true,
  })

  if (response.status === 404) return false
  if (response.status === 405) return Boolean(request.methodNotAllowedMeansAvailable)
  return true
}

export async function probeManagementRuntime(
  session: ManagementSessionInput,
): Promise<CapabilityProbeResult> {
  const client = createManagementClient(session)
  const configResponse = await client.get('/config')
  const serverInfo = readServerInfo(configResponse)

  const capabilityEntries = await Promise.all(
    (Object.keys(capabilityRequests) as CapabilityKey[]).map(async (key) => {
      try {
        return [key, await probeCapability(client, key)] as const
      } catch {
        return [key, false] as const
      }
    }),
  )

  const capabilities = capabilityEntries.reduce<CapabilityMap>(
    (nextCapabilities, [key, available]) => ({
      ...nextCapabilities,
      [key]: available,
    }),
    emptyCapabilities,
  )

  return {
    capabilities,
    runtimeMode: inferRuntimeMode(capabilities, serverInfo),
    serverInfo,
    probedAt: new Date().toISOString(),
  }
}
