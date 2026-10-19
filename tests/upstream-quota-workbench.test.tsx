import { StrictMode, act, useState } from 'react'

import {
  QueryClient,
  QueryClientProvider,
  defaultScheduler,
  notifyManager,
} from '@tanstack/react-query'

import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterAll, afterEach, beforeAll, beforeEach, expect, spyOn, test } from 'bun:test'
import { Window } from 'happy-dom'
import { createInstance } from 'i18next'
import { type Root, createRoot } from 'react-dom/client'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { AccountsPanel } from '@/features/credentials/accounts-panel'
import { UpstreamQuotaCell } from '@/features/upstream/quota-cells'
import { resolveUpstreamQuotaCellState } from '@/features/upstream/upstream-quota-model'
import {
  useUpstreamQuota,
  useUpstreamQuotaCredentialDetail,
} from '@/features/upstream/use-upstream-quota'
import { en } from '@/lib/i18n/locales/en'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

const browser = new Window({ url: 'http://quota.test' })
const globals = {
  window: browser,
  document: browser.document,
  navigator: browser.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
  HTMLElement: browser.HTMLElement,
  Element: browser.Element,
  Node: browser.Node,
  MutationObserver: browser.MutationObserver,
  ResizeObserver: browser.ResizeObserver,
  CustomEvent: browser.CustomEvent,
  Event: browser.Event,
  getComputedStyle: browser.getComputedStyle.bind(browser),
}
const originalGlobals = new Map(
  Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
)
const originalAdapter = axios.defaults.adapter
const originalSession = useSessionStore.getState()
const originalCapabilities = useCapabilityStore.getState()
const i18n = createInstance()
const credentialId = 'meta-01'
const detailPath = `/quota/credentials/${credentialId}`
const resource = {
  id: 'meta:meta-01',
  authIndex: credentialId,
  identifier: credentialId,
  name: 'Meta account',
}
const earlierAttempt = '2026-10-19T01:00:00Z'
const laterAttempt = '2026-10-19T02:00:00Z'

function entry(overrides: Record<string, unknown> = {}) {
  return {
    credential_id: credentialId,
    auth_index: credentialId,
    provider: 'meta',
    credential_type: 'oauth',
    credential_status: 'enabled',
    quota_status: 'unknown',
    freshness: 'never',
    collection_status: 'idle',
    last_attempt_at: null,
    source: null,
    window_count: 0,
    primary_windows: [],
    ...overrides,
  }
}
function success(overrides: Record<string, unknown> = {}) {
  return entry({
    quota_status: 'healthy',
    freshness: 'fresh',
    collection_status: 'success',
    last_attempt_at: laterAttempt,
    source: 'active_probe',
    observed_at: laterAttempt,
    window_count: 1,
    primary_windows: [
      {
        id: 'meta-window',
        period_unit: 'hour',
        period_value: 5,
        unit: 'percentage',
        status: 'healthy',
        remaining_ratio: 0.98,
      },
    ],
    ...overrides,
  })
}

type Request = {
  config: InternalAxiosRequestConfig
  resolve: (response: AxiosResponse) => void
  reject: (error: unknown) => void
}
let requests: Request[]
let client: QueryClient
let root: Root
let container: HTMLElement
let quota: ReturnType<typeof useUpstreamQuota>
let rerender: () => void
let showDetail: () => void
let showAccounts: () => void
let detailItem: ReturnType<typeof useUpstreamQuotaCredentialDetail>['item']
let timers: Map<number, () => void>
let timerSequence: number
let setTimeoutSpy: ReturnType<typeof spyOn>
let clearTimeoutSpy: ReturnType<typeof spyOn>
let renders: number

