# CLAUDE.md

## Project Scope

Home Management Center is the companion Web management console for CLIProxyAPIHome. It is a React 19 + TypeScript application built with Rsbuild, TanStack Router, TanStack Query, Zustand, shadcn/ui, Tailwind CSS v4, and i18next.

Treat `src/lib/api/management/` as the frontend integration boundary for backend access. Do not invent routes, fields, metrics, or workflows that are not represented by the current CLIProxyAPIHome Management API contract or confirmed product requirements.

## Backend API Contract

- Read the latest CLIProxyAPIHome Management API contract before adding or changing Management API routes, DTO fields, capability detection, or backend-dependent workflows.
- Do not use copied API documents, cached API snapshots, or historical local workbench plans as backend contract sources. This frontend repository must not maintain a duplicate Management API specification.
- Treat `src/lib/api/management/` as the source of truth for what the frontend currently integrates, not as a substitute for the backend contract.
- If the current backend contract is unavailable in the local environment, inspect the existing adapters conservatively and ask for the current backend document before introducing API assumptions.

## Key Directories

- `src/app/`: application provider setup.
- `src/assets/`: static product assets.
- `src/components/ui/`: shadcn/ui primitives and low-level reusable UI.
- `src/components/shared/`: shared non-domain components.
- `src/components/session/`: runtime connection UI and session bootstrap.
- `src/components/shell/`: app shell, navigation, command palette, and global chrome.
- `src/features/`: page-level feature modules, view components, and feature hooks.
- `src/hooks/`: cross-feature React hooks.
- `src/lib/api/management/`: Management API clients, adapters, backend feature detection, and DTO normalization.
- `src/lib/i18n/`: locale setup and translations.
- `src/routes/`: TanStack Router route entries.
- `src/stores/`: Zustand stores.
- `src/styles/`: global styles, theme tokens, control tokens, and reusable effects. `control-tokens.css` owns the control step ramp, the type roles, and the shared interaction states.

## Start Here

Before implementing product work, read:

1. `README.md`
2. `PRODUCT.md`
3. `DESIGN.md`
4. The latest CLIProxyAPIHome Management API contract for backend-dependent work
5. The relevant files in `src/features/`
6. The relevant adapters in `src/lib/api/management/`

For UI critique, visual polish, layout, copy, accessibility, empty states, loading states, error states, or responsive behavior, read `PRODUCT.md` and `DESIGN.md` before editing.

## Commands

- Install dependencies: `bun install`
- Development server: `bun run dev`
- Generate routes: `bun run routes:generate`
- Type check: `bun run typecheck`
- Lint: `bun run lint`
- Format: `bun run format`
- Format check: `bun run format:check`
- Build: `bun run build`
- Dead code check: `bun run knip`

Do not start extra development servers when the user already has one running. The default manual validation URL is `http://localhost:3000` unless the user says otherwise.

## Architecture Rules

- Keep backend differences inside `src/lib/api/management/` adapters.
- Components should consume normalized view models, not raw backend DTOs.
- Put TanStack Query queries and mutations in feature hooks.
- Represent unsupported backend behavior clearly instead of showing placeholder data.
- Use existing shadcn/ui primitives for dialogs, confirmation flows, sheets, forms, buttons, inputs, dropdowns, and skeletons.
- Size a control by choosing its step (`xs` `sm` `md` `lg` `xl`), which carries height, padding, gap, type, radius and icon size together. Feature code sets width and spacing, never height or type; `home-ui/no-control-size-override` fails the build on both.
- Take interaction states from the control's family rather than writing them per call site: a bordered control gets its hover from `.control-bordered`, a filled one deepens its own fill, a segmented one moves background only. Read DESIGN.md Interaction states before adding any `hover:` utility to a control.
- Build every table action column with `RowActions`. At most three controls in the column counting the overflow trigger, so four or more actions render two buttons plus a trigger; icon-plus-label `text` buttons only; and the column takes its width from `.table-action-column-{1,2,3}`, never a width utility.
- Build charts with `src/components/ui/chart.tsx` (Recharts), never hand-rolled SVG. Use `ChartXAxis` rather than a bare `XAxis`; give the container a fixed height and no `min-width`; prefer `accessibilityLayer` over per-point tab stops, and name the chart with `role="group"` plus an `aria-label`. Inline SVG is for decorative `aria-hidden` sparklines only.
- Avoid browser-native `alert`, `confirm`, and `prompt` in product UI.
- Do not add placeholder features that imply backend support the API does not provide.
- Keep generated route output consistent by running `bun run routes:generate` after route changes.

