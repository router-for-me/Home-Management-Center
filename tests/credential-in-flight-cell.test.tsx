import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { TooltipProvider } from '@/components/ui/tooltip'
import {
  type CredentialInFlightAvailability,
  CredentialInFlightCell,
} from '@/features/credentials/credential-in-flight-cell'
import {
  type CredentialInFlightSummary,
  normalizeCredentialResource,
} from '@/lib/api/management/credentials'
import { en } from '@/lib/i18n/locales/en'

const i18n = createInstance()
const copy = en.common.credentialsPage.concurrency
const resource = normalizeCredentialResource({ id: 'test', provider: 'codex', max_in_flight: 6 }, 0)
const available: CredentialInFlightAvailability = {
  available: true,
  pending: false,
  stale: false,
  errorMessage: null,
}

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { en }, lng: 'en', defaultNS: 'common' })
})

function snapshot(count: number): CredentialInFlightSummary {
  return {
    credentialId: 'test',
    observedInFlight: count,
    admittedInFlight: null,
    maxInFlight: null,
    remaining: null,
    totalSaturated: false,
    saturatedModelCount: 0,
    models: [],
    policyVersion: null,
    effectiveAt: null,
    observationBarrierRevision: null,
    fullyEnforced: 'unknown',
    observed: {
      inFlight: count,
      accounted: 0,
      unaccounted: count,
      stale: false,
      coverageComplete: true,
      aggregatesComplete: true,
      detailsTruncated: false,
    },
  }
}

function render(summary: CredentialInFlightSummary | null, availability = available) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <CredentialInFlightCell
          resource={resource}
          summary={summary}
          availability={availability}
          onInspect={() => undefined}
        />
      </TooltipProvider>
    </I18nextProvider>,
  )
}

describe('credential in-flight cell states', () => {
  test('keeps a failed first snapshot distinct from zero', () => {
    const markup = render(null, { ...available, errorMessage: 'Unavailable' })
    expect(markup).toContain(copy.cellUnavailable)
    expect(markup).not.toContain('0/6')
  })

  test('keeps an absent snapshot distinct from zero', () => {
    const markup = render(null)
    expect(markup).toContain(copy.cellUnknown)
    expect(markup).not.toContain('0/6')
  })

  test('shows a loading state before the first snapshot', () => {
    const markup = render(null, { ...available, pending: true })
    expect(markup).toContain(copy.cellLoading)
    expect(markup).not.toContain('0/6')
  })

  test('does not advertise an inspection action on an unsupported backend', () => {
    const markup = render(null, { ...available, available: false })
    expect(markup).toContain(copy.cellUnsupported)
    expect(markup).not.toContain('<button')
  })

  test('shows an observed zero as a real count', () => {
    const markup = render(snapshot(0))
    expect(markup).toContain('0/6')
    expect(markup).not.toContain(copy.cellUnknown)
  })

  test('labels retained counts when a refresh fails', () => {
    const markup = render(snapshot(3), { ...available, errorMessage: 'Unavailable', stale: true })
    expect(markup).toContain('3/6')
    expect(markup).toContain(copy.cellStale)
  })

  test('labels incomplete server observations instead of presenting them as current totals', () => {
    const summary = snapshot(3)
    summary.observed!.coverageComplete = false
    expect(render(summary)).toContain(copy.cellStale)
  })
})
