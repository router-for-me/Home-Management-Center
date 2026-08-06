import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectTrigger } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

// The bordered family: every control that owns its own border. A hover means the
// same thing on all of them, so it comes from one class rather than a pair of
// utilities each of them picks for itself.
const borderedFamily = {
  'outline button': <Button variant="outline">Outline</Button>,
  input: <Input aria-label="input" />,
  'select trigger': (
    <Select>
      <SelectTrigger aria-label="select" />
    </Select>
  ),
  textarea: <Textarea aria-label="textarea" />,
  checkbox: <Checkbox aria-label="checkbox" />,
  radio: (
    <RadioGroup>
      <RadioGroupItem value="a" aria-label="radio" />
    </RadioGroup>
  ),
} as const

const classTokens = (markup: string) =>
  [...markup.matchAll(/class="([^"]*)"/g)].flatMap(([, value]) => value.split(/\s+/))

describe('control state contract', () => {
  for (const [name, element] of Object.entries(borderedFamily)) {
    test(`${name} takes its hover from the shared state class`, () => {
      const tokens = classTokens(renderToStaticMarkup(element))
      expect(tokens).toContain('control-bordered')
    })

    test(`${name} does not hand-roll a neutral hover`, () => {
      const tokens = classTokens(renderToStaticMarkup(element))
      // A checked box is a filled control and deepens its own fill, which is a
      // different family and stays legal. What is banned is a plain hover pair,
      // because that is how eight controls ended up with eight hovers.
      const handRolled = tokens.filter((token) => /^hover:(border|bg)-/.test(token))
      expect(handRolled).toEqual([])
    })

    test(`${name} does not narrow the animated property list`, () => {
      const tokens = classTokens(renderToStaticMarkup(element))
      // A `transition-*` utility sets the whole property list from a layer this
      // class cannot outrank. A superset is harmless - the border and the
      // background still animate - but anything narrower silently drops them and
      // leaves the hover snapping while its colours stay correct, which is what
      // `transition-[color,box-shadow]` did on four of these.
      const supersets = new Set(['transition-all', 'transition-colors'])
      const narrowing = tokens.filter(
        (token) => /^transition(-|$)/.test(token) && !supersets.has(token),
      )
      expect(narrowing).toEqual([])
    })
  }

  test('a filled selected state overrides the neutral hover explicitly', () => {
    const tokens = classTokens(renderToStaticMarkup(<Checkbox aria-label="checkbox" />))
    // Checked, the box is filled, so it must say so at a specificity that beats
    // `.control-bordered:hover`. Without this the neutral tint washes it out.
    expect(tokens).toContain('data-[state=checked]:enabled:hover:bg-primary/90')
    expect(tokens).toContain('data-[state=checked]:enabled:hover:border-primary/90')
  })
})