function Detail() {
  detailItem = useUpstreamQuotaCredentialDetail(credentialId).item
  return null
}
function Harness() {
  if (++renders > 100) throw new Error('Quota workbench did not settle')
  quota = useUpstreamQuota()
  const [, setVersion] = useState(0)
  const [opened, setOpened] = useState(false)
  const [accounts, setAccounts] = useState(false)
  const [, setStats] = useState<unknown>(null)
  rerender = () => setVersion((n) => n + 1)
  showDetail = () => setOpened(true)
  showAccounts = () => setAccounts(true)
  return (
    <>
      <UpstreamQuotaCell
        collecting={quota.collectingIds.has(credentialId)}
        state={resolveUpstreamQuotaCellState({
          available: quota.available,
          loading: quota.isPending,
          truncated: quota.truncated,
          map: quota.map,
          resource,
        })}
      />
      {opened ? <Detail /> : null}
      {accounts ? (
        <AccountsPanel
          onStatsChange={setStats}
          quotaAvailable={quota.available}
          quotaLoading={quota.isPending}
          quotaTruncated={quota.truncated}
          quotaMap={quota.map}
          quotaRecollectAvailable={quota.capabilities.quotaRecollect}
          quotaCollectingIds={quota.collectingIds}
          onCollectQuota={async (resource) => {
            await quota.syncCredentialQuota(resource.authIndex ?? resource.identifier)
          }}
        />
      ) : null}
    </>
  )
}

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { en },
    lng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
})
beforeEach(() => {
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  requests = []
  timers = new Map()
  timerSequence = 100000
  renders = 0
  detailItem = null
  const nativeSetTimeout = browser.setTimeout.bind(browser)
  const nativeClearTimeout = browser.clearTimeout.bind(browser)
  setTimeoutSpy = spyOn(browser, 'setTimeout').mockImplementation((callback, delay, ...args) => {
    if (delay !== 1000) return nativeSetTimeout(callback, delay, ...args)
    const id = ++timerSequence
    timers.set(id, callback as () => void)
    return id
  })
  clearTimeoutSpy = spyOn(browser, 'clearTimeout').mockImplementation((id) => {
    if (timers.delete(Number(id))) return
    nativeClearTimeout(id)
  })
  notifyManager.setScheduler(queueMicrotask)
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false, refetchOnWindowFocus: false } },
  })
  useSessionStore.setState({
    baseUrl: 'http://quota.test',
    managementKey: 'synthetic-test-key',
    status: 'connected',
    connectedAt: 'quota-session-a',
  })
  useCapabilityStore.setState({
    status: 'ready',
    runtimeMode: 'home',
    capabilities: {
      ...originalCapabilities.capabilities,
      quotaSnapshots: true,
      quotaSnapshotDetails: true,
      quotaRecollect: true,
    },
  })
  axios.defaults.adapter = (config) =>
    new Promise((resolve, reject) => requests.push({ config, resolve, reject }))
  container = browser.document.createElement('div') as unknown as HTMLElement
  browser.document.body.appendChild(container as never)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  client.clear()
  axios.defaults.adapter = originalAdapter
  useSessionStore.setState(originalSession, true)
  useCapabilityStore.setState(originalCapabilities, true)
  notifyManager.setScheduler(defaultScheduler)
  setTimeoutSpy.mockRestore()
  clearTimeoutSpy.mockRestore()
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})
afterAll(async () => browser.happyDOM.close())

function take(url: string, method = 'get') {
  const index = requests.findIndex(
    (request) => request.config.url === url && request.config.method === method,
  )
  expect(index).toBeGreaterThanOrEqual(0)
  return requests.splice(index, 1)[0]!
}
async function reply(request: Request, data: unknown) {
  await act(async () =>
    request.resolve({ config: request.config, status: 200, statusText: 'OK', headers: {}, data }),
  )
}
async function mount(items = [entry()], total = items.length, strict = false) {
  await act(async () =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          {strict ? (
            <StrictMode>
              <Harness />
            </StrictMode>
          ) : (
            <Harness />
          )}
        </QueryClientProvider>
      </I18nextProvider>,
    ),
  )
  requests = requests.filter(({ config }) => !config.signal?.aborted)
  await reply(take('/quota/credentials'), { items, total })
}
async function tick() {
  expect(timers.size).toBe(1)
  const [id, callback] = [...timers][0]!
  timers.delete(id)
  await act(async () => callback())
}
async function begin(baseline = entry(), accepted = 1) {
  const queued: number[] = []
  let promise!: ReturnType<typeof quota.syncCredentialQuota>
  await act(async () => {
    promise = quota.syncCredentialQuota(credentialId, (result) => queued.push(result.accepted))
  })
  await reply(take(detailPath), baseline)
  const post = take('/quota/collect', 'post')
  expect(JSON.parse(post.config.data)).toEqual({ credential_ids: [credentialId] })
  await reply(post, { accepted, running: accepted > 0 })
  return { promise, queued }
}

test('never-collected credential waits for a new result and shares it with the drawer', async () => {
  await mount()
  expect(container.textContent).toContain('Not collected')
  const { promise, queued } = await begin()
  expect(queued).toEqual([1])
  expect(quota.collectingIds.has(credentialId)).toBe(true)
  await reply(
    take(detailPath),
    entry({ collection_status: 'collecting', last_attempt_at: laterAttempt }),
  )
  expect(quota.collectingIds.has(credentialId)).toBe(true)
  await tick()
  await reply(take(detailPath), success())
  expect((await promise)?.completion).toBe('settled')
  expect(quota.collectingIds.size).toBe(0)
  expect(container.textContent).toContain('98%')
  await act(async () => showDetail())
  expect(detailItem?.collectionStatus).toBe('success')
  expect(detailItem?.primaryWindows[0]?.remainingRatio).toBe(0.98)
})

