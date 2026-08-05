# DESIGN.md

## Overview

Creative north star: **The Quiet Control Plane**.

Home Management Center should feel like a professional CLIProxyAPIHome management console: restrained, readable, precise, and built for repeated operational use. The UI should foreground service readiness, misconfiguration, and safe next actions instead of decorative analytics.

Default design register is product UI. Use familiar control-console patterns: left navigation, top context controls, resource tables, compact cards, sheets, confirmation dialogs, sticky action bars, and clear unsupported states.

Named rules:

- **Verdict Before Detail**: major pages lead with the current operational state before showing secondary metrics.
- **Backend State Is Visible**: unsupported, missing, or failed backend behavior appears as explicit UI states.
- **Cards Earn Their Border**: use cards for resource groups, repeated items, modals, and framed tools; avoid nested cards and decorative section cards.
- **Risk Has Weight**: destructive actions, remote access, secret changes, and diagnostics need stronger confirmation and clearer copy.
- **Density Without Compression**: keep layouts efficient while preserving readable spacing, stable control sizes, and clear scan paths.

## Colors

Color strategy: restrained product palette with cool tinted neutrals and one primary accent.

Theme direction:

- Use Slate as the neutral foundation for shell, body, cards, borders, and muted text.
- Use Teal as the primary accent for active states, primary actions, selected states, focus rings, and positive connection affordances.
- Light mode should feel calm and low-glare, with cool off-white content surfaces.
- Dark mode should feel like a professional control room, not a pure black terminal skin.
- Keep the light and dark themes derived from the same Slate and Teal token system.

Primary accent:

- Teal: `#0d9488`, `#14b8a6`, `#2dd4bf`
- Use teal sparingly for intent and state.
- Do not use teal as broad decoration or page wallpaper.

Neutral surfaces:

- Light background: cool slate off-white.
- Light cards: near-white with subtle border separation.
- Dark background: low-glare deep slate.
- Dark cards: elevated slate with enough contrast from the body background.

Sidebar:

- Avoid pure black sidebars and pure white active navigation blocks.
- Dark sidebar should use deep slate or muted navy-slate.
- Hover should brighten only the hovered item.
- Active navigation should use tinted teal or slate surfaces with readable foreground.
- Collapsed and expanded states must preserve icon recognition, hit area, and active route clarity.

Semantic colors:

- Amber for warnings, degraded states, validation issues, and configuration attention.
- Red for deletion, log clearing, dangerous diagnostics, irreversible replacement, or security-sensitive failure.
- Emerald or green for success and confirmed readiness.
- Sky or blue for neutral information, not primary brand emphasis.

Theme tokens:

- Use `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--primary`, `--success`, `--warning`, `--info`, and `--destructive`.
- Use `--overlay` for dialogs, sheets, command palette, and blocking overlays.
- Avoid hard-coded pure white, pure black, or one-off Tailwind color families when a token exists.
- `src/styles/theme-tokens.css` owns Slate theme mappings and semantic color variables.
- `src/styles/effects.css` owns cross-theme loading and motion effects.
- `src/styles/globals.css` stays as the style entrypoint plus minimal global base rules.

Do not introduce broad purple gradients, warm parchment backgrounds, beige/brown themes, decorative bokeh, floating orbs, or gradient text.

## Typography

Use Inter Variable as the product UI default, with broad system and Noto fallbacks for Simplified Chinese, Traditional Chinese, English, and Russian:

`"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Noto Sans SC", "Noto Sans TC", "Helvetica Neue", Arial, sans-serif`

Use a separate technical mono stack for API paths, config keys, logs, masked secrets, request IDs, route paths, and YAML:

`"IBM Plex Mono", "Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`

Rules:

- Product UI uses one sans family.
- Do not introduce display fonts for labels, tables, forms, or navigation.
- Use fixed rem sizes, not viewport-scaled type.
- Keep headings compact. Reserve large display type for true first-run or empty-state moments.
- Labels and table text should prioritize recognition over expressiveness.
- Body prose should stay within 65 to 75 characters when used in explanations.
- Letter spacing should be normal. Avoid negative tracking.

Recommended hierarchy:

- Page title: compact semibold around `text-xl`.
- Section title: `text-base` or `text-sm` semibold depending on density.
- Field label: `text-sm` medium.
- Help text, metadata, tags: `text-xs` to `text-sm` muted.
- Code, route paths, config keys, and model IDs: mono only where literal precision helps.

## Layout

- The app shell uses a left global sidebar and a right content workspace.
- Main pages should have one clear primary surface, not several equal-weight panels.
- Tables and workspaces are usually the visual center for resource pages.
- Keep repeated controls aligned across pages: refresh, create, filter, view, edit, delete, save, and cancel.
- Use sticky action bars only when they protect long-page workflows.
- Avoid fixed-height panels unless they solve a real scroll containment problem.
- Do not nest cards inside cards.
- Do not make every section a card by default.

## Elevation

Flat by default. Elevation should communicate layering, not decoration.

- Page background and sidebar provide the primary depth relationship.
- Cards use borders first, subtle shadows only where separation is necessary.
- Sticky action bars may use light shadow and backdrop treatment to remain readable while scrolling.
- Sheets, dialogs, dropdowns, command palette, and popovers use stronger elevation because they sit above the task surface.
- Hover states should change background, border, or text color, not layout.
- Avoid glassmorphism, heavy blur, glow, or floating decorative panels.

## Components

Control sizing:

