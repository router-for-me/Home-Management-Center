import { Window } from 'happy-dom'
import assert from 'node:assert/strict'

// Initialize the DOM before React/Radix feature detection, isolated from other tests.
const browser = new Window({ url: 'http://forms.test' })
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
const { PluginConfigSheet } = await import('../../src/features/plugins/plugins-workbench-page')
const { CredentialDetailDrawer } =
  await import('../../src/features/credentials/credential-detail-drawer')
const { ProviderFormPanel } = await import('../../src/features/providers/providers-panel')
const { normalizeCredentialResource } = await import('../../src/lib/api/management/credentials')
const { fetchProviderSnapshot } = await import('../../src/lib/api/management/providers')
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
  baseUrl: 'http://forms.test',
  managementKey: 'synthetic-key',
  status: 'connected',
  connectedAt: 'forms-session',
})
useCapabilityStore.setState({
  status: 'ready',
  runtimeMode: 'home',
  capabilities: Object.fromEntries(
    Object.keys(useCapabilityStore.getState().capabilities).map((key) => [key, false]),
  ) as any,
})
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
type PendingRequest = { config: any; resolve: (value: any) => void; reject: (error: Error) => void }
const pending: PendingRequest[] = []
axios.defaults.adapter = (config) =>
  new Promise((resolve, reject) => pending.push({ config, resolve, reject }))
const container = browser.document.createElement('div')
browser.document.body.append(container)
const uncaught: unknown[] = []
const root = createRoot(container as any, {
  onUncaughtError: (error) => {
    uncaught.push(error)
  },
})
const render = async (child: any) => {
  await React.act(async () =>
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(I18nextProvider, { i18n }, child),
      ),
    ),
  )
  assert.deepEqual(uncaught, [])
}
function button(text: string) {
  const result = [...browser.document.querySelectorAll('button')].find(
    (node) => node.textContent.trim() === text || node.getAttribute('aria-label') === text,
  )
  assert.ok(result, `Missing button: ${text}`)
  return result
}
function input(placeholder: string) {
  const result = browser.document.querySelector<HTMLInputElement>(
    `input[placeholder="${placeholder}"]`,
  )
  assert.ok(result, `Missing input: ${placeholder}`)
  return result
}
async function click(node: any) {
  await React.act(async () => node.click())
}
async function select(label: string, text: string) {
  const trigger = browser.document.querySelector(`[role="combobox"][aria-label="${label}"]`)
  assert.ok(trigger, `Missing select: ${label}`)
  await React.act(async () =>
    trigger.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  )
  const option = [...browser.document.querySelectorAll('[role="option"]')].find(
    (node) => node.textContent.trim() === text,
  )
  assert.ok(option, `Missing option: ${text}`)
  await React.act(async () =>
    option.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  )
}
async function edit(node: any, value: string) {
  await React.act(async () => {
    const prototype =
      node.tagName === 'TEXTAREA'
        ? browser.HTMLTextAreaElement.prototype
        : browser.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value)
    node.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}
async function submit() {
  const form = browser.document.querySelector('form')
  assert.ok(form)
  await React.act(async () =>
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })),
  )
}
async function respond(url: string, data: unknown, fail = false) {
  const index = pending.findIndex((request) => request.config.url === url)
  assert.ok(index >= 0, `Missing pending request: ${url}`)
  const request = pending.splice(index, 1)[0]
  await React.act(async () => {
    if (fail) request.reject(new Error('Fixture connection failed'))
    else
      request.resolve({ data, config: request.config, status: 200, statusText: 'OK', headers: {} })
  })
  assert.deepEqual(uncaught, [])
}

const plugin = { id: 'fixture', name: 'Fixture', enabled: true } as any
let saved: any[] = []
const pluginForm = (open = true) =>
  React.createElement(PluginConfigSheet, {
    plugin,
    open,
    saving: false,
    onClose: () => {},
    onSave: async (_plugin, value) => {
      saved.push(value)
    },
  })
