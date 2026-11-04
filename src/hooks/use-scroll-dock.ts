import { type Ref, type RefCallback, useCallback } from 'react'

/*
 * A scroll box nested in a scrolling page takes vertical gestures only once all
 * of it is on screen.
 *
 * The browser hands a wheel or touch gesture to the innermost box under the
 * pointer that can still scroll in that direction. A bounded table is such a
 * box, so one whose bottom ran past the fold kept every gesture made over it:
 * the page stayed where it was and the rows scrolled through whatever slice of
 * the box happened to be visible. Measured on the request records table at
 * 1920x947 (1080p less the browser chrome), that slice was four rows of a
 * nine-row box, and one row at 125% scaling; the page only moved while the
 * pointer was somewhere else, and stopped again as soon as the table slid under
 * it.
 *
 * While any of the box is outside the visible area its vertical overflow is set
 * to hidden. That takes it out of the running for vertical gestures, so they
 * scroll the page and bring the box into view. Horizontal scrolling and the
 * scroll offset are untouched. Once the whole box is visible it docks and
 * scrolls as it always did. Nothing intercepts an event: the browser still does
 * all of the scrolling, for wheel, touch and keyboard alike.
 *
 * Overflow has no direction, so the box is only held back while the page has
 * room in a direction the box also has room in. Where the box can still scroll
 * one way and the page cannot - a log view that opens on its newest line at the
 * bottom of a page that is still at its top - holding it back would leave that
 * gesture with nothing to move, so the box keeps its scrolling. A box taller
 * than the visible area keeps it too, as it can never be wholly on screen.
 *
 * The box should reserve its scrollbar gutter, or a classic scrollbar appearing
 * on dock changes its width.
 */

const dockAttribute = 'data-scroll-dock'

// Wakes the check for movement that is neither a scroll nor a resize, such as
// a notice opening above the box. Scrolling is followed exactly by its own
// listener, so these only need to be dense enough not to miss a shift.
const visibilityThresholds = [0, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1]

function findScrollParent(element: HTMLElement) {
  for (
    let node = element.parentElement;
    node && node !== document.body;
    node = node.parentElement
  ) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

function dock(element: HTMLElement) {
  // null means the document itself scrolls, so the viewport is the visible area.
  const scrollParent = findScrollParent(element)

  const update = () => {
    let top = 0
    let bottom = window.innerHeight
    if (scrollParent) {
      const portTop = scrollParent.getBoundingClientRect().top + scrollParent.clientTop
      top = Math.max(top, portTop)
      bottom = Math.min(bottom, portTop + scrollParent.clientHeight)
    }

    // A pixel of slack on every test: layout lands on fractional pixels, and a box
    // flush with the fold must not flicker between the two states.
    const box = element.getBoundingClientRect()
    const onScreen = box.top >= top - 1 && box.bottom <= bottom + 1
    const fits = box.height <= bottom - top + 1

    const boxRoom = element.scrollHeight - element.clientHeight
    const boxUp = element.scrollTop > 1
    const boxDown = element.scrollTop < boxRoom - 1
    const page = scrollParent ?? document.scrollingElement ?? document.documentElement
    const pageUp = page.scrollTop > 1
    const pageDown = page.scrollTop < page.scrollHeight - page.clientHeight - 1

    const pageShouldLead = (boxDown && pageDown) || (boxUp && pageUp)
    const deadEnd = (boxDown && !pageDown) || (boxUp && !pageUp)
    const docked = boxRoom <= 1 || onScreen || !fits || !pageShouldLead || deadEnd
    const state = docked ? 'docked' : 'undocked'
    if (element.getAttribute(dockAttribute) === state) return

    element.setAttribute(dockAttribute, state)
    element.style.overflowY = docked ? '' : 'hidden'
  }

  const scrollTarget = scrollParent ?? window
  scrollTarget.addEventListener('scroll', update, { passive: true })
  // The box's own position decides which way it has room.
  element.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  // The box keeps its size while its content grows past it, so the content is
  // observed too.
  const resizeObserver = new ResizeObserver(update)
  for (const target of [element, element.firstElementChild, scrollParent]) {
    if (target) resizeObserver.observe(target)
  }
  const intersectionObserver = new IntersectionObserver(update, {
    root: scrollParent,
    threshold: visibilityThresholds,
  })
  intersectionObserver.observe(element)
  update()

  return () => {
    scrollTarget.removeEventListener('scroll', update)
    element.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    element.removeAttribute(dockAttribute)
    element.style.overflowY = ''
  }
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

/**
 * Returns the ref for the scroll box. `forwardedRef` receives the same element,
 * for a caller that also needs it, such as a virtualiser's scroll element.
 */
export function useScrollDock<T extends HTMLElement>(forwardedRef?: Ref<T>): RefCallback<T> {
  return useCallback(
    (element: T | null) => {
      setRef(forwardedRef, element)
      if (!element) return

      const undock = dock(element)
      return () => {
        undock()
        setRef(forwardedRef, null)
      }
    },
    [forwardedRef],
  )
}
