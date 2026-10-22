import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./fixtures/date-range-picker.tsx', import.meta.url))
for (const scenario of ['transaction', 'calendar-and-time', 'clear-reopen', 'typing', 'keyboard']) {
  test(`shared date picker: ${scenario}`, () => {
    const result = spawnSync(process.execPath, [fixture, scenario], {
      encoding: 'utf8',
      timeout: 10_000,
    })
    expect(result.error, result.stderr).toBeUndefined()
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })
}
