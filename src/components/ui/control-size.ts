const controlSizeClassNames = {
  sm: 'h-8',
  default: 'h-9',
  lg: 'h-10',
} as const

type ControlSize = keyof typeof controlSizeClassNames

export { controlSizeClassNames, type ControlSize }