async function loadPlugin(config: any, fields: any[] = []) {
  await respond('/plugins', { plugins: [{ id: 'fixture', config_fields: fields }] })
  await respond('/config/plugins/configs/fixture', config)
}
const credential = normalizeCredentialResource(
  {
    id: 'A',
    name: 'A.json',
    type: 'codex',
    provider: 'codex',
    prefix: '',
    proxy_url: '',
    websockets: false,
  },
  0,
)
const credentialForm = () =>
  React.createElement(
    Sheet,
    { open: true },
    React.createElement(
      SheetContent,
      null,
      React.createElement(CredentialDetailDrawer, {
        resource: credential,
        open: true,
        tab: 'metadata',
        mutating: false,
        models: null,
        quotaEntry: null,
        quotaRecollectAvailable: false,
        quotaCollecting: false,
        onCollectQuota: async () => {},
        showConcurrency: false,
        observationAvailable: false,
        canEditConcurrency: false,
        inFlightSummary: null,
        inFlightObservation: null,
        concurrencyPending: false,
        concurrencyStale: false,
        concurrencyErrorMessage: null,
        onTabChange: () => {},
        onUpdateMetadata: async (value) => {
          saved.push(value)
        },
        onToggleStatus: async () => {},
        onFetchModels: async () => {},
        onDownload: async () => {},
        onDelete: () => {},
      }),
    ),
  )

async function renderConfig(rawConfig: Record<string, unknown>) {
  const { ConfigWorkbenchPage } = await import('../../src/features/config/config-workbench-page')
  const { normalizeConfigValues } = await import('../../src/lib/api/management/config')
  const { TooltipProvider } = await import('../../src/components/ui/tooltip')
  client.setQueryData(['management-config', 'http://forms.test', 'forms-session'], {
    fetchedAt: '2026-01-01T00:00:00Z',
    rawConfig,
    structured: normalizeConfigValues(rawConfig),
  })
  await render(React.createElement(TooltipProvider, {}, React.createElement(ConfigWorkbenchPage)))
}

