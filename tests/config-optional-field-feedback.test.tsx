import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { expect, spyOn, test } from 'bun:test'
import { type HTMLElement, Window } from 'happy-dom'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfigWorkbenchPage } from '@/features/config/config-workbench-page'
import * as workbench from '@/features/config/use-config-workbench'
import { type ConfigFieldKey, normalizeConfigValues } from '@/lib/api/management/config'
import { en } from '@/lib/i18n/locales/en'

type RenderField = (key: ConfigFieldKey, config: Record<string, unknown>) => HTMLElement

async function withConfigWorkbench(check: (renderField: RenderField) => void) {
  const i18n = createInstance()
  await i18n.init({ resources: { en }, lng: 'en', defaultNS: 'common' })
  const client = new QueryClient()
  const browser = new Window()
  const original = workbench.useConfigWorkbench
  let rawConfig: Record<string, unknown> = { 'config-version': 8 }
  const hook = spyOn(workbench, 'useConfigWorkbench').mockImplementation((channel) => ({
    ...original(channel),
    connected: true,
    isPending: false,
    snapshot: {
      fetchedAt: '2026-01-01T00:00:00Z',
      rawConfig,
      structured: normalizeConfigValues(rawConfig),
    },
  }))
  const page = (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <ConfigWorkbenchPage />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
  const renderField: RenderField = (key, config) => {
    rawConfig = { 'config-version': 8, ...config }
    browser.document.body.innerHTML = renderToStaticMarkup(page)
    const field = browser.document.getElementById(`config-field-${key}`)
    if (!field) throw new Error(`Missing configuration field ${key}`)
    return field
  }
  try {
    check(renderField)
  } finally {
    hook.mockRestore()
    client.clear()
    await browser.happyDOM.close()
  }
}

test('an omitted optional switch has the same initial UI as its reported default', () =>
  withConfigWorkbench((renderField) => {
    const key = 'upstreamCodexResponseSteering'
    const initial = renderField(key, {})
    expect(initial.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false')
    const explicit = renderField(key, { upstream: { codex: { 'response-steering': false } } })
    expect(explicit.outerHTML).toBe(initial.outerHTML)
  }))

test.each([
  [
    'sessionAffinitySubagents',
    (value: boolean | null) => ({ routing: { 'session-affinity-subagents': value } }),
  ],
  [
    'discoveryAuthRequired',
    (value: boolean | null) => ({ server: { discovery: { 'auth-required': value } } }),
  ],
] as const)('%s uses one default-on switch and only explicit values offer a reset', (key, config) =>
  withConfigWorkbench((renderField) => {
    for (const value of [undefined, null, false, true]) {
      const field = renderField(key, value === undefined ? {} : config(value))
      const switches = field.querySelectorAll('[role="switch"]')
      expect(switches).toHaveLength(1)
      const toggle = switches[0]
      expect(toggle.getAttribute('aria-checked')).toBe(String(value ?? true))
      expect(toggle.getAttribute('aria-label')).toBe(en.common.configPage.fields[key].label)
      expect(toggle.getAttribute('aria-describedby')).toBe(`config-field-${key}-description`)
      expect(field.querySelector('[role="combobox"]')).toBeNull()
      const reset = [...field.querySelectorAll('button')].filter((button) => button !== toggle)
      expect(reset.map((button) => button.textContent)).toEqual(
        value == null ? [] : ['Restore default'],
      )
    }
  }),
)

test('a stored management advertisement flag does not expose a switch for management endpoints', () =>
  withConfigWorkbench((renderField) => {
    const field = renderField('discoveryAuthRequired', {
      server: { discovery: { 'advertise-management': true } },
    })
    const section = field.closest('section')
    expect(section?.textContent).toContain(en.common.configPage.sections.discovery.description)
    expect(section?.querySelector('#config-field-discoveryAdvertiseManagement')).toBeNull()
    expect(field.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true')
  }))

test('session rebinding shows the effective policy and explains the selected behavior', () =>
  withConfigWorkbench((renderField) => {
    const copy = en.common.configPage.fields.sessionAffinityRebindOn
    for (const [raw, label, description] of [
      [undefined, copy.options.any, copy.description_any],
      [null, copy.options.any, copy.description_any],
      ['  ', copy.options.any, copy.description_any],
      ['any', copy.options.any, copy.description_any],
      [' QuOtA ', copy.options.quota, copy.description_quota],
      ['never', copy.options.never, copy.description_never],
      ['future-mode', 'future-mode', copy.description],
    ] as const) {
      const field = renderField('sessionAffinityRebindOn', {
        routing: {
          'session-affinity': false,
          ...(raw === undefined ? {} : { 'session-affinity-rebind-on': raw }),
        },
      })
      const select = field.querySelector('[role="combobox"]')
      expect(select?.textContent).toBe(label)
      expect(select?.hasAttribute('disabled')).toBe(false)
      expect(select?.getAttribute('aria-label')).toBe(copy.label)
      expect(field.querySelector('#' + select?.getAttribute('aria-describedby'))?.textContent).toBe(
        description,
      )
    }
  }))