test('duplicate clicks queue one request and keep the quota map stable across unrelated renders', async () => {
  await mount()
  const map = quota.map
  await act(async () => rerender())
  expect(quota.map).toBe(map)
  const { promise } = await begin()
  expect(await quota.syncCredentialQuota(credentialId)).toBeNull()
  expect(requests.filter(({ config }) => config.method === 'post')).toHaveLength(0)
  await reply(take(detailPath), success())
  expect((await promise)?.completion).toBe('settled')
})

test('cached success is not completion and a failed probe keeps the previous windows', async () => {
  const previous = success({ last_attempt_at: earlierAttempt, observed_at: earlierAttempt })
  await mount([previous])
  const { promise } = await begin(previous)
  await reply(take(detailPath), previous)
  expect(quota.collectingIds.has(credentialId)).toBe(true)
  expect(container.textContent).toContain('98%')
  await tick()
  await reply(
    take(detailPath),
    success({
      collection_status: 'failed',
      observed_at: earlierAttempt,
      error: {
        code: 'DCA_TOKEN_UNAVAILABLE',
        message: 'Credential DCA token is unavailable.',
        retryable: false,
      },
    }),
  )
  const result = await promise
  expect(result?.completion).toBe('settled')
  expect(result?.item?.collectionStatus).toBe('failed')
  expect(container.textContent).toContain('98%')
  expect(container.textContent).toContain('Collection failed')
  expect(container.textContent).toContain('Import the credential again')
})

test('a credential outside the first snapshot page gets its own result without changing pagination totals', async () => {
  await mount([], 201)
  expect(container.textContent).toContain('Not loaded')
  const { promise } = await begin()
  await reply(take(detailPath), success())
  await promise
  expect(quota.total).toBe(201)
  expect(quota.truncated).toBe(true)
  expect(container.textContent).toContain('98%')
})

test('a late list response cannot replace the newly collected quota', async () => {
  await mount()
  await act(async () => {
    void quota.refetch()
  })
  const staleList = take('/quota/credentials')
  const { promise } = await begin()
  await reply(take(detailPath), success())
  await promise
  await reply(staleList, { items: [entry()], total: 1 })
  expect(quota.map.get(credentialId)?.collectionStatus).toBe('success')
  expect(container.textContent).toContain('98%')
})

test('accepted zero reads the current state and can wait on an existing collection', async () => {
  await mount()
  const { promise, queued } = await begin(entry(), 0)
  await reply(
    take(detailPath),
    entry({ collection_status: 'collecting', last_attempt_at: laterAttempt }),
  )
  expect(queued).toEqual([0])
  await tick()
  await reply(take(detailPath), success())
  expect((await promise)?.completion).toBe('settled')
})

test('accepted zero with an idle credential does not pretend a job is running', async () => {
  await mount()
  const { promise } = await begin(entry(), 0)
  await reply(take(detailPath), entry())
  expect((await promise)?.completion).toBe('not-started')
  expect(quota.collectingIds.size).toBe(0)
  expect(timers.size).toBe(0)
})

test('polling is bounded and never resubmits the collection request', async () => {
  await mount()
  const { promise } = await begin()
  for (let poll = 0; poll < 30; poll++) {
    if (poll > 0) await tick()
    await reply(take(detailPath), entry())
  }
  expect((await promise)?.completion).toBe('pending')
  expect(quota.collectingIds.size).toBe(0)
  expect(timers.size).toBe(0)
  expect(requests.filter(({ config }) => config.method === 'post')).toHaveLength(0)
})

test('switching connections aborts an old read and ignores its late result', async () => {
  await mount()
  const { promise } = await begin()
  const oldRead = take(detailPath)
  await act(async () =>
    useSessionStore.setState({ baseUrl: 'http://other.test', connectedAt: 'quota-session-b' }),
  )
  expect(oldRead.config.signal?.aborted).toBe(true)
  await reply(take('/quota/credentials'), { items: [], total: 0 })
  await reply(oldRead, success())
  expect(await promise).toBeNull()
  expect(quota.map.size).toBe(0)
  expect(quota.collectingIds.size).toBe(0)
  expect(timers.size).toBe(0)
})

test('unmounting clears polling without another upstream request', async () => {
  await mount()
  const { promise } = await begin()
  await reply(take(detailPath), entry())
  expect(timers.size).toBe(1)
  await act(async () => root.unmount())
  expect(await promise).toBeNull()
  expect(timers.size).toBe(0)
  expect(requests).toHaveLength(0)
})

