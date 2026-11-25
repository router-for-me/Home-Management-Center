import { expect, test } from 'bun:test'

import { createBillingModelPriceCandidateId } from '../../src/lib/billing/model-price-candidates'
import {
  resolveModelPriceImportSelection,
  selectModelPriceImportTargetDefaults,
} from '../../src/lib/billing/model-price-import-selection'
import type { ModelPriceImportPreviewAction } from '../../src/lib/billing/model-price-import-types'

function row(
  key: string,
  action: ModelPriceImportPreviewAction,
  selectedByDefault = action === 'create' || action === 'update_sync',
) {
  return {
    key,
    action,
    applicable: ['create', 'update_sync', 'overwrite'].includes(action),
    selectedByDefault,
  }
}

const before = [row('a', 'create'), row('b', 'update_sync'), row('mai', 'review')]
const after = [row('a', 'create'), row('b', 'update_sync'), row('mai', 'create')]

test('cleared rows stay unchecked on refresh and after resolving a catalog match', () => {
  expect([...resolveModelPriceImportSelection(before, null).keys()]).toEqual(['a', 'b'])
  const cleared = new Map<string, 'default'>()
  expect([...resolveModelPriceImportSelection(before, cleared).keys()]).toEqual([])
  const match = new Map(cleared).set('mai', 'default')
  expect([...resolveModelPriceImportSelection(before, match).keys()]).toEqual([])
  expect([...resolveModelPriceImportSelection(after, match).keys()]).toEqual(['mai'])
})

test('a match preserves a partial selection and excludes other price bands of the same model', () => {
  const selection = new Map([
    ['a', 'create'],
    ['mai', 'default'],
  ] as const)
  const rows = [...after, row('mai::*::128000', 'create')]
  expect([...resolveModelPriceImportSelection(rows, selection).keys()]).toEqual(['a', 'mai'])
  expect([...resolveModelPriceImportSelection([row('a', 'skip')], selection).keys()]).toEqual([])
})

test('matching respects preview defaults and overwrites require an explicit selection', () => {
  const rows = [row('mai', 'create', false), row('a', 'overwrite', true)]
  expect(resolveModelPriceImportSelection(rows, null).size).toBe(0)
  expect(
    resolveModelPriceImportSelection(
      rows,
      new Map([
        ['mai', 'default'],
        ['a', 'default'],
      ]),
    ).size,
  ).toBe(0)
  expect(resolveModelPriceImportSelection(rows, new Map([['a', 'create']])).size).toBe(0)
  const explicit = new Map([
    ['a', 'overwrite'],
    ['mai', 'create'],
  ] as const)
  expect([...resolveModelPriceImportSelection(rows, explicit).keys()]).toEqual(['mai', 'a'])
})

test('checking a manual target after clearing selects only its recommended price bands', () => {
  const target = { provider: 'Devin', model: 'devin/example' }
  const rows = [
    { ...target, ...row('opaque-base', 'create') },
    { ...target, ...row('opaque-band', 'update_sync') },
    { ...target, ...row('manual-price', 'overwrite', true) },
    { ...target, ...row('opt-in', 'create', false) },
    { ...target, ...row('unmatched', 'review') },
    { provider: 'other', model: target.model, ...row('other-provider', 'create') },
    { ...target, model: 'devin/Example', ...row('different-model', 'create') },
  ]
  const targetIds = new Set([createBillingModelPriceCandidateId('devin', 'devin/example')])
  const cleared = new Map<string, 'overwrite'>()
  const choices = selectModelPriceImportTargetDefaults(cleared, rows, targetIds)
  expect([...resolveModelPriceImportSelection(rows, choices).keys()]).toEqual([
    'opaque-base',
    'opaque-band',
  ])
  expect(cleared.size).toBe(0)

  const partial = new Map([['other-provider', 'create']] as const)
  const extended = selectModelPriceImportTargetDefaults(partial, rows, targetIds)
  expect([...resolveModelPriceImportSelection(rows, extended).keys()]).toEqual([
    'opaque-base',
    'opaque-band',
    'other-provider',
  ])
  expect(selectModelPriceImportTargetDefaults(null, rows, targetIds)).toBeNull()
})
