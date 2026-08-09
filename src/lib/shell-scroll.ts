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
