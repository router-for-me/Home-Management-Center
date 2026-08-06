import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

describe('shared tabs', () => {
  test('provides linked tab semantics with the shared flat responsive style', () => {
    const markup = renderToStaticMarkup(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Views">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="details">Details panel</TabsContent>
      </Tabs>,
    )

    expect(markup.match(/role="tab"/g)).toHaveLength(2)
    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('role="tabpanel"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('aria-selected="false"')
    expect(markup.match(/aria-controls="[^"]+"/g)).toHaveLength(2)
    expect(markup).toContain('aria-labelledby=')

    const activePanelId = markup.match(/aria-controls="([^"]+)"/)?.[1]
    expect(activePanelId).toBeTruthy()
    expect(markup).toContain(`id="${activePanelId}"`)

    expect(markup).toContain('overflow-x-auto')
    // The trigger takes a control step; the 40px touch floor rides along with it
    // instead of being opted into per surface.
    expect(markup).toContain('control-md')
    expect(markup).toContain('data-[state=active]:bg-primary/8')
    expect(markup).not.toContain('shadow-sm')
    expect(markup).not.toContain('shadow-xs')
  })
})
