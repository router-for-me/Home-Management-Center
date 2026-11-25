import { expect, test } from 'bun:test'

import { resolveModelPriceImportSelection } from '../../src/lib/billing/model-price-import-selection'
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
