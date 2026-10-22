/*
 * Form and filter layout.
 *
 * These three strings were previously written out at each call site, and they had
 * drifted the way repeated strings do: 124 field labels across six spellings, with
 * the type size sometimes on the label and sometimes on the span inside it, and
 * gaps of 1, 1.5 and 2; filter rows declared as three near-identical constants in
 * three files, two of them character-for-character the same.
 *
 * None of that was visible as a bug. It is visible as a table of differences with
 * no reason behind any of them, which is the thing a design system exists to stop.
 * A field is a field, so it has one spelling here.
 */

/**
 * A label wrapping its own control. The label element is the association, so no
 * `htmlFor` is needed; the text goes in a `<span>` and the control follows it.
 */
const fieldClassName = 'grid gap-1.5 text-sm font-medium'

/**
 * A group of fields. One column below 40rem — a phone has room for one field, and
 * two half-width fields at 375px are two truncated fields.
 */
const formGridClassName = 'grid gap-3 sm:grid-cols-2'

/**
 * A filter row above a table. Denser than a form grid because filters are short
 * and scanned together, and it keeps climbing past `sm` because a filter row is
 * usually the widest thing on the page.
 */
const filterGridClassName = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'

/** A filter row with fewer, wider controls, such as a date range plus one select. */
const narrowFilterGridClassName = 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3'

/** Equal-width filter slots: apply flex to unpadded wrappers, not their controls. */
const filterRowClassName = 'flex flex-col gap-2 sm:flex-row sm:items-center'
const flexibleFilterFieldClassName = 'min-w-0 sm:flex-1'

export {
  fieldClassName,
  filterGridClassName,
  filterRowClassName,
  flexibleFilterFieldClassName,
  formGridClassName,
  narrowFilterGridClassName,
}