test('a baseline read error preserves existing quota and does not submit a probe', async () => {
  await mount([success()])
  let outcome!: Promise<unknown>
  await act(async () => {
    outcome = quota.syncCredentialQuota(credentialId).catch((error) => error)
  })
  await act(async () => take(detailPath).reject(new Error('Synthetic network failure')))
  expect(await outcome).toBeInstanceOf(Error)
  expect(quota.collectingIds.size).toBe(0)
  expect(container.textContent).toContain('98%')
  expect(requests).toHaveLength(0)
})

async function mountAccounts() {
  await act(async () => showAccounts())
  await reply(take('/credentials'), {
    files: [
      {
        id: credentialId,
        auth_index: credentialId,
        name: 'meta-account.json',
        provider: 'meta',
        type: 'meta',
        disabled: false,
        status: 'active',
      },
    ],
  })
}

test('the real credential row offers collection for a backend never-collected entry', async () => {
  await mount()
  await mountAccounts()
  const menu = container.querySelector('tbody button[aria-haspopup="menu"]')
  expect(menu).not.toBeNull()
  // With collection enabled the fourth row action is placed in the overflow menu.
  // The old null-entry gate rendered only View, Download and Delete inline.
  expect(container.querySelector('tbody')?.textContent).not.toContain('Delete')
  const { promise } = await begin()
  await reply(take(detailPath), success())
  await promise
  expect(container.textContent).toContain('98%')
})

test('the real credential row hides active collection when the backend capability is absent', async () => {
  useCapabilityStore.setState({
    capabilities: { ...useCapabilityStore.getState().capabilities, quotaRecollect: false },
  })
  await mount()
  await mountAccounts()
  expect(container.querySelector('tbody button[aria-haspopup="menu"]')).toBeNull()
  expect(container.textContent).toContain('This backend does not support active collection')
})

test('a late POST response from an old connection cannot show a queued notification', async () => {
  await mount()
  const queued: number[] = []
  let promise!: ReturnType<typeof quota.syncCredentialQuota>
  await act(async () => {
    promise = quota.syncCredentialQuota(credentialId, (result) => queued.push(result.accepted))
  })
  await reply(take(detailPath), entry())
  const oldPost = take('/quota/collect', 'post')
  await act(async () =>
    useSessionStore.setState({ baseUrl: 'http://other.test', connectedAt: 'quota-session-b' }),
  )
  expect(oldPost.config.signal?.aborted).toBe(true)
  await reply(oldPost, { accepted: 1, running: true })
  expect(await promise).toBeNull()
  expect(queued).toEqual([])
  await reply(take('/quota/credentials'), { items: [], total: 0 })
  expect(quota.map.size).toBe(0)
})

test('partial probe results settle without being promoted to complete success', async () => {
  await mount()
  const { promise } = await begin()
  await reply(take(detailPath), success({ collection_status: 'partial' }))
  const result = await promise
  expect(result?.completion).toBe('settled')
  expect(result?.item?.collectionStatus).toBe('partial')
})

test('a backend without detail reads queues collection without claiming completion', async () => {
  useCapabilityStore.setState({
    capabilities: { ...useCapabilityStore.getState().capabilities, quotaSnapshotDetails: false },
  })
  await mount()
  let promise!: ReturnType<typeof quota.syncCredentialQuota>
  await act(async () => {
    promise = quota.syncCredentialQuota(credentialId)
  })
  await reply(take('/quota/collect', 'post'), { accepted: 1, running: true })
  await reply(take('/quota/credentials'), { items: [entry()], total: 1 })
  expect((await promise)?.completion).toBe('pending')
  expect(requests).toHaveLength(0)
})

test('collection remains usable after StrictMode effect cleanup and remount', async () => {
  await mount([entry()], 1, true)
  const { promise } = await begin()
  await reply(take(detailPath), success())
  expect((await promise)?.completion).toBe('settled')
  expect(quota.collectingIds.size).toBe(0)
})

test('a fresh detail read prevents probing a credential that became unsupported', async () => {
  await mount([success()])
  let promise!: ReturnType<typeof quota.syncCredentialQuota>
  await act(async () => {
    promise = quota.syncCredentialQuota(credentialId)
  })
  await reply(
    take(detailPath),
    entry({
      credential_type: 'provider_api_key',
      quota_status: 'unsupported',
      collection_status: 'unsupported',
    }),
  )
  expect((await promise)?.completion).toBe('not-started')
  expect(quota.map.get(credentialId)?.status).toBe('unsupported')
  expect(quota.collectingIds.size).toBe(0)
  expect(requests).toHaveLength(0)
})
