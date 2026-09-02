/*
 * The document layer never scrolls in this app: each shell caps itself at one
 * viewport and scrolls its <main> instead (AppShell, PublicAccessShell). The
 * router has to be told about that container the way it already knows about
 * the window — restore its position across history moves, and reset it on a
 * fresh navigation — which is what these ids and selectors wire up.
 */
export const appShellScrollRestorationId = 'app-shell-main'
export const publicShellScrollRestorationId = 'public-shell-main'

export const shellScrollToTopSelectors = [
  `[data-scroll-restoration-id="${appShellScrollRestorationId}"]`,
  `[data-scroll-restoration-id="${publicShellScrollRestorationId}"]`,
]

/**
 * Scrolls an element into view within the shell's isolated `<main>` scroll container,
 * preventing browser-level ancestor chain scrolling from shifting the outer layout or creating blank space.
 */
export function scrollElementIntoShell(elementId: string, topOffset = 16) {
  const target = document.getElementById(elementId)
  if (!target) return

  const container = target.closest(
    `[data-scroll-restoration-id="${appShellScrollRestorationId}"], [data-scroll-restoration-id="${publicShellScrollRestorationId}"]`,
  )

  if (container) {
    const targetRect = target.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const targetScrollTop = container.scrollTop + (targetRect.top - containerRect.top) - topOffset

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    })
    return
  }

  target.scrollIntoView({
    block: 'start',
    behavior: 'smooth',
  })
}
