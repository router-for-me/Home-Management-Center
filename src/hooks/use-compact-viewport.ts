import * as React from 'react'

/*
 * The line where a layout changes shape.
 *
 * 40rem is Tailwind's `sm`, which is the point of picking it: a component that
 * collapses through this hook and a column that reserves its width through
 * `sm:w-*` change on the same pixel. Two boundaries for one decision is how a
 * 40px overflow button ends up centred in a 280px column.
 *
 * Pointer coarseness deliberately does not enter here. A touched 900px tablet
 * needs bigger targets, and the control step's touch floor already gives it
 * those; it does not need a narrower layout. Coarseness answers how big a target
 * has to be, width answers how many of them fit, and mixing the two answers puts
 * the tablet in a phone layout with room to spare.
 */
const COMPACT_VIEWPORT_QUERY = '(width < 40rem)'

/*
 * `typeof window === 'undefined'` and not `typeof window?.matchMedia`: optional
 * chaining guards a null base, not an undeclared identifier, so the shorter form
 * throws a ReferenceError in exactly the environment it was written to survive.
 */
function matchCompactViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(COMPACT_VIEWPORT_QUERY)
}

/**
 * True where the viewport is too narrow to hold a wide layout, so a surface
 * should present its compact shape.
 */
export function useIsCompactViewport() {
  /*
   * The wide layout is the fallback where the query cannot be asked. Tests render
   * this tree to static markup with no DOM at all, and a surface that has to
   * guess is better off guessing the shape that shows every action than the one
   * that hides them behind a trigger nothing can open.
   */
  const [isCompact, setIsCompact] = React.useState(() => matchCompactViewport()?.matches ?? false)

  React.useEffect(() => {
    const query = matchCompactViewport()
    if (!query) return
    const onChange = () => {
      setIsCompact(query.matches)
    }
    query.addEventListener('change', onChange)
    setIsCompact(query.matches)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return isCompact
}
