const controlSizeClassNames = {
  sm: 'h-8',
  default: 'h-9',
  lg: 'h-10',
} as const

const responsiveCompactControlClassName = 'min-h-10 sm:min-h-8'

type ControlSize = keyof typeof controlSizeClassNames

export { controlSizeClassNames, responsiveCompactControlClassName, type ControlSize }
