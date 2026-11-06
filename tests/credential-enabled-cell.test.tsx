import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { TooltipProvider } from '@/components/ui/tooltip'
import { CredentialEnabledCell } from '@/features/credentials/credential-inline-cells'
import {
  type CredentialResource,
  normalizeCredentialResource,
} from '@/lib/api/management/credentials'
import { en } from '@/lib/i18n/locales/en'

const i18n = createInstance()
const copy = en.common.credentialsPage.status
const resource = normalizeCredentialResource(
  { id: 'account', provider: 'codex', label: 'Example account', status: 'active' },
  0,
)

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { en }, lng: 'en', defaultNS: 'common' })
})

function render(overrides: Partial<CredentialResource> = {}) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <CredentialEnabledCell
          resource={{ ...resource, ...overrides }}
          mutating={false}
          onToggleStatus={() => undefined}
          onInspect={() => undefined}
        />
      </TooltipProvider>
    </I18nextProvider>,
  )
}

describe('credential enabled cell', () => {
  test('uses the switch without repeating the healthy state', () => {
    const markup = render()
    expect(markup).toContain('aria-checked="true"')
    expect(markup).not.toContain(copy.active)
    expect(markup).not.toContain('aria-haspopup="dialog"')
  })

  test('shows a disabled switch without repeating disabled or historical error state', () => {
    const markup = render({ disabled: true, status: 'error', unavailable: true })
    expect(markup).toContain('aria-checked="false"')
    expect(markup).not.toContain(copy.disabled)
    expect(markup).not.toContain(copy.unavailable)
    expect(markup).not.toContain(copy.error)
  })

  test('preserves an unavailable indication even when the credential is enabled', () => {
    const markup = render({ unavailable: true })
    expect(markup).toContain('aria-checked="true"')
    expect(markup).toContain(`aria-label="${copy.unavailable}"`)
    expect(markup).toContain('aria-haspopup="dialog"')
  })

  test('keeps recorded errors discoverable independently from the enable switch', () => {
    const markup = render({ status: 'error' })
    expect(markup).toContain('aria-checked="true"')
    expect(markup).toContain(`aria-label="${copy.error}"`)
  })

  test('does not present an unknown runtime status as healthy', () => {
    const markup = render({ status: 'unknown' })
    expect(markup).toContain(`aria-label="${copy.unknown}"`)
    expect(markup).not.toContain(copy.active)
  })
})
