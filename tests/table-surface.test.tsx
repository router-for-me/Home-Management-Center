import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  TableSurface,
  TableSurfaceContent,
  TableSurfaceHeader,
} from '@/components/shared/table-surface'

describe('shared table surface', () => {
  test('keeps the header and inset content as separate layout layers', () => {
    const markup = renderToStaticMarkup(
      <TableSurface>
        <TableSurfaceHeader title="Resources" />
        <TableSurfaceContent className="grid gap-3">Content</TableSurfaceContent>
      </TableSurface>,
    )

    expect(markup).toContain('Resources')
    expect(markup).toContain('data-slot="table-surface-content"')
    expect(markup).toContain('class="p-4 grid gap-3"')
    expect(markup.indexOf('Resources')).toBeLessThan(
      markup.indexOf('data-slot="table-surface-content"'),
    )
  })
})
