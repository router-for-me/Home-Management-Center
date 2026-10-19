import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./fixtures/issue-193-forms.tsx', import.meta.url))
for (const scenario of [
  'plugin-loading',
  'plugin-retry',
  'plugin-roundtrip',
  'plugin-background-read',
  'plugin-param-validation',
  'plugin-restore-defaults',
  'plugin-reopen',
  'credential-loading-and-background-read',
  'credential-retry',
  'credential-selector-validation',
  'provider-remove-last-key',
  'provider-multiline-rule',
  'provider-thinking-level',
]) {
  test(`issue #193 real form: ${scenario}`, () => {
    const result = spawnSync(process.execPath, [fixture, scenario], {
      encoding: 'utf8',
      timeout: 10_000,
    })
    expect(result.error, result.stderr).toBeUndefined()
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })
}
