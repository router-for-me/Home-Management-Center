import { Component, act } from 'react'
import type { ReactNode } from 'react'

import {
  QueryClient,
  QueryClientProvider,
  defaultScheduler,
  notifyManager,
} from '@tanstack/react-query'

import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterAll, afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { Window } from 'happy-dom'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'

import { useLogsWorkbench } from '../src/features/logs/use-logs-workbench'
import { useCapabilityStore } from '../src/stores/capability-store'
import { useSessionStore } from '../src/stores/session-store'

const browser = new Window({ url: 'http://logs.test' })
const globals = {
  window: browser,
  document: browser.document,
  navigator: browser.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
}
const originalGlobals = new Map(
  Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
)
const originalAdapter = axios.defaults.adapter
const originalSession = useSessionStore.getState()
const originalCapabilities = useCapabilityStore.getState()

type LogRequest = {
  config: InternalAxiosRequestConfig
  resolve: (response: AxiosResponse) => void
  reject: (error: unknown) => void
}

let client: QueryClient
let root: Root
let workbench: ReturnType<typeof useLogsWorkbench>
let requests: LogRequest[]
let renders: number
let renderErrors: unknown[]
let consoleErrors: ReturnType<typeof spyOn>

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    renderErrors.push(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function Harness() {
  // Fail deterministically instead of letting an effect loop hang the test process.
  if (++renders > 100) throw new Error('Runtime logs did not settle within 100 renders')
  workbench = useLogsWorkbench()
  return null
}

beforeEach(() => {
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  browser.localStorage.clear()
  requests = []
  renders = 0
  renderErrors = []
  consoleErrors = spyOn(console, 'error').mockImplementation(() => {})
  notifyManager.setScheduler(queueMicrotask)
  client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: Infinity, retry: false, refetchOnWindowFocus: false },
    },
  })
  useSessionStore.setState({
    baseUrl: 'http://logs.test',
    managementKey: 'synthetic-test-key',
    status: 'connected',
    connectedAt: '2026-10-19T00:00:00Z',
  })
  useCapabilityStore.setState({
    status: 'ready',
    runtimeMode: 'home',
    capabilities: { ...originalCapabilities.capabilities, logs: true, requestErrorLogs: false },
  })
  axios.defaults.adapter = (config) => {
    if (config.url === '/config') {
      return Promise.resolve({
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { observability: { logs: { 'logging-to-file': true } } },
      })
    }
    if (config.url !== '/observability/logs') throw new Error(`Unexpected API: ${config.url}`)
    return new Promise((resolve, reject) => requests.push({ config, resolve, reject }))
  }
  root = createRoot(browser.document.createElement('div') as unknown as HTMLElement)
})

afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  axios.defaults.adapter = originalAdapter
  useSessionStore.setState(originalSession, true)
  useCapabilityStore.setState(originalCapabilities, true)
  notifyManager.setScheduler(defaultScheduler)
  consoleErrors.mockRestore()
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
  expect(renderErrors).toEqual([])
})

afterAll(async () => browser.happyDOM.close())

function ids(newest: number, count = 50) {
  return Array.from({ length: count }, (_, index) => newest - index)
}

function takeRequest() {
  const request = requests.shift()
  expect(request).toBeDefined()
  return request!
}

async function reply(
  request: LogRequest,
  records: number[],
  anchorId: number | undefined,
  total: number,
) {
  await act(async () => {
    request.resolve({
      config: request.config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        logs: records.map((id) => ({
          id,
          timestamp: new Date(id * 1000).toISOString(),
          line: `line-${id}`,
        })),
        anchor_id: anchorId,
        before_id: request.config.params.before_id,
        total,
        offset: request.config.params.offset,
        limit: request.config.params.limit,
      },
    })
  })
}

async function mount({ live = true, anchorId = 100 } = {}) {
  browser.localStorage.setItem('hmc:runtime-logs:live', String(live))
  await act(async () => {
    root.render(
      <ErrorBoundary>
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      </ErrorBoundary>,
    )
  })
  await reply(takeRequest(), ids(100), anchorId, 100)
}

async function poll() {
  await act(async () => {
    void client.refetchQueries({ queryKey: ['management-runtime-logs-live'], type: 'active' })
  })
  return takeRequest()
}

test('pausing at older logs stages incoming records without a render loop', async () => {
  await mount()
  await reply(takeRequest(), ids(100), 100, 100)
  await act(async () => workbench.setIsFollowingBottom(false))
  const rendersBefore = renders
  await reply(await poll(), ids(101), 101, 101)

  expect(renders - rendersBefore).toBeLessThan(10)
  expect(consoleErrors).not.toHaveBeenCalled()
  expect(workbench.pendingRuntimeLogCount).toBe(1)
  expect(workbench.runtimeLogs?.records[0].id).toBe('100')

  await act(async () => workbench.acceptPendingRuntimeLogs())
  expect(workbench.runtimeLogs?.records[0].id).toBe('101')
  expect(workbench.pendingRuntimeLogCount).toBe(0)
  expect(workbench.isFollowingBottom).toBe(true)
})

