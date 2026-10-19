import { Window } from 'happy-dom'
import assert from 'node:assert/strict'

import type { AccessKeyFormInput } from '../../src/lib/api/management/access-keys'
import type { UserResource } from '../../src/lib/api/management/users'

// Radix detects DOM support on import; each scenario runs in its own process.
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
  'HTMLSelectElement',
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
const { default: axios, AxiosError } = await import('axios')
const { zhCN } = await import('../../src/lib/i18n/locales/zh-CN')
const { AccessKeyForm } = await import('../../src/features/users/users-workbench-page')
const { normalizeAccessKey, updateAccessKeyBindings } =
  await import('../../src/lib/api/management/access-keys')
const { defaultUserPeriodTimezone } = await import('../../src/lib/api/management/users')
const { Sheet, SheetContent, SheetTitle } = await import('../../src/components/ui/sheet')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  resources: { 'zh-CN': zhCN },
  lng: 'zh-CN',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

const owner: UserResource = {
  id: '2',
  numericId: 2,
  username: 'meina',
  hasPassword: true,
  credits: 100,
  creditsUnlimited: false,
  periodLimits: {
    supported: true,
    creditsUnlimited: false,
    timezone: defaultUserPeriodTimezone,
    windows: {
      '5h': { limit: null, mode: 'first_use' },
      '1d': { limit: null, mode: 'first_use' },
      '7d': { limit: null, mode: 'first_use' },
      '30d': { limit: null, mode: 'first_use' },
    },
    weekResetDay: 1,
    weekResetHour: 0,
  },
  periodLimitsSummary: null,
  mfaConfigured: false,
  passkeyCount: 0,
  deletedAt: null,
  createdAt: null,
  updatedAt: null,
  raw: {},
}
const otherOwner: UserResource = { ...owner, id: '3', numericId: 3, username: 'other' }
const scenario = process.argv[2]
const ownerDeleted = scenario.startsWith('deleted-owner') || scenario === 'missing-owner'
let users = [owner, otherOwner]
if (scenario.startsWith('deleted-owner')) {
  users = [{ ...owner, deletedAt: '2026-10-19T00:00:00Z' }, otherOwner]
} else if (scenario === 'missing-owner' || scenario === 'delayed-users') {
  users = [otherOwner]
}

let resource = normalizeAccessKey(
  { id: 1, api_key: 'sk-bound-key-value-123456', user_id: 2, channels: [], model_groups: [10] },
  0,
)
let storedOwner = resource.userId
const submitted: AccessKeyFormInput[] = []
const requests: Record<string, unknown>[] = []
axios.defaults.adapter = async (config) => {
  assert.equal(config.method, 'patch')
  assert.equal(config.url, '/access/api-keys')
  const body = JSON.parse(config.data)
  requests.push(body)
  if (ownerDeleted && body.user_id === 2) {
    throw new AxiosError('user_not_found', undefined, config, undefined, {
      config,
      data: { error: 'user_not_found' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
    })
  }
  if ('user_id' in body) storedOwner = body.user_id === 0 ? null : body.user_id
  return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
}

const container = browser.document.createElement('div')
browser.document.body.append(container)
const root = createRoot(container as unknown as HTMLElement)
const render = async () => {
  await React.act(async () =>
    root.render(
      <React.StrictMode>
        <I18nextProvider i18n={i18n}>
          <Sheet open>
            <SheetContent aria-describedby={undefined}>
              <SheetTitle>Edit</SheetTitle>
              <AccessKeyForm
                mode="edit"
                accessKey={resource}
                users={users}
                channelGroups={[]}
                modelGroups={[]}
                mutating={false}
                onCancel={() => {}}
                onSubmit={async (input) => {
                  await updateAccessKeyBindings(
                    { baseUrl: 'http://management.test', managementKey: 'fixture-key' },
                    resource,
                    input,
                  )
                  submitted.push(input)
                }}
              />
            </SheetContent>
          </Sheet>
        </I18nextProvider>
      </React.StrictMode>,
    ),
  )
}
function trigger() {
  const element = browser.document.querySelector('[data-slot="select-trigger"]')
  assert.ok(element)
  return element
}
async function selectOwner(label: string) {
  await React.act(async () =>
    trigger().dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  )
  const option = [...browser.document.querySelectorAll('[role="option"]')].find(
    (element) => element.textContent.trim() === label,
  )
  assert.ok(option, `Missing owner option: ${label}`)
  await React.act(async () =>
    option.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
  )
}

try {
  // Opening edit directly reproduces #202; mounting create first hides the race.
  await render()
  const initiallyMissing = scenario === 'missing-owner' || scenario === 'delayed-users'
  assert.equal(trigger().textContent.trim(), initiallyMissing ? '#2' : 'meina')

  if (ownerDeleted || initiallyMissing) {
    const hintId = trigger().getAttribute('aria-describedby')
    assert.ok(hintId, 'Unavailable owners must have an explanation')
    assert.equal(
      browser.document.getElementById(hintId)?.textContent,
      i18n.t('usersPage.keys.ownerUnavailableHint'),
    )
  }

  let expectedOwner: number | null = 2
  let expectedPatch: Record<string, number> = {}
  if (scenario === 'change-owner' || scenario === 'deleted-owner-reassign') {
    await selectOwner('other')
    assert.equal(trigger().textContent.trim(), 'other')
    assert.equal(trigger().getAttribute('aria-describedby'), null)
    expectedOwner = 3
    expectedPatch = { user_id: 3 }
  } else if (scenario === 'unassign-owner' || scenario === 'deleted-owner-unassign') {
    await selectOwner(i18n.t('usersPage.keys.unassigned'))
    assert.equal(trigger().textContent.trim(), i18n.t('usersPage.keys.unassigned'))
    assert.equal(trigger().getAttribute('aria-describedby'), null)
    expectedOwner = null
    expectedPatch = { user_id: 0 }
  } else if (scenario === 'delayed-users') {
    users = [owner, otherOwner]
    await render()
    assert.equal(trigger().textContent.trim(), 'meina')
    assert.equal(trigger().getAttribute('aria-describedby'), null)
  } else if (scenario === 'empty-native-change') {
    await React.act(async () => {
      const native = browser.document.querySelector('select')
      assert.ok(native)
      native.value = ''
      native.dispatchEvent(new browser.Event('change', { bubbles: true }))
    })
    assert.equal(trigger().textContent.trim(), 'meina')
  } else if (scenario === 'change-resource') {
    resource = { ...resource, userId: 3 }
    storedOwner = 3
    expectedOwner = 3
    await render()
    assert.equal(trigger().textContent.trim(), 'other')
  }

  const form = browser.document.querySelector('form')
  assert.ok(form)
  await React.act(async () =>
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })),
  )

  assert.deepEqual(submitted, [
    {
      value: resource.value,
      userId: expectedOwner,
      channelGroupIds: [],
      modelGroupIds: [10],
    },
  ])
  assert.deepEqual(requests, [{ id: 1, channels: [], model_groups: [10], ...expectedPatch }])
  assert.equal(storedOwner, expectedOwner)
} finally {
  await React.act(async () => root.unmount())
  await browser.happyDOM.close()
}
