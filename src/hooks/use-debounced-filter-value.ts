import { useCallback, useEffect, useRef, useState } from 'react'

const defaultDelayMs = 300

/**
 * A filter text box drives a query key, so binding it straight to filter state
 * spends one refetch and one full table render per keystroke. The draft lives
 * here instead and only reaches the filters once the user stops typing, which
 * keeps a keystroke inside the input's own subtree.
 */
export function useDebouncedFilterValue({
  value,
  delayMs = defaultDelayMs,
  onCommit,
}: {
  value: string
  delayMs?: number
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const draftRef = useRef(value)
  const committedRef = useRef(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit

  const cancel = useCallback(() => {
    if (timerRef.current === null) return
    clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const write = useCallback((nextValue: string) => {
    draftRef.current = nextValue
    setDraft(nextValue)
  }, [])

  const commit = useCallback(
    (nextValue: string) => {
      cancel()
      if (nextValue === committedRef.current) return
      committedRef.current = nextValue
      onCommitRef.current(nextValue)
    },
    [cancel],
  )

  // A value that moved anywhere else — cleared filters, a switched search
  // field, a restored preference — has to win over the draft. The user's own
  // keystrokes come back through `committedRef`, so they never land here.
  useEffect(() => {
    if (value === committedRef.current) return
    committedRef.current = value
    cancel()
    write(value)
  }, [cancel, value, write])

  useEffect(() => cancel, [cancel])

  return {
    value: draft,
    onChange: useCallback(
      (nextValue: string) => {
        write(nextValue)
        cancel()
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          commit(nextValue)
        }, delayMs)
      },
      [cancel, commit, delayMs, write],
    ),
    /** Commits the pending draft now, for Enter and other explicit submits. */
    flush: useCallback(() => commit(draftRef.current), [commit]),
    /**
     * Drops the pending commit and hands back what the user typed, for callers
     * that move the draft to another filter instead of committing it here.
     */
    detach: useCallback(() => {
      cancel()
      return draftRef.current
    }, [cancel]),
  }
}
