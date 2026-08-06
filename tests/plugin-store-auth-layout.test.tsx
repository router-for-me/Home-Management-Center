import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { Sheet } from '@/components/ui/sheet'
import {
  PluginStoreAuthEditor,
  PluginStoreAuthHeader,
} from '@/features/plugins/plugin-store-auth-sheet'
import { en } from '@/lib/i18n/locales/en'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    resources: { en },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
})

function renderEditor() {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <Sheet open>
        <PluginStoreAuthHeader editorTarget="new" saving={false} onBack={() => undefined} />
        <PluginStoreAuthEditor
          target="new"
          saving={false}
          onCancel={() => undefined}
          onSave={async () => undefined}
        />
      </Sheet>
    </I18nextProvider>,
  )
}

function getSlotClassName(markup: string, slot: string) {
  return markup.match(new RegExp(`data-slot="${slot}" class="([^"]+)"`))?.[1] ?? ''
}

describe('plugin store authentication editor layout', () => {
  test('places secondary navigation in the drawer header', () => {
    const markup = renderEditor()
    const headerIndex = markup.indexOf('data-slot="sheet-header"')
    const backButtonIndex = markup.indexOf('data-slot="drawer-scaffold-back-button"')
    const contentIndex = markup.indexOf('data-slot="plugin-auth-editor-content"')

    expect(headerIndex).toBeGreaterThanOrEqual(0)
    expect(backButtonIndex).toBeGreaterThan(headerIndex)
    expect(backButtonIndex).toBeLessThan(contentIndex)
    expect(markup).toContain('aria-label="Back to rules"')
    expect(markup).toContain('lucide-chevron-left')
    expect(markup).not.toContain('lucide-arrow-left')
    expect(markup).not.toContain(
      'Define the request prefix, request kinds, and authentication method.',
    )
  })

  test('keeps form rows intrinsic and aligns authentication controls', () => {
    const markup = renderEditor()
    const contentClassName = getSlotClassName(markup, 'plugin-auth-editor-content')
    const enabledControlClassName = getSlotClassName(markup, 'plugin-auth-enabled-control')
    const applyToControlClassName = getSlotClassName(markup, 'plugin-auth-apply-to-control')

    expect(contentClassName).toContain('content-start')
    expect(contentClassName).toContain('gap-4')
    expect(contentClassName).toContain('overflow-y-auto')
    expect(markup).toContain('for="plugin-auth-type"')
    expect(markup).toContain('id="plugin-auth-type"')
    expect(markup).toContain('for="plugin-auth-enabled"')
    expect(markup).toContain('id="plugin-auth-enabled"')
    expect(markup).not.toContain('plugin-auth-enabled-help')
    expect(markup).not.toContain('Disabled rules remain stored but are not applied.')
    expect(enabledControlClassName).toContain('control-lg')
    expect(enabledControlClassName).toContain('items-center')
    expect(enabledControlClassName).toContain('justify-between')
    expect(applyToControlClassName).toContain('mt-1.5')
    expect(applyToControlClassName).toContain('gap-1.5')
    expect(markup).not.toContain('flex min-h-9 items-center justify-between')
  })
})
