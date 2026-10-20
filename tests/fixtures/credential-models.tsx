import { Window } from 'happy-dom'
import assert from 'node:assert/strict'

const browser = new Window({ url: 'http://review.test' })
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'MutationObserver',
  'ResizeObserver',
  'CustomEvent',
  'Event',
  'DocumentFragment',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'NodeFilter',
  'HTMLButtonElement',
  'KeyboardEvent',
  'MouseEvent',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: key === 'window' ? browser : (browser as any)[key],
  })
}
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: browser.getComputedStyle.bind(browser),
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
})
const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider, notifyManager } = await import('@tanstack/react-query')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { en } = await import('../../src/lib/i18n/locales/en')
const { useSessionStore } = await import('../../src/stores/session-store')
const { useCapabilityStore } = await import('../../src/stores/capability-store')
const axios = (await import('axios')).default
const { CredentialDetailDrawer } =
  await import('../../src/features/credentials/credential-detail-drawer')
const { normalizeCredentialResource } = await import('../../src/lib/api/management/credentials')
const { useCredentialWorkbench, useCredentialModels } =
  await import('../../src/features/credentials/use-credential-workbench')
const { Sheet, SheetContent } = await import('../../src/components/ui/sheet')
const i18n = createInstance()
await i18n.use(initReactI18next).init({
  resources: { en },
  lng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})
notifyManager.setScheduler(queueMicrotask)
useSessionStore.setState({
  baseUrl: 'http://review.test',
  managementKey: 'synthetic-key',
  status: 'connected',
  connectedAt: 'review-session',
})
useCapabilityStore.setState({
  status: 'ready',
  runtimeMode: 'home',
  capabilities: Object.fromEntries(
    Object.keys(useCapabilityStore.getState().capabilities).map((key) => [key, false]),
  ) as any,
})
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
})
const saved: any[] = []
let raw: any = { excluded_models: ['model-a'] }
axios.defaults.adapter = async (config) => ({
  config,
  status: 200,
  statusText: 'OK',
  headers: {},
  data: config.url === '/credentials/download' ? raw : { files: [] },
})
const container = browser.document.createElement('div')
browser.document.body.append(container)
const root = createRoot(container as any)
const render = async (node: any) => {
  await React.act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18n}>{node}</I18nextProvider>
      </QueryClientProvider>,
    ),
  )
}
const resource = (id: string, overrides: any = {}) =>
  normalizeCredentialResource(
    {
      id,
      name: `${id}.json`,
      type: 'codex',
      provider: 'codex',
      prefix: '',
      proxy_url: '',
      websockets: false,
      ...overrides,
    },
    0,
  )
const drawer = (credential: any, models: any[], exclusionModels: any[] | null) => (
  <Sheet open>
    <SheetContent>
      <CredentialDetailDrawer
        resource={credential}
        open
        tab="metadata"
        mutating={false}
        models={models}
        exclusionModels={exclusionModels}
        modelsLoading={false}
        quotaEntry={null}
        quotaRecollectAvailable={false}
        quotaCollecting={false}
        onCollectQuota={() => {}}
        showConcurrency={false}
        observationAvailable={false}
        canEditConcurrency={false}
        inFlightSummary={null}
        inFlightObservation={null}
        concurrencyPending={false}
        concurrencyStale={false}
        concurrencyErrorMessage={null}
        onTabChange={() => {}}
        onUpdateMetadata={async (patch) => {
          saved.push(patch)
        }}
        onToggleStatus={async () => {}}
        onFetchModels={async () => {}}
        onDownload={async () => {}}
        onDelete={() => {}}
      />
    </SheetContent>
  </Sheet>
)
const model = (id: string) => ({ id, displayName: null, type: null, ownedBy: null })
const labels = () =>
  [...browser.document.querySelectorAll('label')]
    .filter((label) => label.querySelector('[role="checkbox"]'))
    .map((label) => label.textContent.trim())
async function expandPicker() {
  const button = [...browser.document.querySelectorAll('button')].find(
    (button) => button.hasAttribute('aria-expanded') && /excluded|rules/i.test(button.textContent),
  )
  assert.ok(button, 'exclusion picker button')
  if (button.getAttribute('aria-expanded') === 'false') {
    await React.act(async () => button.click())
  }
}
async function selectModel(id: string) {
  const label = [...browser.document.querySelectorAll('label')].find(
    (label) => label.textContent.trim() === id,
  )
  const checkbox = label?.querySelector('[role="checkbox"]')
  assert.ok(checkbox, `model checkbox: ${id}`)
  await React.act(async () => (checkbox as any).click())
}

const candidates = [model('model-a'), model('model-b')]
await render(
  drawer(resource('A', { excluded_models: ['model-a'] }), [model('team/alias')], candidates),
)
await expandPicker()
assert.deepEqual(labels(), ['model-a', 'model-b'])
await selectModel('model-a')
assert.deepEqual(labels(), ['model-a', 'model-b'], 'unchecking must retain the candidate')
await selectModel('model-a')
await selectModel('model-b')
async function submit() {
  await React.act(async () =>
    browser.document
      .querySelector('form')!
      .dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })),
  )
}
await submit()
assert.deepEqual(saved.at(-1).excludedModels, ['model-a', 'model-b'])
assert.ok(!labels().includes('team/alias'), 'routed IDs must never become exclusion rules')