## Internationalization

All visible UI copy must use i18n keys. Maintain all supported locale files together:

- `zh-CN`
- `zh-TW`
- `en`
- `ru`

Do not translate provider IDs, model IDs, API field names, route paths, config keys, protocol literals, or code identifiers.

## UI Expectations

- This is an operations console, not a marketing site.
- Prefer dense, clear, task-oriented layouts over decorative card grids.
- Primary actions should reflect actual user frequency and product risk.
- Destructive actions require component-library confirmation UI.
- Empty, loading, error, unsupported, and partial-data states must be explicit.
- Button color and variant choices must match semantic meaning.
- Controls in the same state must look the same across the whole app. One control size per toolbar row, and one hover treatment per control family.
- Tables should keep stable column widths where changing data could otherwise cause visual jitter.
- Mobile behavior should use responsive structure, not viewport-scaled typography. Touch floors come from the control step and need no per-surface opt-in.
- Width decides a layout's shape (`useIsCompactViewport`, 40rem); pointer coarseness decides target size (the control step). Do not conflate them. Below 40rem an action column collapses to a single overflow trigger.
- Take field, field-group and filter-row layout from `@/components/shared/form-layout`; do not write `grid gap-* sm:grid-cols-*` at a call site.
- Overlays cap their height in `dvh`, not `vh` or a fixed px, or a software keyboard pushes them past the fold. Sheets are full width below 40rem and a capped panel above it. Button groups stack and stretch below 40rem rather than wrap.
- A dense grid of small targets that cannot reach the 40px floor changes its column count, not its hit-area padding.
- Build a sheet form from `DrawerScaffoldForm` + `DrawerScaffoldBody` + `DrawerScaffoldFooter`; a plain `<form className="grid">` inside a drawer cannot scroll and hides its submit button on a short viewport.
- Take table header background from `tableHeaderClassName`; never write `bg-muted/70` or another shade, because the sticky action column paints one opaque value.
- Bulk action bars use `text` and `destructiveText`, the same family as row actions — not `outline` with a hand-written `text-destructive`.
- Only render a hover drill-down affordance on a card that is actually navigable.
- Below 40rem a table keeps only its identity column, its one most telling field, and actions; gate the `col`, `TableHead` and `TableCell` on one `useSecondaryColumns()` value. Three things are all required: hide the columns, drop the table min-width, and switch to `table-fixed` (an auto-layout table ignores a cell max-width and sizes to content). Give the identity column no width so it takes the remainder.
- Verify a responsive claim by measuring at that width in a browser, not by reasoning about it.

## Editing Rules

- Keep edits scoped to the requested feature or cleanup.
- Preserve existing architectural boundaries unless the task explicitly asks for a refactor.
- Do not commit local drafts, generated critique output, temporary planning notes, caches, build output, or dependency directories.
- Add comments only when they explain a non-obvious constraint or decision.
- Prefer small, reviewable changes over broad rewrites.

## Verification

For small changes, run targeted checks. For completed feature slices, run at least:

```bash
bun run typecheck
```

Run `bun run lint`, `bun run format:check`, `bun run build`, and `bun run knip` when the slice is broad, shared, or ready for final review. Do not run the full set after every tiny edit unless the user asks.

## Runtime Validation

If a local CLIProxyAPIHome backend is available, validate against it in the browser. If the console is not connected, use the global connection management action and enter the backend endpoint plus management key provided by the user.
