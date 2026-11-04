import { Window } from 'happy-dom'
import assert from 'node:assert/strict'

import type { ProviderEntryFormInput } from '../../src/lib/api/management/providers'

const browser = new Window({ url: 'http://provider-form.test' })
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
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { en } = await import('../../src/lib/i18n/locales/en')
const { zhCN } = await import('../../src/lib/i18n/locales/zh-CN')
const { useSessionStore } = await import('../../src/stores/session-store')
const { useCapabilityStore } = await import('../../src/stores/capability-store')
const axios = (await import('axios')).default
const { ProviderFormPanel } = await import('../../src/features/providers/providers-panel')
const { fetchProviderSnapshot, fetchProviderDiscoveredModels, testProviderConnectivity } =
  await import('../../src/lib/api/management/providers')

const scenario = process.argv[2]
const providerId = scenario === 'claude-connectivity' ? 'claude' : 'codex'
const session = { baseUrl: 'http://provider-form.test', managementKey: 'synthetic-key' }
useSessionStore.setState({ ...session, status: 'connected', connectedAt: 'provider-form' })
useCapabilityStore.setState({ runtimeMode: 'home-standalone', status: 'ready' })
const i18n = createInstance()
await i18n.use(initReactI18next).init({
  resources: { en, 'zh-CN': zhCN },
  lng: scenario === 'detail-i18n' ? 'zh-CN' : 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

const calls: Array<Record<string, any>> = []
const longID = `long-model-${'id'.repeat(80)}`
const longDisplayName = `Display${'WithoutSpaces'.repeat(40)}`
axios.defaults.adapter = async (config) => {
  let data: unknown = []
  if (config.url?.endsWith(`/api-keys/${providerId}`)) {
    data = [
      {
        name: `${providerId}-group`,
        'base-url': 'https://models.test/v1',
        keys: [{ id: `saved-${providerId}`, 'api-key': 'stored-test-key' }],
        models: [
          {
            name: 'existing-model',
            alias: 'manual-alias',
            'display-name': 'Manual Display',
            'force-mapping': true,
          },
        ],
      },
    ]
  } else if (config.url === '/requests/api-call') {
    const body = JSON.parse(config.data as string)
    calls.push(body)
    data = {
      status_code: 200,
      body: JSON.stringify({
        data: [
          { id: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol Preview' },
          { id: 'description-only', description: 'Description remains informational' },
          { id: longID, display_name: longDisplayName },
          { id: 'existing-model', display_name: 'Catalog display' },
        ],
      }),
    }
  }
  return { config, data, status: 200, statusText: 'OK', headers: {} }
}

const snapshot = await fetchProviderSnapshot(session, 'home-standalone')
const descriptor = snapshot.groups.find((group) => group.id === providerId)!
const resource = descriptor.resources[0]
assert.equal(resource.authIndex, `saved-${providerId}`)
let saved: ProviderEntryFormInput | undefined
const container = browser.document.createElement('div')
browser.document.body.append(container)
const root = createRoot(container as any)
await React.act(async () =>
  root.render(
    <I18nextProvider i18n={i18n}>
      <ProviderFormPanel
        mode={scenario === 'detail-i18n' ? 'detail' : 'edit'}
        descriptor={descriptor}
        resource={resource}
        mutating={false}
        onCancel={() => {}}
        onCreate={async (value) => {
          saved = value
        }}
        onUpdate={async (value) => {
          saved = value
        }}
        onToggleStatus={async () => {}}
        onDiscoverModels={(input) => fetchProviderDiscoveredModels(session, input)}
        onTestModel={(input) => testProviderConnectivity(session, input)}
      />
    </I18nextProvider>,
  ),
)

function button(text: string, contains = false) {
  const result = [...browser.document.querySelectorAll('button')].find((node) =>
    contains ? node.textContent.includes(text) : node.textContent.trim() === text,
  )
  assert.ok(result, `Missing button: ${text}`)
  return result
}
async function click(node: any) {
  await React.act(async () => node.click())
}
async function edit(node: any, value: string) {
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(
      node,
      value,
    )
    node.dispatchEvent(new browser.Event('input', { bubbles: true }))
  })
}

if (scenario === 'detail-i18n') {
  await click(button(zhCN.common.providersPage.detail.metadataTitle))
  const labels = [...browser.document.querySelectorAll('dt')].map((node) => node.textContent.trim())
  assert.ok(labels.includes('凭证索引'))
  assert.ok(labels.includes('API Key 条目'))
  assert.ok(browser.document.body.textContent.includes('saved-codex'))
} else {
  await click(button(en.common.providersPage.form.modelsSection, true))
  if (scenario === 'claude-connectivity') {
    await click(button(en.common.providersPage.connectivity.test))
    assert.equal(calls[0].auth_index, 'saved-claude')
    assert.equal(calls[0].header['x-api-key'], '$TOKEN$')
    assert.ok(
      browser.document.body.textContent.includes(en.common.providersPage.connectivity.success),
    )
  } else if (scenario === 'import') {
    assert.ok(
      !browser.document.body.textContent.includes(en.common.providersPage.connectivity.testModel),
    )
    assert.ok(
      browser.document.body.textContent.includes(
        en.common.providersPage.discovery.authStatus.savedCredential,
      ),
    )
    await click(button(en.common.providersPage.discovery.openButton))
    assert.equal(calls[0].auth_index, 'saved-codex')
    assert.equal(calls[0].header.Authorization, 'Bearer $TOKEN$')
    const search = browser.document.querySelector(
      `input[placeholder="${en.common.providersPage.discovery.searchPlaceholder}"]`,
    )!
    await edit(search, 'Sol Preview')
    assert.ok(browser.document.body.textContent.includes('gpt-6.1-sol'))
    assert.ok(!browser.document.body.textContent.includes('description-only'))
    await edit(search, '')
    const selectAll = [...browser.document.querySelectorAll('label')].find(
      (node) => node.textContent.trim() === en.common.providersPage.discovery.selectAll,
    )!
    await click(selectAll.querySelector('[role="checkbox"]'))
    await click(button('Add 3 models'))
    await React.act(async () =>
      browser.document
        .querySelector('form')!
        .dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })),
    )
    assert.ok(saved, browser.document.body.textContent)
    assert.equal(saved.models.length, 4)
    assert.deepEqual(
      saved.models.map(({ name, alias, displayName, forceMapping }) => ({
        name,
        alias,
        displayName,
        forceMapping,
      })),
      [
        {
          name: 'existing-model',
          alias: 'manual-alias',
          displayName: 'Manual Display',
          forceMapping: true,
        },
        { name: 'gpt-6.1-sol', alias: '', displayName: 'GPT-6.1 Sol Preview', forceMapping: false },
        { name: 'description-only', alias: '', displayName: '', forceMapping: false },
        { name: longID, alias: '', displayName: longDisplayName, forceMapping: false },
      ],
    )
  } else {
    throw new Error(`Unknown scenario: ${scenario}`)
  }
}

await React.act(async () => root.unmount())
await browser.happyDOM.close()
console.log(`Passed: ${scenario}`)