- One height scale: `sm` 32px for dense table tools, `default` 36px for forms and actions, `lg` 40px for prominent or mixed filter rows.
- Input, select trigger, button, and toggle-group items of the same size name resolve to the same height.
- One control size per toolbar row. Feature code sets width and spacing, never height.
- Responsive layouts reflow or wrap; they do not change control height at a breakpoint.
- Compact toolbars may opt into the shared compact modifier: every `sm` control becomes 40px below the `sm` breakpoint.

Overflow in controls:

- Backend values are unbounded, so controls clip rather than grow or wrap; height never depends on data.
- A displayed value is one line ending in an ellipsis, full string on hover; long ids differ at the tail, where the ellipsis lands.
- Option lists may grow past their trigger, up to the viewport, so the value is readable where it is chosen; beyond that they truncate too.

Action placement and emphasis:

- Actions sit at the narrowest scope they affect: `PageHeader` for page-wide ones like refresh, `TableSurfaceHeader` for collection ones like create.
- A single-resource page may keep its primary action in `PageHeader`, but no action appears in both headers.
- One primary per group, given to the safest frequent next action, usually create. Refresh, sync, export, and replace-all are `outline`.
- Destructive actions take the destructive treatment; a group of only secondary or risky actions needs no primary.
- Row action columns carry independent row-level tasks only, never a destination the detail view already offers; three at most, the rest in an overflow menu.
- Destructive actions come last, and sticky action columns never cover adjacent content.

Tabs:

- Peer views use the shared Radix Tabs primitive, so the tablist, panel, and focus wiring stays consistent.
- Tabs are flat navigation, not actions: a quiet selected surface and a restrained indicator, never filled buttons, shadows, or outline buttons.
- Page-level and table-surface tabs share one visual language; express hierarchy through placement and spacing, not a second trigger style.
- Tab lists stay on one horizontally scrollable line, and triggers use the shared responsive compact height.
- Text labels by default; add an icon only when it disambiguates otherwise similar destinations.
- Use `forceMount` only when leaving a tab must preserve local state or an already-running workflow.

Shell:

- Left sidebar is the global navigation anchor.
- Sidebar supports grouped navigation, collapsed icon rail, active route indicators, and mobile drawer behavior.
- Navigation items have stable height, clear icon/title alignment, and enough padding for scanning.
- Top bar contains command entry, theme, language, and global connection management.
- Keep the connection management action because it provides the global disconnect path.

Dashboard:

- Dashboard is the global overview.
- Lead with a concise operational verdict: disconnected, connected, ready, needs setup, degraded, or unsupported.
- Suggested actions respond to health gaps and should not duplicate the sidebar.
- Provider and credential summaries should become setup-oriented empty states when all counts are zero.
- Partial API failures should surface as degraded data status.

Resource pages:

- Use list/table plus detail sheet patterns for providers, credentials, access keys, usage, call diagnostics, runtime logs, and nodes.
- Keep resource headers full-width. Place inset resource content in a shared padded layer with its own visual boundary; treat full-bleed layouts as explicit exceptions.
- Place create/import actions close to the resource header.
- Put view, edit, and delete actions in explicit operation columns when row actions are not obvious.
- Use component-library confirmation dialogs for destructive actions.
- Search inputs should act directly when the interaction is obvious. Avoid duplicate search buttons when Enter or live filtering is sufficient.

Config workspace:

- Use one visual workspace for supported runtime settings.
- The config workspace uses sections, not a linear wizard.
- Save, reload, dirty state, validation state, and view changes belong in a sticky action bar inside the workspace.
- Do not expose a second raw-editing path in the product UI.
- Sensitive fields use hidden inputs with explicit reveal controls.

Sheets and dialogs:

- Sheets should slide from the side with a clear header, body, and optional footer.
- When a sheet drills into a secondary task, replace its header in place and keep back navigation at the header start; do not stack a second header inside the body.
- Leave enough spacing between sheet header actions and the first body control to avoid misclicks.
- Dialogs and confirm flows need stronger dark-mode contrast than the page background.
- Destructive confirms should name the object or operation being affected.

States:

- Loading uses skeletons with subtle shimmer.
- Empty states teach the next action.
- Error states distinguish unsupported backend behavior, unauthorized request, failed request, and partial data.
- Disabled controls must not look like primary actions.
- Primary actions must not look disabled.

## Do's and Don'ts

Do:

- Use the Management API as the hard product boundary.
- Keep API adapters and backend feature differences out of JSX.
- Keep visible copy in i18n locale files.
- Use lucide icons consistently and semantically.
- Use shadcn/ui dialogs, sheets, dropdowns, buttons, inputs, and skeletons before creating custom primitives.
- Make unsupported backend behavior explicit and recoverable.
- Prefer teal/slate restrained emphasis for control-console actions.
- Preserve layout stability for buttons, toolbars, tables, config fields, and navigation items.

Don't:

- Do not invent backend routes, fields, metrics, or bulk operations.
- Do not use browser-native `alert`, `confirm`, or `prompt`.
- Do not use gradient text, decorative orbs, bokeh, glass cards, or hero metric templates.
- Do not nest cards inside cards.
- Do not use pure black sidebars or pure white active navigation blocks.
- Do not overuse purple, beige, parchment, espresso, or single-hue palettes.
- Do not let Russian, English, Simplified Chinese, or Traditional Chinese labels overflow buttons or cards.
- Do not hide partial API failures or unsupported backend behavior.
