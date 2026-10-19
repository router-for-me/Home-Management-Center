import { describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { spawnSync } from 'node:child_process'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { AccessKeyForm } from '../src/features/users/users-workbench-page'
import { normalizeAccessKey } from '../src/lib/api/management/access-keys'
import { type UserResource, defaultUserPeriodTimezone } from '../src/lib/api/management/users'
import { zhCN } from '../src/lib/i18n/locales/zh-CN'

async function createTestI18n() {
  const i18n = createInstance()
  await i18n.use(initReactI18next).init({
    resources: { 'zh-CN': zhCN },
    lng: 'zh-CN',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
  return i18n
}

const mockUsers: UserResource[] = [
  {
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
  },
]

describe('Issue #202 access key edit owner binding', () => {
  test('normalizeAccessKey treats user_id 0 as unassigned null and positive user_id as bound', () => {
    const unassigned = normalizeAccessKey({ id: 1, api_key: 'sk-test-1', user_id: 0 }, 0)
    expect(unassigned.userId).toBeNull()

    const bound = normalizeAccessKey({ id: 2, api_key: 'sk-test-2', user_id: 2 }, 1)
    expect(bound.userId).toBe(2)
  })

  test('renders the bound owner on initial render in edit mode', async () => {
    const i18n = await createTestI18n()
    const boundKey = normalizeAccessKey(
      {
        id: 1,
        api_key: 'sk-bound-key-value-123456',
        user_id: 2,
        channels: [],
        model_groups: [10],
      },
      0,
    )

    const markup = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <AccessKeyForm
          mode="edit"
          accessKey={boundKey}
          users={mockUsers}
          channelGroups={[]}
          modelGroups={[]}
          mutating={false}
          onCancel={() => {}}
          onSubmit={async () => {}}
        />
      </I18nextProvider>,
    )

    expect(markup).toContain('sk-bound-key-value-123456')
  })

  test('preserves bound owner across mount, effect updates, and form submit in DOM', () => {
    const script = `
      import { Window } from 'happy-dom'
      import assert from 'node:assert/strict'

      const browser = new Window({ url: 'http://forms.test' })
      for (const key of [
        'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node',
        'MutationObserver', 'ResizeObserver', 'CustomEvent', 'Event',
        'DocumentFragment', 'HTMLInputElement', 'HTMLSelectElement',
        'HTMLTextAreaElement', 'NodeFilter', 'HTMLButtonElement',
        'KeyboardEvent', 'MouseEvent'
      ]) {
        Object.defineProperty(globalThis, key, {
          configurable: true,
          writable: true,
          value: key === 'window' ? browser : browser[key],
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
      const { zhCN } = await import('./src/lib/i18n/locales/zh-CN')
      const { AccessKeyForm } = await import('./src/features/users/users-workbench-page')
      const { normalizeAccessKey } = await import('./src/lib/api/management/access-keys')
      const { defaultUserPeriodTimezone } = await import('./src/lib/api/management/users')
      const { Sheet, SheetContent, SheetTitle } = await import('./src/components/ui/sheet')

      const i18n = createInstance()
      await i18n.use(initReactI18next).init({
        resources: { 'zh-CN': zhCN },
        lng: 'zh-CN',
        defaultNS: 'common',
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
      })

      const users = [{
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
      }]

      const boundKey = normalizeAccessKey({
        id: 1,
        api_key: 'sk-bound-key-value-123456',
        user_id: 2,
        channels: [],
        model_groups: [10],
      }, 0)

      let submitted = null
      const container = browser.document.createElement('div')
      browser.document.body.append(container)
      const root = createRoot(container)

      // First render in create mode, then switch to edit mode to exercise the useEffect + SelectBubbleInput path
      await React.act(async () => {
        root.render(
          React.createElement(I18nextProvider, { i18n },
            React.createElement(Sheet, { open: true },
              React.createElement(SheetContent, null,
                React.createElement(SheetTitle, null, 'Edit'),
                React.createElement(AccessKeyForm, {
                  mode: 'create',
                  accessKey: null,
                  users,
                  channelGroups: [],
                  modelGroups: [],
                  mutating: false,
                  onCancel: () => {},
                  onSubmit: async (input) => { submitted = input },
                })
              )
            )
          )
        )
      })

      await React.act(async () => {
        root.render(
          React.createElement(I18nextProvider, { i18n },
            React.createElement(Sheet, { open: true },
              React.createElement(SheetContent, null,
                React.createElement(SheetTitle, null, 'Edit'),
                React.createElement(AccessKeyForm, {
                  mode: 'edit',
                  accessKey: boundKey,
                  users,
                  channelGroups: [],
                  modelGroups: [],
                  mutating: false,
                  onCancel: () => {},
                  onSubmit: async (input) => { submitted = input },
                })
              )
            )
          )
        )
      })

      const trigger = browser.document.querySelector('[data-slot="select-trigger"]')
      assert.ok(trigger, 'SelectTrigger should be rendered')
      assert.equal(trigger.textContent?.trim(), 'meina')

      const form = browser.document.querySelector('form')
      assert.ok(form, 'form should be rendered')
      await React.act(async () => {
        form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }))
      })

      assert.deepEqual(submitted, {
        value: 'sk-bound-key-value-123456',
        userId: 2,
        channelGroupIds: [],
        modelGroupIds: [10],
      })
    `

    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 10_000,
    })
    expect(result.error, result.stderr).toBeUndefined()
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })
})
