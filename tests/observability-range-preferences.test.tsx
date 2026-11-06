import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { useRequestEventsWorkbench } from '@/features/request-events/use-request-events-workbench'
import { useUsageObservabilityWorkbench } from '@/features/usage-observability/use-usage-observability-workbench'
import { defaultRequestEventFilters } from '@/lib/api/management/request-events'
import { defaultUsageFilters } from '@/lib/api/management/usage'
import { uiPreferenceKeys } from '@/lib/ui-preferences'

const workbenches = [
  {
    name: 'request events',
    key: uiPreferenceKeys.requestEventRange,
    useWorkbench: useRequestEventsWorkbench,
    fallback: defaultRequestEventFilters.range,
  },
  {
    name: 'usage',
    key: uiPreferenceKeys.usageRange,
    useWorkbench: useUsageObservabilityWorkbench,
    fallback: defaultUsageFilters.range,
  },
]

function restoredRange(
  useWorkbench: (typeof workbenches)[number]['useWorkbench'],
  storageKey: string,
  storedValue: unknown,
) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const client = new QueryClient()
  let range = ''

  function Probe() {
    range = useWorkbench().filters.range
    return null
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) =>
          key === storageKey ? JSON.stringify({ version: 1, value: storedValue }) : null,
        setItem: () => undefined,
      },
    },
  })

  try {
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    )
    return range
  } finally {
    client.clear()
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
}

describe('observability range preferences', () => {
  for (const { name, key, useWorkbench, fallback } of workbenches) {
    test(`${name} restores every supported named range`, () => {
      for (const range of ['4h', '12h', '24h', 'today', 'yesterday', '7d', '30d', '90d']) {
        expect(restoredRange(useWorkbench, key, range)).toBe(range)
      }
    })

    test(`${name} rejects unsupported ranges and custom ranges without their boundaries`, () => {
      for (const range of ['all', 'custom', 'removed-range', null]) {
        expect(restoredRange(useWorkbench, key, range)).toBe(fallback)
      }
    })
  }
})