raw = { excluded_models: ['legacy-rule'], prefix: 'team' }
await render(
  drawer(
    resource('B', { prefix: 'team', excluded_models: ['legacy-rule'] }),
    [model('team/alias')],
    null,
  ),
)
await expandPicker()
assert.deepEqual(labels(), ['legacy-rule'])
assert.match(browser.document.body.textContent, /Exclusion candidates are unavailable/)
await selectModel('legacy-rule')
assert.deepEqual(labels(), ['legacy-rule'], 'manual rules must remain selectable on old backends')
await selectModel('legacy-rule')

raw = { excluded_models: ['model-*'] }
await render(drawer(resource('C', { excluded_models: ['model-*'] }), [], candidates))
await expandPicker()
const clear = [...browser.document.querySelectorAll('button')].find(
  (node) => node.textContent.trim() === 'Clear',
)
assert.ok(clear)
await React.act(async () => clear.click())
await submit()
assert.deepEqual(saved.at(-1).excludedModels, [], 'Clear must remove wildcard rules as well')
assert.deepEqual(labels(), ['model-a', 'model-b'])

const rulesInput = [...browser.document.querySelectorAll('textarea')].find(
  (node) => node.placeholder === 'model-a\nmodel-b*',
)
assert.ok(rulesInput)
for (const value of ['n', 'ne', 'new-model']) {
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype, 'value')!.set!.call(
      rulesInput,
      value,
    )
    rulesInput.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}
assert.deepEqual(
  labels(),
  ['model-a', 'model-b', 'new-model'],
  'typing must not retain partial IDs',
)
await selectModel('new-model')
assert.deepEqual(labels(), ['model-a', 'model-b', 'new-model'])
await selectModel('new-model')

let query: ReturnType<typeof useCredentialModels>
let workbench: ReturnType<typeof useCredentialWorkbench>
function Harness({ selected }: { selected: any }) {
  query = useCredentialModels(selected, true)
  workbench = useCredentialWorkbench()
  return null
}
const pending: any[] = []
axios.defaults.adapter = (config) =>
  config.url === '/credentials/models'
    ? new Promise((resolve) => pending.push({ config, resolve }))
    : Promise.resolve({ config, status: 200, statusText: 'OK', headers: {}, data: { files: [] } })
const a = resource('A')
const b = resource('B', { provider: 'antigravity' })
async function answer(request: any, data: any) {
  assert.ok(request, 'missing models request')
  await React.act(async () =>
    request.resolve({ config: request.config, status: 200, statusText: 'OK', headers: {}, data }),
  )
}
await render(<Harness selected={a} />)
await answer(pending.shift(), {
  models: [model('codex-only')],
  exclusion_models: [model('codex-source')],
})
assert.equal(query!.data?.models[0].id, 'codex-only')
await render(<Harness selected={b} />)
assert.equal(query!.data, undefined, 'another credential must not reuse the previous models')
await answer(pending.shift(), { models: [model('antigravity-only')] })
assert.equal(query!.data?.models[0].id, 'antigravity-only')
assert.equal(query!.data?.exclusionModels, null, 'old backend must not substitute routed models')

await React.act(async () => {
  void query!.refetch()
})
const late = pending.shift()
await React.act(async () =>
  useSessionStore.setState({ baseUrl: 'http://other-review.test', connectedAt: 'other-session' }),
)
assert.equal(query!.data, undefined)
assert.equal(late.config.signal.aborted, true, 'old session request must be cancelled')
await answer(late, { models: [model('OLD-SERVER-MODEL')] })
assert.equal(query!.data, undefined, 'a late response must not populate the new session')
await answer(pending.shift(), {
  models: [model('new-server-model')],
  exclusion_models: [model('source')],
})
assert.equal(query!.data?.models[0].id, 'new-server-model')

await React.act(async () => {
  void query!.refetch()
})
const sameServerLate = pending.shift()
await React.act(async () => useSessionStore.setState({ connectedAt: 'reconnected-session' }))
assert.equal(query!.data, undefined)
await answer(sameServerLate, { models: [model('OLD-SESSION-MODEL')] })
assert.equal(query!.data, undefined, 'reconnect at the same URL must isolate the cache')
await answer(pending.shift(), {
  models: [model('current-model')],
  exclusion_models: [model('source')],
})

let savedMetadata: Promise<unknown>
await React.act(async () => {
  savedMetadata = workbench!.updateMetadata({ resource: b, input: { excludedModels: ['source'] } })
})
await answer(pending.shift(), { models: [], exclusion_models: [model('source')] })
await React.act(async () => {
  await savedMetadata
})
assert.deepEqual(query!.data?.models, [], 'saving exclusions must refresh effective models')
assert.equal(query!.data?.exclusionModels?.[0].id, 'source')

await React.act(async () => root.unmount())
client.clear()
await browser.happyDOM.close()
console.log('credential model picker and session isolation passed')
process.exit(0)
