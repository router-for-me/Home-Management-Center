import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { normalizeConfigValues } from '../src/lib/api/management/config'
import {
  getPayloadReplaceIssues,
  normalizePayloadReplaceContent,
  serializePayloadReplaceContent,
} from '../src/lib/api/management/payload-replace'
import { en } from '../src/lib/i18n/locales/en'
import { ru } from '../src/lib/i18n/locales/ru'
import { zhCN } from '../src/lib/i18n/locales/zh-CN'
import { zhTW } from '../src/lib/i18n/locales/zh-TW'

const rule = {
  models: [
    {
      name: '*',
      protocol: 'claude',
      'from-protocol': 'openai',
      headers: { 'X-Client': 'test-*' },
      match: [{ 'metadata.client': 'test' }],
      'not-match': [{ 'metadata.skip': true }],
      exist: ['messages'],
      'not-exist': ['metadata.bypass'],
    },
  ],
  target: { role: 'user', positions: [1, 2] },
  replacements: [{ ' project\n': ' 项目\n' }, { project: '' }, { project: 'duplicate source' }],
}

function writePayloads(payloads: unknown[]) {
  const fixture = fileURLToPath(new URL('./fixtures/config-xhr-transport.ts', import.meta.url))
  const child = spawnSync(process.execPath, [fixture], {
    input: JSON.stringify(
      payloads.map((payload) => ({
        key: 'payloadRulesJson',
        previousValue: '{}',
        nextValue: JSON.stringify(payload),
      })),
    ),
    encoding: 'utf8',
    timeout: 10_000,
  })
  expect(child.status, child.stderr).toBe(0)
  return JSON.parse(child.stdout) as Array<{
    error: string | null
    requests: Array<{ method: string; path: string; body: string }>
  }>
}

describe('payload user text replacement', () => {
  test('existing payload edits omit an empty replace field for older Home SDKs', () => {
    const override = [{ models: [{ name: '*' }], params: { temperature: 0.2 } }]
    for (const result of writePayloads([{ override }, { override, replace: [] }])) {
      expect(result.error).toBeNull()
      expect(result.requests[0]!.method).toBe('PUT')
      const payload = JSON.parse(result.requests[0]!.body)
      expect(payload).not.toHaveProperty('replace')
      expect(payload.override).toEqual(override)
    }
  })

  test('editing a sibling rule round-trips replacement operands, order and matching conditions', () => {
    const values = normalizeConfigValues({
      requests: {
        payload: {
          replace: [rule],
          override: [{ models: [{ name: '*' }], params: { temperature: 0.2 } }],
          filter: [{ models: [{ name: '*' }], params: ['metadata.debug'] }],
        },
      },
    })
    const payload = JSON.parse(String(values.payloadRulesJson))
    expect(payload.replace).toEqual([rule])
    payload.override[0].params.temperature = 0.4
    const [result] = writePayloads([payload])
    expect(result!.error).toBeNull()
    expect(result!.requests).toHaveLength(1)
    const request = result!.requests[0]!
    expect(request.method).toBe('PUT')
    expect(request.path).toBe('/v8/management/config/requests/payload')
    expect(JSON.parse(request.body)).toEqual({ ...payload, replace: [rule] })
  })

  test('a replace-only payload remains a PUT and does not delete the payload root', () => {
    const [result] = writePayloads([{ replace: [rule] }])
    expect(result!.error).toBeNull()
    expect(result!.requests[0]!.method).toBe('PUT')
    expect(JSON.parse(result!.requests[0]!.body).replace).toEqual([rule])
  })

  test('draft position text survives editing and switching target mode without reaching the wire', () => {
    const content = normalizePayloadReplaceContent(rule)
    content.target.positions = '1, 2,'
    const draft = { models: rule.models, ...serializePayloadReplaceContent(content, true) }
    expect(normalizePayloadReplaceContent(draft).target.positions).toBe('1, 2,')
    const allDraft = {
      models: rule.models,
      ...serializePayloadReplaceContent(
        { ...content, target: { ...content.target, all: true } },
        true,
      ),
    }
    expect(normalizePayloadReplaceContent(allDraft).target.positions).toBe('1, 2,')
    const results = writePayloads([{ replace: [draft] }, { replace: [allDraft] }])
    expect(results.map((result) => result.error)).toEqual([null, null])
    expect(JSON.parse(results[0]!.requests[0]!.body).replace[0].target).toEqual({
      role: 'user',
      positions: [1, 2],
    })
    expect(JSON.parse(results[1]!.requests[0]!.body).replace[0].target).toEqual({
      role: 'user',
      all: true,
    })
    expect(results.every((result) => !result.requests[0]!.body.includes('__hmc_'))).toBe(true)
  })

  test('invalid target and replacement shapes fail before making any request', () => {
    const invalidRules = [
      { ...rule, target: { role: 'assistant', positions: [1] } },
      { ...rule, target: { role: 'user', all: true, positions: [1] } },
      ...[[], [0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1]].map((positions) => ({
        ...rule,
        target: { role: 'user', positions },
      })),
      { ...rule, replacements: [] },
      { ...rule, replacements: [{ '': 'destination' }] },
      { ...rule, replacements: [{ a: 'b', c: 'd' }] },
      { ...rule, replacements: [{ a: null }] },
      { ...rule, models: [] },
    ]
    for (const result of writePayloads(invalidRules.map((sample) => ({ replace: [sample] })))) {
      expect(result.error).not.toBeNull()
      expect(result.requests).toEqual([])
    }
  })

  test('invalid position drafts block save; whitespace sources and empty destinations remain valid', () => {
    const content = normalizePayloadReplaceContent(rule)
    for (const positions of ['0', '-1', '1.5', '1e2', '1, invalid']) {
      expect(getPayloadReplaceIssues({ ...content, target: { all: false, positions } })).toContain(
        'replacePositionsInvalid',
      )
    }
    expect(
      getPayloadReplaceIssues({ ...content, target: { all: false, positions: '' } }),
    ).toContain('replacePositionsRequired')
    expect(
      getPayloadReplaceIssues({ ...content, replacements: [{ from: ' \n', to: '' }] }),
    ).toEqual([])
    expect(
      getPayloadReplaceIssues({ ...content, replacements: [{ from: '', to: 'text' }] }),
    ).toContain('replaceSourceRequired')
    const invalidDraft = {
      models: rule.models,
      ...serializePayloadReplaceContent(
        { ...content, target: { all: false, positions: '1.5' } },
        true,
      ),
    }
    expect(writePayloads([{ replace: [invalidDraft] }])[0]!.requests).toEqual([])
  })

  test('new interaction and validation copy is available in every supported language', () => {
    const keys = (value: object) => Object.keys(value).sort()
    for (const locale of [zhCN, zhTW, ru]) {
      expect(keys(locale.common.configPage.payload.replace)).toEqual(
        keys(en.common.configPage.payload.replace),
      )
      expect(keys(locale.common.configPage.payload.ruleIssues)).toEqual(
        keys(en.common.configPage.payload.ruleIssues),
      )
      expect(locale.common.configPage.payload.intentOptions.replace.title).toBeTruthy()
      expect(locale.common.configPage.payload.sections.replace.description).toBeTruthy()
    }
  })
})
