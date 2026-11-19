import { beforeAll, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'

import { TooltipProvider } from '@/components/ui/tooltip'
import { AccessGroupBindingsTable } from '@/features/users/access-group-bindings-table'
import { ScopeModelIdentity } from '@/features/users/scope-binding-identity'
import { groupListLabel } from '@/features/users/users-format'
import type {
  AccessGroupDetailResource,
  AccessGroupResource,
} from '@/lib/api/management/access-groups'
import { en } from '@/lib/i18n/locales/en'

const i18n = createInstance()
beforeAll(async () => {
  await i18n.init({ lng: 'en', defaultNS: 'common', resources: { en } })
})

function binding(id: number, authId: string, name?: string): AccessGroupDetailResource {
  return {
    id: String(id),
    numericId: id,
    groupId: 1,
    kind: 'channel',
    targetId: authId,
    credential: name ? { authId, displayName: name, provider: 'xai', state: null } : null,
    channels: [],
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    raw: {},
  }
}

test('same-named scopes keep their numeric IDs wherever scope names are shown', () => {
  const group: AccessGroupResource = {
    id: '1',
    numericId: 1,
    kind: 'channel',
    name: 'Team',
    disabled: false,
    detailCount: 0,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    raw: {},
  }
  const groups = [
    group,
    { ...group, id: '2', numericId: 2 },
    { ...group, id: '3', numericId: 3, name: 'Unique' },
  ]
  expect(groupListLabel(groups, [2, 3, 1, 4], '')).toBe('Team (#2), Unique, Team (#1), #4')
})

test('only ambiguous or unidentified bindings need a visible credential ID', () => {
  const markup = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <AccessGroupBindingsTable
          kind="channel"
          groupDetails={[
            binding(1, 'unique-id', 'Team'),
            binding(2, 'first-id', 'a***@example.org'),
            binding(3, 'second-id', 'a***@example.org'),
            binding(4, 'missing-id'),
          ]}
          channelGroups={[]}
          channelBindingsSupported={false}
          onDeleteDetail={() => {}}
        />
      </TooltipProvider>
    </I18nextProvider>,
  )
  expect(markup).toContain('>Team<')
  expect(markup).toContain('aria-label="Copy credential ID unique-id"')
  expect(markup).not.toContain('>unique-id<')
  for (const id of ['first-id', 'second-id', 'missing-id']) {
    expect(markup).toContain(`>${id}<`)
  }
  expect(markup).toContain('data-provider-icon="xai"')
  expect(markup).toContain(en.common.usersPage.groups.credentialState.unresolved)
})

test('model labels retain the exact model ID and unknown aliases have a neutral icon', () => {
  const known = renderToStaticMarkup(
    <ScopeModelIdentity modelId="deepseek-chat" displayName="Team chat" />,
  )
  expect(known).toContain('data-provider-icon="deepseek"')
  expect(known).toContain('>Team chat<')
  expect(known).toContain('>deepseek-chat<')
  const alias = renderToStaticMarkup(<ScopeModelIdentity modelId="private-alias" />)
  expect(alias).not.toContain('data-provider-icon')
  expect(alias).toContain('<svg')
  expect(alias).toContain('>private-alias<')
})

test.each([
  ['muse-wonder-full-1.0-contributor', 'Muse Wonder Full 1.0 Contributor', 'muse'],
  ['muse-spark-1.3-contributor', 'Muse Spark 1.3 Contributor', 'muse'],
  ['imagen-3.0-fast-generate-001', 'Imagen 3.0 Fast Generate', 'gemini'],
])('the picker and saved binding use the same artwork for %s', (modelId, name, brand) => {
  for (const displayName of [name, undefined]) {
    const markup = renderToStaticMarkup(
      <ScopeModelIdentity modelId={modelId} displayName={displayName} />,
    )
    expect(markup).toContain(`data-provider-icon="${brand}"`)
    expect(markup).toContain(`>${modelId}<`)
  }
})
