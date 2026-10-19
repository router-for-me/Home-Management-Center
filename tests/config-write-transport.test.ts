import { beforeAll, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import type { ConfigFieldValue, WritableConfigFieldKey } from '../src/lib/api/management/config'

type Case = {
  name: string
  key: WritableConfigFieldKey
  value: ConfigFieldValue
  path: string
  method: 'PUT' | 'DELETE'
  expected?: unknown
}

function put(
  name: string,
  key: WritableConfigFieldKey,
  value: ConfigFieldValue,
  path: string,
  expected: unknown = value,
): Case {
  return { name, key, value, path, method: 'PUT', expected }
}

const cases: Case[] = [
  put(
    'writes a quoted public IP',
    'liveMediaRelayPublicIp',
    '203.0.113.1',
    'oauth/providers/codex/live-media-relay/public-ip',
  ),
  put(
    'writes a quoted duration',
    'antigravityConnPoolIdleTimeout',
    '30s',
    'oauth/providers/antigravity/connection-pool/idle-conn-timeout',
  ),
  ...['false', '0', 'null', '[1,2]', '{"agent":"cli"}', 'quoted "agent"\nnext line'].map((value) =>
    put(
      `preserves string type and escaping for ${JSON.stringify(value)}`,
      'oauthCodexHeaderUserAgent',
      value,
      'oauth/providers/codex/header-defaults/user-agent',
    ),
  ),
  put(
    'retains string trimming',
    'oauthCodexHeaderUserAgent',
    '  agent  ',
    'oauth/providers/codex/header-defaults/user-agent',
    'agent',
  ),
  put(
    'sends false instead of an empty body',
    'liveMediaRelayEnabled',
    false,
    'oauth/providers/codex/live-media-relay/enabled',
  ),
  put(
    'sends true as JSON',
    'liveMediaRelayEnabled',
    true,
    'oauth/providers/codex/live-media-relay/enabled',
  ),
  put(
    'sends zero instead of an empty body',
    'liveMediaRelayMaxSessions',
    0,
    'oauth/providers/codex/live-media-relay/max-sessions',
  ),
  put(
    'sends nonzero numbers as JSON',
    'liveMediaRelayMaxSessions',
    7,
    'oauth/providers/codex/live-media-relay/max-sessions',
  ),
  put(
    'preserves explicit null for inheritance',
    'antigravitySignatureCacheEnabled',
    null,
    'oauth/providers/antigravity/signature-cache-enabled',
  ),
  put(
    'preserves nullable false',
    'antigravitySignatureBypassStrict',
    false,
    'oauth/providers/antigravity/signature-bypass-strict',
  ),
  put(
    'preserves nullable true',
    'antigravitySignatureCacheEnabled',
    true,
    'oauth/providers/antigravity/signature-cache-enabled',
  ),
  ...([false, true, 'chat', 'passthrough'] as const).map((value) =>
    put(
      `encodes the image-generation mode ${value}`,
      'multimediaDisableImageGeneration',
      value,
      'multimedia/disable-image-generation',
    ),
  ),
  put(
    'writes bare JSON arrays',
    'liveMediaRelayIceServersJson',
    '[{"urls":["stun:example.invalid"]}]',
    'oauth/providers/codex/live-media-relay/ice-servers',
    [{ urls: ['stun:example.invalid'] }],
  ),
  put(
    'writes empty arrays without deleting the setting',
    'liveMediaRelayIceServersJson',
    '[]',
    'oauth/providers/codex/live-media-relay/ice-servers',
    [],
  ),
  put(
    'retains string-list normalization',
    'antigravitySensitiveWordsJson',
    '[" alpha ","",2,"beta"]',
    'oauth/providers/antigravity/sensitive-words',
    ['alpha', 'beta'],
  ),
  put(
    'writes bare JSON objects',
    'oauthExcludedModelsJson',
    '{"claude":["model-a"]}',
    'oauth/excluded-models',
    { claude: ['model-a'] },
  ),
  put(
    'writes empty objects without deleting the setting',
    'oauthExcludedModelsJson',
    '{}',
    'oauth/excluded-models',
    {},
  ),
  put(
    'retains payload sanitization',
    'payloadRulesJson',
    '{"override":[{"models":[" model-a "],"params":{" temperature ":0}}]}',
    'requests/payload',
    {
      default: [],
      'default-raw': [],
      override: [{ models: [{ name: 'model-a' }], params: { temperature: 0 } }],
      'override-raw': [],
      filter: [],
    },
  ),
  {
    name: 'clears blank strings with DELETE',
    key: 'liveMediaRelayPublicIp',
    value: '   ',
    path: 'oauth/providers/codex/live-media-relay/public-ip',
    method: 'DELETE',
  },
  {
    name: 'clears a blank image-generation mode with DELETE',
    key: 'multimediaDisableImageGeneration',
    value: '',
    path: 'multimedia/disable-image-generation',
    method: 'DELETE',
  },
  {
    name: 'clears empty payload rules with DELETE',
    key: 'payloadRulesJson',
    value: '{}',
    path: 'requests/payload',
    method: 'DELETE',
  },
]

let results: Array<{
  error: string | null
  requests: Array<{ method: string; path: string; body: string; contentType: string }>
}>

beforeAll(() => {
  const fixture = fileURLToPath(new URL('./fixtures/config-xhr-transport.ts', import.meta.url))
  const child = spawnSync(process.execPath, [fixture], {
    input: JSON.stringify(
      cases.map(({ key, value }) => ({ key, nextValue: value, previousValue: null })),
    ),
    encoding: 'utf8',
    timeout: 10_000,
  })
  expect(child.error).toBeUndefined()
  expect(child.stderr).toBe('')
  expect(child.status).toBe(0)
  results = JSON.parse(child.stdout)
  expect(results).toHaveLength(cases.length)
})

for (const [index, sample] of cases.entries()) {
  test(`config XHR transport ${sample.name}`, () => {
    const result = results[index]!
    expect(result.error).toBeNull()
    expect(result.requests).toHaveLength(1)
    const request = result.requests[0]!
    expect(request.method).toBe(sample.method)
    expect(request.path).toBe(`/v8/management/config/${sample.path}`)
    if (sample.method === 'DELETE') {
      expect(request.body).toBe('')
    } else {
      expect(request.contentType).toBe('application/json')
      expect(request.body).toBe(JSON.stringify(sample.expected))
      expect(JSON.parse(request.body)).toEqual(sample.expected)
    }
  })
}
