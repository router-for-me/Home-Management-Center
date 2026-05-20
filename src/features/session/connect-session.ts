import { normalizeManagementBaseUrl, toManagementApiError } from '@/lib/api/management/client'
import { detectLocalManagementRuntime } from '@/lib/api/management/discovery'
import { probeManagementRuntime } from '@/lib/api/management/probe'
import type { CapabilityProbeResult } from '@/lib/api/management/types'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

type ConnectManagementSessionInput = {
  baseUrl: string
  managementKey: string
  rememberConnection: boolean
}

export async function connectManagementSession({
  baseUrl,
  managementKey,
  rememberConnection,
}: ConnectManagementSessionInput): Promise<CapabilityProbeResult> {
  try {
    const normalizedBaseUrl = normalizeManagementBaseUrl(baseUrl)
    const session = {
      baseUrl: normalizedBaseUrl,
      managementKey,
      rememberConnection,
    }

    useSessionStore.getState().setChecking(session)
    useCapabilityStore.getState().setProbing()

    const probeResult = await probeManagementRuntime(session)
    useSessionStore.getState().setConnected(session)
    useCapabilityStore.getState().setProbeResult(probeResult)
    return probeResult
  } catch (error) {
    const apiError = toManagementApiError(error)
    useSessionStore.getState().setError(apiError)
    useCapabilityStore.getState().setError(apiError)
    throw new Error(apiError.message, { cause: error })
  }
}

export function disconnectManagementSession() {
  useSessionStore.getState().disconnect()
  useCapabilityStore.getState().reset()
}

export async function bootstrapManagementSession() {
  const { baseUrl, managementKey, rememberConnection, status } = useSessionStore.getState()

  if (status === 'connected' || status === 'checking') {
    return null
  }

  const discoveredRuntime = await detectLocalManagementRuntime()
  const normalizedBaseUrl = normalizeManagementBaseUrl(baseUrl)
  const candidates: ConnectManagementSessionInput[] = []

  if (discoveredRuntime) {
    useSessionStore.getState().setDetectedRuntime(discoveredRuntime.baseUrl)

    if (managementKey) {
      candidates.push({
        baseUrl: discoveredRuntime.baseUrl,
        managementKey,
        rememberConnection,
      })
    }
  }

  if (!managementKey) {
    return null
  }

  if (
    !discoveredRuntime ||
    normalizeManagementBaseUrl(discoveredRuntime.baseUrl) !== normalizedBaseUrl
  ) {
    candidates.push({
      baseUrl: normalizedBaseUrl,
      managementKey,
      rememberConnection,
    })
  }

  for (const candidate of candidates) {
    try {
      return await connectManagementSession(candidate)
    } catch {
      // Keep boot non-blocking; the connection dialog owns the visible error.
    }
  }

  return null
}
