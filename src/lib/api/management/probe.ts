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
  Exclude<CapabilityKey, 'usageQueue' | 'logs'>,
  {
    path: string
  }
> = {
  nodes: {
    path: '/nodes',
  },
  usage: {
    path: '/api-key-usage',
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

type ProbedCapabilityKey = keyof typeof capabilityRequests

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

  if (capabilities.nodes && !capabilities.usage) {
    return 'home-cluster'
  }

  if (capabilities.nodes || serverInfo.homeVersion) {
    return 'home-standalone'
  }

  return 'unknown'
}

async function probeCapability(client: AxiosInstance, key: ProbedCapabilityKey) {
  const request = capabilityRequests[key]
  const response = await client.request({
    method: 'GET',
    url: request.path,
    validateStatus: () => true,
  })

  if (response.status === 404) return false
  if (response.status === 405) return false
  return true
}

export async function probeManagementRuntime(
  session: ManagementSessionInput,
): Promise<CapabilityProbeResult> {
  const client = createManagementClient(session)
  const configResponse = await client.get('/config')
  const serverInfo = readServerInfo(configResponse)

  const probedCapabilityEntries = await Promise.all(
    (Object.keys(capabilityRequests) as ProbedCapabilityKey[]).map(async (key) => {
      try {
        return [key, await probeCapability(client, key)] as const
      } catch {
        return [key, false] as const
      }
    }),
  )

  const probedCapabilities = probedCapabilityEntries.reduce<CapabilityMap>(
    (nextCapabilities, [key, available]) => ({
      ...nextCapabilities,
      [key]: available,
    }),
    emptyCapabilities,
  )
  const capabilities: CapabilityMap = {
    ...probedCapabilities,
    // GET /usage-queue is destructive because it pops queue records, while HEAD is not
    // registered by the current runtime. Treat the route as available when the
    // non-destructive usage route exists.
    usageQueue: probedCapabilities.usage,
    // GET /logs returns 400 when file logging is disabled, so probing it would create
    // console noise. Standalone runtimes that expose usage routes also expose the log
    // route family; the usage page decides separately whether config should read lines.
    logs: probedCapabilities.usage,
  }

  return {
    capabilities,
    runtimeMode: inferRuntimeMode(capabilities, serverInfo),
    serverInfo,
    probedAt: new Date().toISOString(),
  }
}
