import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const sizes = [
  ['sm', 'h-8'],
  ['default', 'h-9'],
  ['lg', 'h-10'],
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
    })
  }
})
