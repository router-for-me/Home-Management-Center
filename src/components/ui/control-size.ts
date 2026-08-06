/*
 * The control step a component renders at. These are the token step names, so
 * `size="md"` and `.control-md` are the same 32px and there is no translation to
 * keep in your head.
 *
 * Getting here meant renaming rather than aliasing. The previous vocabulary put
 * `sm` at 32px and `lg` at 40px, where the steps put them at 28 and 36; an alias
 * would have let an existing `size="lg"` shrink four pixels with nothing to
 * catch it. All 286 call sites moved at once, each checked to land on the height
 * it already had.
 */
const controlStepClassNames = {
  xs: 'control-xs',
  sm: 'control-sm',
  md: 'control-md',
  lg: 'control-lg',
  xl: 'control-xl',
} as const

const controlSquareStepClassNames = {
  xs: 'control-xs control-square',
  sm: 'control-sm control-square',
  md: 'control-md control-square',
  lg: 'control-lg control-square',
  xl: 'control-xl control-square',
} as const

type ControlStep = keyof typeof controlStepClassNames

/*
 * Text entry and grouped toggles start at 28px. The 24px step is for controls
 * that sit inside a badge or a table cell, which is not where an input goes.
 */
type ControlSize = Exclude<ControlStep, 'xs'>

const controlSizeClassNames = {
  sm: controlStepClassNames.sm,
  md: controlStepClassNames.md,
  lg: controlStepClassNames.lg,
  xl: controlStepClassNames.xl,
} as const

export {
  type ControlSize,
  controlSizeClassNames,
  controlSquareStepClassNames,
  controlStepClassNames,
}
