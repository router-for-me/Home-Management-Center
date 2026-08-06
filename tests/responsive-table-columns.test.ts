import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/*
 * Two things about compact tables cannot be caught by types, and both of them fail
 * silently — the table renders, just with its columns shifted by one.
 *
 * 1. A hidden column has to be hidden in three places: the `col`, the `TableHead`
 *    and the `TableCell`. `<colgroup>` maps columns by position, so a head dropped
 *    without its col moves every width after it.
 *
 * 2. A table whose header is built from a filtered column list has to build its body
 *    from the same list. The column menu asks "did the user keep this column"; the
 *    table asks "is this column rendered right now". Below 40rem those differ, and
 *    asking the first one in the body left one table with two headers and ten cells.
 */

function sourceFiles() {
  const roots = ['src/features', 'src/components']
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.tsx')) out.push(path)
    }
  }
  roots.forEach(walk)
  return out
}

const ELEMENTS = { '<col': 'col', '<TableHead': 'head', '<TableCell': 'cell' } as const
type Counts = { col: number; head: number; cell: number }

/**
 * Counts the columns a file renders in each mode by walking `{flag ? A : B}` and
 * attributing elements in the A branch to the wide layout and the B branch to the
 * compact one. Cells carrying `colSpan` are skipped: an empty-state row that spans
 * the table is not a column.
 */
function countColumns(src: string, flags: string[]) {
  const wide: Counts = { col: 0, head: 0, cell: 0 }
  const compact: Counts = { col: 0, head: 0, cell: 0 }
  const stack: Array<{ branch: 'A' | 'B'; openedAt: number }> = []
  const flagRe = new RegExp(`^\\{(?:${flags.join('|')})\\s*\\?`)
  let brace = 0

  for (let i = 0; i < src.length; ) {
    const rest = src.slice(i)
    const flagMatch = flagRe.exec(rest)
    if (flagMatch) {
      stack.push({ branch: 'A', openedAt: brace })
      brace += 1
      i += flagMatch[0].length
      continue
    }

    const char = src[i]
    if (char === '{') {
      brace += 1
      i += 1
      continue
    }
    if (char === '}') {
      brace -= 1
      const top = stack.at(-1)
      if (top && brace === top.openedAt) stack.pop()
      i += 1
      continue
    }
    if (char === ':') {
      const top = stack.at(-1)
      if (top && brace === top.openedAt + 1 && top.branch === 'A') top.branch = 'B'
      i += 1
      continue
    }

    let advanced = false
    for (const [token, kind] of Object.entries(ELEMENTS)) {
      if (!rest.startsWith(token) || /[\w-]/.test(rest[token.length] ?? '')) continue
      // A cell that spans columns is not one of them.
      const spans = kind === 'cell' && /^<TableCell[^>]{0,400}?colSpan/s.test(rest)
      if (!spans) {
        if (stack.length === 0) {
          wide[kind] += 1
          compact[kind] += 1
        } else if (stack.every((entry) => entry.branch === 'A')) {
          wide[kind] += 1
        } else {
          compact[kind] += 1
        }
      }
      i += token.length
      advanced = true
      break
    }
    if (!advanced) i += 1
  }

  return { wide, compact }
}

const files = sourceFiles().map((path) => ({ path, src: readFileSync(path, 'utf8') }))

/*
 * These two build their headers by mapping a column list the user can edit, so the
 * column count is a runtime value and counting literals in the source cannot balance
 * it. They are covered by the same-source check at the bottom of this file instead,
 * which is the property that actually broke on them.
 */
const RUNTIME_COLUMN_FILES = [
  'observability/observability-components.tsx',
  'request-events/request-events-page.tsx',
]

describe('compact table columns', () => {
  const withHiddenColumns = files.filter(({ src }) => src.includes('useSecondaryColumns('))

  test('every table that hides columns is known to this test', () => {
    // A guard on the guard: if a new table starts hiding columns, it shows up here.
    expect(withHiddenColumns.length).toBeGreaterThanOrEqual(10)
  })

  for (const { path, src } of withHiddenColumns) {
    if (RUNTIME_COLUMN_FILES.some((suffix) => path.endsWith(suffix))) continue
    const flags = [
      ...new Set(
        [...src.matchAll(/const (showSecondary\w*) = useSecondaryColumns/g)].map(
          (match) => match[1] as string,
        ),
      ),
    ]
    if (flags.length === 0) continue

    test(`${path} renders the same column count in every layer`, () => {
      const { wide, compact } = countColumns(src, flags)
      for (const mode of [wide, compact]) {
        expect(mode.head).toBe(mode.cell)
        if (mode.col > 0) expect(mode.col).toBe(mode.head)
      }
      // Compact must actually drop something, or the flag is dead weight.
      expect(compact.head).toBeLessThan(wide.head)
    })
  }

  test('a body never asks the column menu whether to render a cell', () => {
    /*
     * Checked per column-visibility scope rather than per file, because one file
     * holds both kinds of table: one whose header is narrowed by the compact
     * viewport, and one that is not. Only the narrowed kind is forbidden from
     * consulting the menu's answer in its body — for the other, the two agree.
     */
    for (const { path, src } of files) {
      const scopeStarts = [...src.matchAll(/usePersistentColumnVisibility\(/g)].map((m) => m.index)
      if (scopeStarts.length === 0) continue

      scopeStarts.forEach((start, index) => {
        const scope = src.slice(start, scopeStarts[index + 1] ?? src.length)
        if (!/showSecondary\w* \|\| column\.compact/.test(scope)) return

        expect(
          scope,
          `${path}: compact-filtered header #${index + 1} has no rendered check`,
        ).toMatch(/const isColumnRendered = /)
        const leaks = scope.match(/isColumnVisible\('/g) ?? []
        expect(
          leaks.length,
          `${path}: compact-filtered scope #${index + 1} still reads isColumnVisible('…') in its body`,
        ).toBe(0)
      })
    }
  })
})