test('manual refresh cannot be overwritten by a cached live response', async () => {
  await mount()
  await reply(takeRequest(), ids(100), 100, 100)
  await act(async () => workbench.refetch())
  await reply(takeRequest(), ids(150), 150, 150)

  expect(workbench.runtimeLogs?.records.map((record) => record.id)).toEqual(ids(150).map(String))
  expect(workbench.runtimeLogs?.anchorId).toBe(150)
  expect(workbench.pendingRuntimeLogCount).toBe(0)
})

test('late live responses from before a refresh are ignored even with the same anchor', async () => {
  await mount({ anchorId: 1000 })
  const stalePoll = takeRequest()
  await act(async () => workbench.refetch())
  await reply(takeRequest(), ids(150), 1000, 150)
  await reply(stalePoll, ids(101), 1000, 101)

  expect(workbench.runtimeLogs?.records[0].id).toBe('150')
  expect(workbench.runtimeLogs?.total).toBe(150)
  await reply(takeRequest(), ids(151), 1000, 151)
  expect(workbench.runtimeLogs?.records[0].id).toBe('151')
  expect(requests).toHaveLength(0)
})

test('older pages reuse the ingestion ceiling and retain the original total', async () => {
  await mount({ live: false })
  await act(async () => workbench.loadOlderRuntimeLogs())
  const older = takeRequest()
  expect(older.config.params).toMatchObject({ anchor_id: 100, before_id: 51, offset: 0 })
  await reply(older, ids(50), 100, 50)

  expect(workbench.runtimeLogs?.records).toHaveLength(100)
  expect(workbench.runtimeLogs?.total).toBe(100)
  expect(workbench.canLoadOlderLogs).toBe(false)
})

test('filter placeholders cannot supply history cursors for the new filter', async () => {
  await mount({ live: false, anchorId: 1000 })
  await act(async () => workbench.setRuntimeLogFilters({ level: 'info' }))
  await reply(takeRequest(), ids(500), 1000, 200)
  await act(async () => workbench.setRuntimeLogFilters({ level: 'error' }))
  const firstPage = takeRequest()

  expect(workbench.runtimeLogs?.records[0].id).toBe('500')
  expect(workbench.canLoadOlderLogs).toBe(false)
  await act(async () => workbench.loadOlderRuntimeLogs())
  expect(requests).toHaveLength(0)
  await reply(firstPage, ids(1000), 1000, 550)
  await act(async () => workbench.loadOlderRuntimeLogs())
  const older = takeRequest()
  expect(older.config.params).toMatchObject({ level: 'error', before_id: 951, anchor_id: 1000 })
  await reply(older, ids(950), 1000, 500)
  expect(workbench.runtimeLogs?.records[50].id).toBe('950')
})

test('history responses from before a refresh are ignored even with unchanged boundaries', async () => {
  await mount({ live: false })
  await act(async () => workbench.loadOlderRuntimeLogs())
  const staleHistory = takeRequest()
  await act(async () => workbench.refetch())
  await reply(takeRequest(), ids(100), 100, 100)
  await reply(staleHistory, ids(50), 100, 50)

  expect(workbench.runtimeLogs?.records).toHaveLength(50)
  expect(workbench.canLoadOlderLogs).toBe(true)
})

test('history responses are discarded while a full read is in flight', async () => {
  await mount({ live: false })
  await act(async () => workbench.loadOlderRuntimeLogs())
  const staleHistory = takeRequest()
  await act(async () => workbench.refetch())
  const refresh = takeRequest()
  expect(workbench.canLoadOlderLogs).toBe(false)
  await reply(staleHistory, ids(50), 100, 50)
  expect(workbench.runtimeLogs?.records).toHaveLength(50)
  await reply(refresh, ids(150), 150, 150)
  expect(workbench.runtimeLogs?.records[0].id).toBe('150')
})

test('a history response must still join the current oldest row', async () => {
  await mount({ anchorId: 1000 })
  const live = takeRequest()
  await act(async () => workbench.loadOlderRuntimeLogs())
  const older = takeRequest()
  await reply(live, ids(101), 1000, 101)
  await reply(older, ids(50), 1000, 50)

  expect(workbench.runtimeLogs?.records).toHaveLength(50)
  expect(workbench.runtimeLogs?.records.at(-1)?.id).toBe('52')
  expect(workbench.canLoadOlderLogs).toBe(true)
})

test('a legacy response without an explicit anchor disables history loading', async () => {
  await mount({ live: false })
  await act(async () => workbench.refetch())
  await reply(takeRequest(), ids(100), undefined, 100)
  expect(workbench.canLoadOlderLogs).toBe(false)
  await act(async () => workbench.loadOlderRuntimeLogs())
  expect(requests).toHaveLength(0)
})
