import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

// The prop name and the step name are the same word now, which is the point of
// the rename: `size="md"` renders `control-md`, with no table in between.
const sizes = [
  ['sm', 'control-sm'],
  ['md', 'control-md'],
  ['lg', 'control-lg'],
  ['xl', 'control-xl'],
] as const

describe('control size contract', () => {
  for (const [size, heightClassName] of sizes) {
    test(`uses ${heightClassName} for ${size} controls`, () => {
      const markup = renderToStaticMarkup(
        <div>
          <Input size={size} aria-label={`${size} input`} />
          <Select>
            <SelectTrigger size={size} aria-label={`${size} select`} />
          </Select>
          <ToggleGroup type="single" size={size} aria-label={`${size} toggle group`}>
            <ToggleGroupItem value="enabled">Enabled</ToggleGroupItem>
          </ToggleGroup>
          <Button size={size}>{size}</Button>
        </div>,
      )

      expect(markup.match(new RegExp(`data-size="${size}"`, 'g'))).toHaveLength(5)
      expect(markup.match(new RegExp(heightClassName, 'g'))).toHaveLength(4)
      // The contract, not the class name: height reaches these controls through
      // the step and never through a bare height utility. Variant-prefixed ones
      // such as `file:h-7` size something else and are left alone.
      const bareHeights = [...markup.matchAll(/class="([^"]*)"/g)]
        .flatMap(([, value]) => value.split(/\s+/))
        .filter((token) => /^h-\d/.test(token))
      expect(bareHeights).toEqual([])
    })
  }
})
