import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { expect, spyOn, test } from 'bun:test'
import { Window } from 'happy-dom'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfigWorkbenchPage } from '@/features/config/config-workbench-page'
import * as workbench from '@/features/config/use-config-workbench'
import { normalizeConfigValues } from '@/lib/api/management/config'
import { en } from '@/lib/i18n/locales/en'

test('an omitted optional switch has the same initial UI as its reported default', async () => {
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
  function renderSwitch() {
    browser.document.body.innerHTML = renderToStaticMarkup(page)
    const field = browser.document.getElementById('config-field-upstreamCodexResponseSteering')
    expect(field?.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false')
    return field!.outerHTML
  }
  try {
    const initial = renderSwitch()
    rawConfig = { ...rawConfig, upstream: { codex: { 'response-steering': false } } }
    expect(renderSwitch()).toBe(initial)
  } finally {
    hook.mockRestore()
    client.clear()
    await browser.happyDOM.close()
  }
})