const scenario = process.argv[2]
if (scenario === 'oauth-alias-channel-edit') {
  const { ModelAliasEditor } = await import('../../src/features/config/oauth-model-alias-editor')
  const initial = {
    claude: [{ name: 'upstream', alias: 'client' }],
    vertex: [
      { name: 'same', alias: 'native', openapi: false, fork: false, extra: 0 },
      { name: 'same', alias: 'compat', openapi: true },
    ],
    plugin: { future: [] },
  }
  let draft: Record<string, unknown> = initial
  function Editor() {
    const [value, setValue] = React.useState(draft)
    return React.createElement(ModelAliasEditor, {
      value,
      availableChannels: ['claude', 'vertex'],
      disabled: false,
      onChange: (next) => {
        draft = next
        setValue(next)
      },
    })
  }
  const labels = en.common.configPage.json
  await render(React.createElement(Editor))
  await edit(input(labels.placeholders.alias), 'changed-claude')
  assert.deepEqual(draft, { ...initial, claude: [{ name: 'upstream', alias: 'changed-claude' }] })
  await select(labels.aliasChannel, 'vertex')
  await edit(input(labels.placeholders.alias), 'changed-native')
  assert.deepEqual(draft.vertex, [
    { ...initial.vertex[0], alias: 'changed-native' },
    initial.vertex[1],
  ])
  await select(labels.vertexProtocol, labels.vertexModes.auto)
  assert.deepEqual(draft.vertex, [
    { name: 'same', alias: 'changed-native', fork: false, extra: 0 },
    initial.vertex[1],
  ])
  await select(labels.aliasChannel, 'plugin')
  assert.equal(button(labels.addAlias).disabled, true)
  assert.deepEqual(draft.plugin, initial.plugin)
} else if (scenario === 'oauth-model-setting-validation') {
  await renderConfig({ 'config-version': 8 })
  const field = browser.document.getElementById('config-field-oauthModelSettingsJson')!
  const toolbar = browser.document.querySelector('[data-config-sticky]')!
  const copy = en.common.configPage
  const summary = i18n.t('configPage.validation.summary', { count: 1 })
  const save = button(copy.actions.save)
  const add = button(copy.modelSettings.add)
  const names = () => [...field.querySelectorAll('input[required]')]
  const hasFeedback = () => toolbar.textContent.includes(summary)
  const focus = async (input: { focus: () => void }) => React.act(async () => input.focus())

  await click(add)
  const first = names()[0]
  assert.equal(browser.document.activeElement, first)
  assert.equal(field.querySelector('[aria-invalid="true"]'), null)
  assert.ok(!field.textContent.includes(copy.validation.invalidField))
  assert.equal(hasFeedback(), false)
  assert.equal(save.disabled, true)
  const limit = input(copy.modelSettings.defaultLimit)
  await focus(limit)
  assert.equal(hasFeedback(), true)
  assert.equal(
    browser.document.getElementById(first.getAttribute('aria-describedby')!)?.textContent,
    copy.modelSettings.nameRequired,
  )
  await focus(first)
  await edit(first, 'model-a')
  assert.equal(first.hasAttribute('aria-describedby'), false)
  assert.equal(hasFeedback(), false)
  assert.equal(save.disabled, false)

  await focus(limit)
  await edit(limit, '2.5')
  assert.equal(save.disabled, true)
  assert.equal(hasFeedback(), false)
  await focus(add)
  assert.ok(field.textContent.includes(copy.modelSettings.invalidLimit))
  assert.equal(hasFeedback(), true)
  await click(add)
  assert.equal(browser.document.activeElement, names()[1])
  assert.notEqual(names()[1].getAttribute('aria-invalid'), 'true')
  assert.equal(hasFeedback(), true)
  await edit(names()[1], 'model-b')
  await click(button(i18n.t('configPage.modelSettings.removeRow', { model: 'model-a' })))
  assert.equal(names()[0].value, 'model-b')
  assert.equal(hasFeedback(), false)
  assert.equal(save.disabled, false)

  await click(add)
  await focus(add)
  await select(copy.modelSettings.provider, 'vertex')
  await click(add)
  assert.notEqual(names()[0].getAttribute('aria-invalid'), 'true')
  await edit(names()[0], 'vertex-a')
  assert.equal(hasFeedback(), true)
  assert.equal(save.disabled, true)
  await select(copy.modelSettings.provider, 'codex')
  assert.equal(names()[1].getAttribute('aria-invalid'), 'true')
  await click(button(i18n.t('configPage.modelSettings.removeRow', { model: 'model-b' })))
  assert.equal(names()[0].getAttribute('aria-invalid'), 'true')
  await edit(names()[0], 'model-c')
  assert.equal(hasFeedback(), false)
  assert.equal(save.disabled, false)
} else if (scenario === 'cpa-server-token') {
  const original = 'fixture-saved-token'
  const replacement = original + '-replacement'
  await renderConfig({ server: { 'github-token': original } })
  const copy = en.common.configPage
  const field = browser.document.getElementById('config-field-serverGithubToken')!
  const control = field.querySelector('input')!
  const save = button(copy.actions.save)
  assert.equal(control.type, 'password')
  assert.equal(control.value, '')
  assert.equal(control.placeholder, copy.token.keep)
  assert.ok(!field.outerHTML.includes(original))
  assert.equal(save.disabled, true)

  await edit(control, original)
  assert.equal(control.value, original)
  assert.equal(save.disabled, true)
  await edit(control, replacement)
  assert.equal(save.disabled, false)
  await click(button(copy.actions.viewChanges))
  const dialog = browser.document.querySelector('[role="dialog"]')!
  assert.ok(dialog.textContent.includes(copy.token.replacing))
  assert.ok(dialog.textContent.includes('••••••••'))
  assert.ok(!dialog.outerHTML.includes(original))
  await click(button(en.common.close))
  await edit(control, '')
  assert.equal(save.disabled, true)
  await click(button(copy.token.clear))
  assert.equal(control.placeholder, copy.token.pendingClear)
  assert.equal(save.disabled, false)
  await click(button(copy.token.undoClear))
  assert.equal(save.disabled, true)
  assert.equal(control.value, '')

  const limit = browser.document.querySelector<HTMLInputElement>(
    '#config-field-serverMaxRequestBodyBytes input',
  )!
  await edit(limit, '0')
  await click(button(copy.actions.viewChanges))
  const unrelated = browser.document.querySelector('[role="dialog"]')!
  assert.ok(!unrelated.textContent.includes(copy.fields.serverGithubToken.label))
  assert.ok(!unrelated.outerHTML.includes(original))
  await click(button(en.common.close))

  const managementKey = 'fixture-management-replacement'
  const keyInput = browser.document.querySelector<HTMLInputElement>(
    '#config-field-remoteManagementSecretKey input',
  )!
  await edit(keyInput, managementKey)
  await click(button(copy.actions.viewChanges))
  const combined = browser.document.querySelector('[role="dialog"]')!
  assert.ok(combined.textContent.includes(copy.fields.remoteManagementSecretKey.label))
  assert.ok(combined.textContent.includes('••••••••'))
  assert.ok(!combined.outerHTML.includes(managementKey))
} else if (scenario === 'claude-execution-settings') {
  await renderConfig({
    upstream: {
      claude: {
        'header-defaults': {
          'native-entrypoints': ['two\nlines'],
          'anthropic-beta-strip': ['Flag-B', ' flag-A '],
        },
      },
    },
  })
  const copy = en.common.configPage
  const field = (key: string) => browser.document.getElementById('config-field-' + key)!
  const save = button(copy.actions.save)
  const mode = field('upstreamClaudeClientRequestId')
  const modeCopy = copy.fields.upstreamClaudeClientRequestId
  const trigger = mode.querySelector('[role="combobox"]')!
  assert.equal(trigger.textContent.trim(), modeCopy.placeholder)
  assert.equal(field('upstreamClaudeNativeEntrypointsJson').querySelector('textarea'), null)
  assert.equal(
    field('upstreamClaudeInjectDiagnostics')
      .querySelector('[role="switch"]')
      ?.getAttribute('aria-checked'),
    'true',
  )
  assert.equal(save.disabled, true)
  for (const option of Object.values(modeCopy.options)) {
    await select(modeCopy.label, option)
    assert.equal(trigger.textContent.trim(), option)
    assert.equal(save.disabled, false)
  }
  await click(
    [...mode.querySelectorAll('button')].find(
      (node) => node.textContent.trim() === copy.actions.restoreDefault,
    ),
  )
  assert.equal(browser.document.activeElement, trigger)
  assert.equal(save.disabled, true)
  const strip = field('upstreamClaudeAnthropicBetaStripJson').querySelector('textarea')!
  assert.equal(strip.value, 'Flag-B\n flag-A ')
  await edit(strip, '')
  const appendField = field('upstreamClaudeAnthropicBetaAppendJson')
  const append = appendField.querySelector('textarea')!
  await edit(append, 'Flag-Z\nflag-a\nFlag-Z')
  await click(button(copy.actions.viewChanges))
  const diff = browser.document.querySelector('[role="dialog"]')!
  assert.ok(diff.textContent.includes('[]'))
  assert.ok(diff.textContent.indexOf('Flag-Z') < diff.textContent.indexOf('flag-a'))
  await click(button(en.common.close))
  await click(appendField.querySelector('button')!)
  assert.equal(browser.document.activeElement, append)
  assert.equal(append.value, '')
  await edit(strip, 'Flag-B\n flag-A ')
  assert.equal(save.disabled, true)
} else if (scenario === 'codex-execution-settings') {
  await renderConfig({ client: { codex: { 'web-search-result-cache': null } } })
  const copy = en.common.configPage
  const field = (key: string) => browser.document.getElementById('config-field-' + key)!
  const save = button(copy.actions.save)
  const cache = field('clientCodexWebSearchCacheEnabled')
  const toggle = cache.querySelector('[role="switch"]')!
  assert.equal(toggle.getAttribute('aria-checked'), 'false')
  assert.equal(
    field('upstreamCodexWebsocketCompression')
      .querySelector('[role="switch"]')
      ?.getAttribute('aria-checked'),
    'true',
  )
  assert.equal(save.disabled, true)
  await click(toggle)
  await click(toggle)
  assert.equal(toggle.getAttribute('aria-checked'), 'false')
  assert.equal(save.disabled, false)
  await click(button(copy.actions.viewChanges))
  const diff = browser.document.querySelector('[role="dialog"]')!
  assert.ok(diff.textContent.includes(copy.nullableBoolean.defaultOff))
  assert.ok(diff.textContent.includes(copy.nullableBoolean.disabled))
  await click(button(en.common.close))
  await click(button(copy.actions.restoreDefault))
  assert.equal(save.disabled, true)

  const ttl = field('clientCodexWebSearchCacheTtl').querySelector('input')!
  const limit = field('clientCodexWebSearchCacheLimit').querySelector('input')!
  await React.act(async () => ttl.focus())
  await edit(ttl, '1h3')
  assert.equal(ttl.getAttribute('aria-invalid'), null)
  assert.equal(save.disabled, true)
  await React.act(async () => ttl.blur())
  assert.equal(ttl.getAttribute('aria-invalid'), 'true')
  assert.ok(
    field('clientCodexWebSearchCacheTtl').textContent.includes(
      copy.fields.clientCodexWebSearchCacheTtl.invalid,
    ),
  )
  await edit(ttl, '+01800')
  assert.equal(save.disabled, false)
  await click(button(copy.actions.viewChanges))
  const seconds = browser.document.querySelector('[role="dialog"]')!
  assert.ok(seconds.textContent.includes('1800'))
  assert.ok(!seconds.textContent.includes('+01800'))
  await click(button(en.common.close))
  await edit(ttl, '1h30m')
  assert.equal(save.disabled, false)
  await edit(limit, '-1')
  await React.act(async () => {
    limit.focus()
    limit.blur()
  })
  assert.equal(limit.getAttribute('aria-invalid'), 'true')
  await edit(limit, '0')
  assert.equal(save.disabled, false)
  await click(field('clientCodexWebSearchCacheLimit').querySelector('button')!)
  await click(field('clientCodexWebSearchCacheTtl').querySelector('button')!)
  assert.equal(browser.document.activeElement, ttl)
  assert.equal(save.disabled, true)
} else if (scenario === 'oauth-refresh-concurrency') {
  await renderConfig({ 'config-version': 8 })
  const field = browser.document.getElementById('config-field-oauthAutoRefreshWorkers')!
  const control = field.querySelector('input')!
  const copy = en.common.configPage
  const save = button(copy.actions.save)
  assert.equal(control.value, '')
  await React.act(async () => control.focus())
  await edit(control, 'null')
  assert.equal(button(copy.actions.viewChanges).disabled, false)
  assert.equal(save.disabled, true)
  await edit(control, '-')
  assert.equal(save.disabled, true)
  assert.ok(!field.textContent.includes(copy.validation.optionalInteger))
  await React.act(async () => control.blur())
  assert.equal(control.getAttribute('aria-invalid'), 'true')
  assert.ok(field.textContent.includes(copy.validation.optionalInteger))
  await React.act(async () => control.focus())
  for (const invalid of ['2.5', '1e2', '9007199254740993']) {
    await edit(control, invalid)
    assert.equal(save.disabled, true)
    assert.equal(control.value, invalid)
  }
  await edit(control, '-2')
  assert.equal(control.getAttribute('aria-invalid'), null)
  assert.equal(save.disabled, false)
  await click(field.querySelector('button')!)
  assert.equal(browser.document.activeElement, control)
  assert.equal(control.value, '')
  assert.equal(field.querySelector('button'), null)
  assert.equal(save.disabled, true)
  await edit(control, '0')
  assert.equal(save.disabled, false)
} else if (scenario === 'plugin-loading') {
  await render(pluginForm())
  assert.ok(button(en.common.pluginPage.config.save).disabled)
  assert.ok(browser.document.querySelector('[role="status"]'))
  await submit()
  assert.equal(saved.length, 0)
  await loadPlugin({ enabled: true })
  assert.equal(button(en.common.pluginPage.config.save).disabled, false)
  await submit()
  assert.equal(saved.length, 1)
} else if (scenario === 'plugin-retry') {
  await render(pluginForm())
  await respond('/plugins', { plugins: [] })
  await respond('/config/plugins/configs/fixture', null, true)
  assert.ok(button(en.common.pluginPage.config.save).disabled)
  assert.match(browser.document.body.textContent, /Fixture connection failed/)
  await click(button(en.common.pluginPage.actions.refresh))
  await loadPlugin({ enabled: true })
  assert.equal(button(en.common.pluginPage.config.save).disabled, false)
} else if (scenario === 'plugin-roundtrip') {
  await render(pluginForm())
  const params = {
    numericString: '123',
    booleanString: 'true',
    nullString: 'null',
    jsonString: '{"key":1}',
    whitespace: '  ',
    paddedString: '  value  ',
    empty: '',
    nil: null,
    items: [1, '2'],
    object: { nested: true },
    flag: false,
  }
  await loadPlugin({ enabled: true, ...params }, [
    { name: 'defaultFlag', type: 'boolean' },
    { name: 'flag', type: 'boolean' },
    { name: 'empty', type: 'string' },
    { name: 'whitespace', type: 'string' },
    { name: 'defaultMode', type: 'enum', enum_values: ['fast', 'safe'] },
  ])
  await submit()
  assert.deepEqual(saved[0].params, params)
  assert.deepEqual(saved[0].removedKeys, [])
} else if (scenario === 'plugin-restore-defaults') {
  await render(pluginForm())
  await loadPlugin({ enabled: true, flag: false, mode: 'fast' }, [
    { name: 'flag', type: 'boolean' },
    { name: 'mode', type: 'enum', enum_values: ['fast', 'safe'] },
  ])
  await select('flag', en.common.pluginPage.config.useDefault)
  await select('mode', en.common.pluginPage.config.useDefault)
  await submit()
  assert.deepEqual(saved[0].params, {})
  assert.deepEqual(saved[0].removedKeys, ['flag', 'mode'])
} else if (scenario === 'plugin-reopen') {
  await render(pluginForm())
  await loadPlugin({ enabled: true, priority: 1 })
  await edit(input('0'), '7')
  await render(pluginForm(false))
  await render(pluginForm())
  assert.ok(button(en.common.pluginPage.config.save).disabled)
  await loadPlugin({ enabled: true, priority: 42 })
  assert.equal(input('0').value, '42')
  await submit()
  assert.equal(saved[0].priority, 42)
} else if (scenario === 'plugin-background-read') {
  await render(pluginForm())
  await loadPlugin({ enabled: true, priority: 1, original: '123' })
  await edit(input('0'), '7')
  await React.act(async () =>
    client.setQueryData(
      ['management-plugin-config', 'http://forms.test', 'forms-session', 'fixture'],
      { config: { enabled: false, priority: 99, original: '456' }, fields: [] },
    ),
  )
  assert.equal(input('0').value, '7')
  await submit()
  assert.equal(saved[0].priority, 7)
  assert.equal(saved[0].params.original, '123')
} else if (scenario === 'plugin-param-validation') {
  await render(pluginForm())
  await loadPlugin({ enabled: true, items: [] }, [{ name: 'items', type: 'array' }])
  const field = [...browser.document.querySelectorAll('label')]
    .find((node) => node.textContent.includes('items'))!
    .querySelector('input')!
  await edit(field, '{}')
  await submit()
  assert.equal(saved.length, 0)
  assert.match(browser.document.body.textContent, /Parameter items has an invalid value/)
  await edit(field, '[1,2]')
  await submit()
  assert.deepEqual(saved[0].params.items, [1, 2])
} else if (scenario === 'credential-loading-and-background-read') {
  await render(credentialForm())
  assert.equal(browser.document.querySelector('form'), null)
  await respond('/credentials/download', { headers: { 'X-Original': 'old' }, weight: 10 })
  assert.equal(input('X-Custom-Header').value, 'X-Original')
  await click(button(en.common.credentialsPage.form.addHeader))
  const names = [...browser.document.querySelectorAll('input[placeholder="X-Custom-Header"]')]
  const values = [...browser.document.querySelectorAll('input[placeholder="value"]')]
  await edit(names[1], 'X-New')
  await edit(values[1], 'new')
  await React.act(async () =>
    client.setQueryData(
      ['management-credential-raw-metadata', 'http://forms.test', 'forms-session', 'A'],
      { headers: { 'X-Original': 'old', 'X-Remote': 'remote' }, weight: 20 },
    ),
  )
  await submit()
  assert.deepEqual(saved[0], { headers: { 'X-New': 'new' } })
  await submit()
  assert.equal(saved.length, 1)
  await click(button(en.common.credentialsPage.form.addHeader))
  await submit()
  assert.equal(saved.length, 1)
  await edit(input('X-Custom-Header'), 'X-Renamed')
  await submit()
  assert.deepEqual(saved[1], { headers: { 'X-Original': '', 'X-Renamed': 'old' } })
  await submit()
  assert.equal(saved.length, 2)
} else if (scenario === 'credential-retry') {
  await render(credentialForm())
  await respond('/credentials/download', [], false)
  assert.equal(browser.document.querySelector('form'), null)
  assert.match(browser.document.body.textContent, /metadata must be a JSON object/)
  await click(button(en.common.credentialsPage.error.retry))
  await respond('/credentials/download', {})
  assert.ok(browser.document.querySelector('form'))
} else if (scenario === 'credential-selector-validation') {
  await render(credentialForm())
  await respond('/credentials/download', {})
  await click(button(en.common.credentialsPage.form.addCustomField))
  await edit(input('custom.team'), 'id')
  await edit(input(en.common.credentialsPage.form.customFieldValuePlaceholder), 'B')
  await submit()
  assert.equal(saved.length, 0)
  assert.ok(
    browser.document.body.textContent.includes(en.common.credentialsPage.form.customFieldsInvalid),
  )
} else if (scenario.startsWith('provider-')) {
  axios.defaults.adapter = async (config) => ({
    data: config.url?.endsWith('/openai-compatibility')
      ? [
          {
            name: 'fixture',
            'base-url': 'https://example.test/v1',
            keys: [{ id: 'A', 'api-key': 'fake-A' }],
            models: [{ name: 'custom-model', thinking: { levels: ['custom-level'] } }],
            'request-scoped-errors': [
              {
                status: 429,
                action: 'continue-and-cooldown',
                match: ['old'],
                'match-regexr': ['old'],
              },
            ],
          },
        ]
      : [],
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  const snapshot = await fetchProviderSnapshot(
    { baseUrl: 'http://forms.test', managementKey: 'synthetic-key' },
    'home-cluster',
  )
  const descriptor = snapshot.groups.find((group) => group.id === 'openaiCompatibility')!
  await render(
    React.createElement(ProviderFormPanel, {
      descriptor,
      resource: descriptor.resources[0],
      mode: 'edit',
      mutating: false,
      onCancel: () => {},
      onCreate: async (value) => {
        saved.push(value)
      },
      onUpdate: async (value) => {
        saved.push(value)
      },
      onToggleStatus: async () => {},
      onDiscoverModels: async () => [],
      onTestModel: async () => {},
    }),
  )
  if (scenario === 'provider-remove-last-key') {
    await click(button(en.common.providersPage.form.removeApiKeyEntry))
    await submit()
    assert.deepEqual(saved[0].apiKeyEntries, [])
  } else if (scenario === 'provider-multiline-rule') {
    const trigger = [...browser.document.querySelectorAll('button')].find((node) =>
      node.textContent.includes(en.common.providersPage.form.requestScopedErrorsSection),
    )!
    await click(trigger)
    const text = browser.document.querySelector('textarea[placeholder="invalid request"]')!
    const regex = browser.document.querySelector('textarea[placeholder="rate.*limit"]')!
    await edit(text, 'first ')
    assert.equal(text.value, 'first ')
    await edit(text, 'first value\n')
    assert.equal(text.value, 'first value\n')
    await edit(text, 'first value\nsecond value')
    await edit(regex, 'rate .* limit\n')
    assert.equal(regex.value, 'rate .* limit\n')
    await submit()
    assert.deepEqual(saved[0].requestScopedErrors[0].match, ['first value', 'second value'])
  } else if (scenario === 'provider-thinking-level') {
    const trigger = [...browser.document.querySelectorAll('button')].find((node) =>
      node.textContent.includes(en.common.providersPage.form.modelsSection),
    )!
    await click(trigger)
    const low = [...browser.document.querySelectorAll('label')].find(
      (node) => node.textContent.trim() === 'low',
    )!
    await click(low.querySelector('[role="checkbox"]'))
    await submit()
    assert.deepEqual(saved[0].models[0].thinkingLevels, ['custom-level', 'low'])
  } else throw new Error(`Unknown scenario: ${scenario}`)
} else throw new Error(`Unknown scenario: ${scenario}`)

assert.deepEqual(uncaught, [])
await React.act(async () => root.unmount())
client.clear()
await browser.happyDOM.close()
console.log(`Passed: ${scenario}`)
