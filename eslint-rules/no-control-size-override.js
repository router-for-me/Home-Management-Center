/**
 * Feature code may size a control's width and place it; it may not resize its
 * box or its type. Those belong to the control step, and the reason the rule
 * exists rather than the convention alone is that the convention was already
 * written down and still accumulated 39 overrides - including the topbar, where
 * a control declared one step and then pinned itself four pixels taller.
 *
 * What stays legal is everything that is not a disguised step:
 *   - `h-auto`, `h-full`, `min-h-0` opt out of a fixed height on purpose
 *   - `min-h-*` on a textarea sets its initial rows, which is its whole point
 *   - `*-control-*` reads the height from a token, so it moves with density
 *   - variant-prefixed classes (`sm:`, `[&_svg]:`) size something else
 */

const CONTROLS = new Set([
  'Button',
  'Input',
  'SelectTrigger',
  'ToggleGroupItem',
  'TabsTrigger',
  'Textarea',
])

/*
 * The type half only applies where a step supplies type. A textarea takes no
 * size prop, so it has no step to contradict; banning type there would leave it
 * with nothing.
 */
const STEPPED = new Set(['Button', 'Input', 'SelectTrigger', 'ToggleGroupItem', 'TabsTrigger'])

const TOKEN_SIZE = /^(?:min-)?(?:h|w|size)-control-(?:xs|sm|md|lg|xl)$/
const OPT_OUT = new Set(['h-auto', 'h-full', 'min-h-0', 'h-fit', 'h-px'])
const NUMERIC_BOX = /^(?:min-)?(?:h|size)-(?:\d|\[)/
const TYPE_ON_CONTROL = /^(?:text-(?:xs|sm|base|lg|xl|\[)|leading-)/

function classNamesIn(node) {
  const found = []
  const walk = (current) => {
    if (!current || typeof current !== 'object') return
    if (current.type === 'Literal' && typeof current.value === 'string') {
      found.push(...current.value.split(/\s+/).filter(Boolean))
      return
    }
    if (current.type === 'TemplateLiteral') {
      for (const quasi of current.quasis) {
        found.push(...quasi.value.raw.split(/\s+/).filter(Boolean))
      }
    }
    for (const key of Object.keys(current)) {
      if (key === 'parent') continue
      const value = current[key]
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object' && typeof value.type === 'string') walk(value)
    }
  }
  walk(node)
  return found
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep control box size and type coming from the control step, not the call site',
    },
    schema: [],
    messages: {
      box: "`{{className}}` resizes a {{control}}. Pick the step that is this size, or use a `*-control-*` token when the element is not a control. See DESIGN.md 'Control sizing'.",
      type: "`{{className}}` sets type on a {{control}}. The step owns font size and line height. See DESIGN.md 'Type roles'.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null
        if (!name || !CONTROLS.has(name)) return

        for (const attribute of node.attributes) {
          if (attribute.type !== 'JSXAttribute') continue
          if (attribute.name.name !== 'className') continue

          const classNames = classNamesIn(attribute.value)
          /*
           * Two shapes carry type legitimately. A control rendering an id, a
           * path or a price takes the code role, whose defining property is the
           * family and which is 12px by design. And a control that opted out of
           * a fixed height has no step to contradict.
           */
          const typeIsOwned = classNames.includes('font-mono') || classNames.includes('h-auto')

          for (const className of classNames) {
            if (className.includes(':') || TOKEN_SIZE.test(className)) continue
            if (OPT_OUT.has(className)) continue
            if (name === 'Textarea' && className.startsWith('min-h-')) continue

            if (NUMERIC_BOX.test(className)) {
              context.report({
                node: attribute,
                messageId: 'box',
                data: { className, control: name },
              })
            } else if (STEPPED.has(name) && !typeIsOwned && TYPE_ON_CONTROL.test(className)) {
              context.report({
                node: attribute,
                messageId: 'type',
                data: { className, control: name },
              })
            }
          }
        }
      },
    }
  },
}
