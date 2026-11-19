import { Window } from 'happy-dom'
import assert from 'node:assert/strict'

const browser = new Window({ url: 'http://scope.test' })
Object.assign(globalThis, {
  window: browser,
  document: browser.document,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider, notifyManager } = await import('@tanstack/react-query')
const { useUserWorkbench } = await import('../../src/features/users/use-user-workbench')
const { useCapabilityStore } = await import('../../src/stores/capability-store')
const { useSessionStore } = await import('../../src/stores/session-store')
const axios = (await import('axios')).default

useSessionStore.setState({
  baseUrl: 'http://scope.test',
  managementKey: 'fixture',
  status: 'connected',
  connectedAt: 'first',
})
const capabilities = {
  ...useCapabilityStore.getState().capabilities,
  users: true,
  accessGroups: true,
  channelGroupCredentialCandidates: true,
}
useCapabilityStore.setState({ status: 'ready', runtimeMode: 'home-standalone', capabilities })
const requests: string[] = []
let failPicker = false
let partial = false
axios.defaults.adapter = async (config) => {
  const url = String(config.url)
  requests.push(config.params?.include ? url + '?include=credential' : url)
  let data: unknown = {}
  const row = { id: 11, channel_group_id: 1, auth_id: 'binding-id' }
  if (url === '/channel-group-details') {
    data = {
      channel_group_details: [
        config.params?.include && !partial
          ? { ...row, credential: { auth_id: 'binding-id', display_name: 'Current label' } }
          : row,
      ],
      credential_metadata_unavailable: partial,
    }
  }
  if (url === '/channel-group-credential-candidates') {
    if (failPicker) throw new Error('candidate read failed')
    data = { credential_candidates: [{ auth_id: 'binding-id', display_name: 'Picker label' }] }
  }
  return { config, headers: {}, status: 200, statusText: 'OK', data }
}

notifyManager.setScheduler(queueMicrotask)
const cache = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
})
const root = createRoot(browser.document.createElement('div') as unknown as HTMLElement)
let view: ReturnType<typeof useUserWorkbench>
function View({ scope, picker }: { scope: boolean; picker: boolean }) {
  view = useUserWorkbench({
    selectedUserId: null,
    loadCredentialCandidates: picker,
    loadModelCandidates: false,
    loadPeriodLimits: false,
    showBoundCredentials: scope,
  })
  return null
}
const render = (scope: boolean, picker: boolean) =>
  React.act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <View scope={scope} picker={picker} />
      </QueryClientProvider>,
    ),
  )
async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return
    await React.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
  assert.fail('Binding queries did not settle')
}

await render(false, false)
await waitFor(() => Boolean(view.groups))
assert(
  !requests.includes('/credentials') && !requests.includes('/channel-group-credential-candidates'),
)
requests.length = 0
await render(true, false)
await waitFor(() => view.boundCredentials?.get('binding-id')?.displayName === 'Current label')
assert.deepEqual(requests, ['/channel-group-details?include=credential'])
requests.length = 0
await render(true, true)
await waitFor(() => view.credentialCandidates.length === 1)
assert.deepEqual(requests, ['/channel-group-credential-candidates'])
assert.equal(view.credentialCandidates[0]?.authId, 'binding-id')
await render(true, false)
partial = true
await React.act(async () => view.refetchBoundCredentials())
await waitFor(() => view.boundCredentialsUnavailable)
assert.equal(view.groups!.channelGroupDetails.length, 1)
assert(!view.boundCredentials?.has('binding-id'))
partial = false
await React.act(async () => view.refetchBoundCredentials())
await waitFor(() => !view.boundCredentialsUnavailable && Boolean(view.boundCredentials?.size))

await React.act(async () => useSessionStore.setState({ connectedAt: 'second' }))
await waitFor(() => Boolean(view.groups && view.boundCredentials?.size))
assert.equal(view.credentialCandidates.length, 0)
failPicker = true
requests.length = 0
await render(true, true)
await waitFor(() => Boolean(view.credentialCandidatesError))
assert.deepEqual(requests, ['/channel-group-credential-candidates'])
await render(true, false)
requests.length = 0
await React.act(async () =>
  useCapabilityStore.setState({
    capabilities: { ...capabilities, channelGroupCredentialCandidates: false },
  }),
)
assert.deepEqual(requests, [])
await render(true, true)
await waitFor(() => !view.credentialCandidatesPending)
assert(requests.includes('/credentials'))
assert(requests.some((url) => url.includes('api-key') || url.includes('compatibility')))
assert(!requests.includes('/channel-group-credential-candidates'))
await React.act(async () => root.unmount())
cache.clear()
await browser.happyDOM.close()
