# Plugin Interaction Plan

## Purpose

This document defines the frontend capability scope and interaction design for CLIProxyAPIHome plugins in Home Management Center.

It is based on:

- Backend contract: `/Users/dylan/Work/CLIProxyAPIHome/docs/management/api_CN.md`
- Reference frontend capability scan only: `/Users/dylan/Work/Cli-Proxy-API-Management-Center/src/features/plugins`
- Current frontend boundaries in this repository: `src/lib/api/management/`, `src/components/shell/navigation.ts`, `src/features/system-nodes/`, and `src/features/config/`

The first implementation should stay inside the backend contract. The open-source frontend is useful for discovering capability categories, but it exposes routes that are not present in the current Management API contract.

## Backend Capability Map

### Confirmed Routes

| Capability                  | Backend route                      | Frontend meaning                                                                                                                                                       |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List plugin store           | `GET /plugin-store`                | Fetch registry entries, global plugin state, plugin directory, source health, installed state, update availability, auth requirements, and optional registry metadata. |
| Install or update plugin    | `POST /plugin-store/:id/install`   | Write a pinned store manifest into `plugins.configs.<pluginID>.store`. Supports optional `source` query and optional `version` body/query.                             |
| Uninstall plugin            | `POST /plugin-store/:id/uninstall` | Remove the store manifest and create a delete task for all CPA nodes.                                                                                                  |
| Observe node plugin reports | `GET /nodes`                       | Read self-reported CPA plugin install/load/delete status through `plugin_report_required`, `plugin_report_statuses`, and `nodes[].plugin_report_state`.                |
| Read plugin config fields   | `GET /config` / `GET /config.yaml` | Expose `plugins.enabled`, `plugins.dir`, `plugins.store-sources`, `plugins.store-auth`, and `plugins.configs` as config facts.                                         |

### Confirmed Data Fields

`GET /plugin-store` returns:

- Global facts: `plugins_enabled`, `plugins_dir`, `sources`, `source_errors`
- Store identity: `store_id`, `source_id`, `source_name`, `source_url`, `id`, `name`, `description`, `author`, `version`, `repository`
- Install mechanics: `install_type`, `platforms`, `auth_required`, `auth_configured`
- Installed state: `installed`, `installed_version`, `configured`, `registered`, `enabled`, `effective_enabled`, `update_available`

`POST /plugin-store/:id/install` returns:

- `status`, `source_id`, `source_name`, `source_url`, `id`, `version`, `install_type`, `path`, `plugins_enabled`, `restart_required`

`POST /plugin-store/:id/uninstall` returns:

- `status`, `id`, `configured_removed`, `target_node_type`, `restart_required`, and `task` with delete operation details

`GET /nodes` adds:

- Root state: `plugin_report_required`, `plugin_report_statuses`
- Per-node state: `nodes[].plugin_report_state`, `nodes[].plugin_report_statuses`
- Report metadata: `node_type`, `node_id`, `client_ip`, `status`, `phase`, `ok`, `updated_at`, `platform`, and per-plugin status rows

Important backend nuance: plugin reports are self-reported observations. They do not prove installation authoritatively, do not expire by TTL, and do not make `nodes[].healthy` unhealthy by themselves.

### Not Confirmed By Current Contract

These exist in the reference frontend, but should not be implemented as product features until the backend contract exposes them:

- `GET /plugins`
- `PATCH /plugins/:id/enabled`
- `DELETE /plugins/:id`
- `GET /plugins/:id/config`
- `PUT/PATCH /plugins/:id/config`
- Dynamic plugin resource menus and `/plugin-pages/:pluginId/:menuIndex`
- Plugin OAuth provider integration
- In-product plugin config schema editing from `config_fields`
- Uploading local plugin binaries
- Editing `plugins.store-sources` or `plugins.store-auth` outside the config workspace

## Reference Frontend Capability Inventory

The open-source frontend implements these capability categories:

- Route gating by `supportsPlugin`
- Dedicated routes: `/plugins`, `/plugin-store`, `/plugin-pages/:pluginId/:menuIndex`
- Sidebar entries for plugin management and plugin store
- Dynamic plugin resource navigation derived from enabled plugin menus
- Plugin management list with search, global enabled status, plugin directory, discovered/configured/registered/effective counts
- Plugin enable/disable, delete, and config editing through a schema-driven sheet
- Plugin config field editors for string, number, integer, boolean, enum, array, and object fields
- Plugin store listing with search, installed/not installed/update filters, source errors, global disabled warning, and restart required warnings
- Install/update version selection
- Official vs third-party trust distinction using repository origin
- Third-party install confirmation requiring the user to retype a repository slug or plugin ID
- Missing store auth blocking install
- Polling after install/update/delete to wait for configured/registered/effective state

Useful values to retain:

- Security gating for non-official plugins
- Explicit auth-required state
- Source-level error reporting
- Version selection before install/update
- Refresh and polling after mutations
- Installed/update filters
- Persistent global disabled and restart-required warnings

Values to adapt:

- Replace card-grid-first store browsing with a table-first operations surface.
- Collapse plugin store and installed plugin state into one `Plugins` workspace instead of two sidebar routes.
- Replace multi-step modal gauntlet with one risk review dialog/sheet that shows identity, source, effects, version, and typed confirmation together.
- Avoid dynamic plugin pages until the backend contract provides plugin page/resource routes.

## Proposed Product Shape

### Information Architecture

Add one route:

- `/admin/plugins`

Place it under the `control` navigation group, near `System configuration` and `System nodes`.

Label direction:

- Navigation: `Plugins`
- Page title: `Plugins`
- Primary surface: `Plugin store`
- Secondary surface: `Cluster rollout`

Do not add separate top-level `Plugin Store` and `Plugin Management` routes in the first implementation. The confirmed API is store-centered, so one workspace with tabs/segments is easier to understand and avoids implying unsupported management capabilities.

### Page Structure

Use existing operations-console primitives:

- `PageHeader`
- `TableSurface`
- `Sheet`
- `AlertDialog`
- `Button`
- `Input`
- `Select`
- `Skeleton`
- `TableEmptyState`

Recommended layout:

1. Operational verdict panel
   - Ready: plugin store reachable and no failed required node reports
   - Global disabled: `plugins_enabled === false`
   - Source degraded: at least one `source_errors` entry or store list failed with registry error
   - Rollout attention: `plugin_report_required === true` and node state is `missing_report`, `reported_partial`, or `reported_failed`
   - Unsupported: route returns 404 or 405

2. Summary strip
   - Global plugin switch state from `plugins_enabled`
   - Plugin directory from `plugins_dir`
   - Registry sources count and source error count
   - Available plugins count
   - Installed plugins count
   - Updates available count
   - Node report state summary when `/nodes` is available

3. Toolbar
   - Search by plugin ID, name, author, repository, source name, source URL, tags if present
   - Status filter: all, installed, not installed, updates, auth required
   - Source filter when more than one source exists
   - Install type filter when both `github-release` and `direct` appear
   - Refresh action

4. Main table
   - Plugin: name, ID, optional logo as secondary decoration only
   - Source: source name and source ID
   - Version: registry version and installed version
   - Install type/platforms
   - State: installed, configured, registered, enabled, effective, update available
   - Auth: not required, configured, required but missing
   - Actions: details, install/update, uninstall

5. Detail sheet
   - Identity: name, ID, author, repository, homepage if present
   - Source: registry source, source URL, install type
   - Version: available, installed, update availability
   - Compatibility: direct-entry platforms
   - Trust: official/third-party classification, auth requirement
   - Current config facts: installed/configured/registered/enabled/effective
   - Rollout status: per-node plugin report table
   - Raw unsupported facts: show explicit unsupported copy instead of fake config editors

6. Mutation dialogs
   - Install/update dialog with version field, source, trust status, expected effects, and confirmation.
   - Third-party install requires typed confirmation in the same dialog.
   - Uninstall uses a destructive confirmation dialog naming the plugin and explaining cluster-wide delete tasks.

### Operational Verdict Logic

The page should answer "what is safe to do next" before showing the table.

Suggested verdict priority:

1. Disconnected: no management session.
2. Unsupported: `/plugin-store` is unavailable.
3. Store unavailable: non-404 load failure.
4. Source degraded: store loaded with `source_errors`.
5. Global disabled: `plugins_enabled === false`.
6. Rollout failed: any required node has `reported_failed`.
7. Rollout incomplete: any required node has `missing_report` or `reported_partial`.
8. Updates available: installed entries with `update_available === true`.
9. Ready: store loaded and no required plugin report issue is visible.

The page must never mark plugin install as "fully complete" based only on the install response. Refresh store state and, when available, node plugin reports.

## Key User Flows

### First Visit

1. User opens `Plugins`.
2. Page loads `/plugin-store` and `/nodes` if the nodes capability is available.
3. Header shows whether plugins are globally enabled and whether source/node states need attention.
4. If unsupported, show an explicit unsupported state with backend version/context, not an empty table.
5. If global plugins are disabled, keep the table visible but show a warning with a link/CTA to system configuration.

### Install Official Plugin

1. User filters/searches the table.
2. User clicks `Install`.
3. Dialog shows plugin identity, source, repository, version field, and install effects.
4. Official plugin uses normal confirmation.
5. Frontend calls `POST /plugin-store/:id/install` with `source` when needed and `version` when supplied.
6. Refresh `/plugin-store`; if nodes reports are available, refresh `/nodes`.
7. If `restart_required`, show a persistent warning.
8. If `plugins_enabled` is false, show success plus "installed but inactive" warning.
9. If reports are missing or pending, show "waiting for node report" rather than success-only toast.

### Install Third-Party Plugin

1. User clicks `Install` on a non-official plugin.
2. Dialog shows stronger warning: plugin code can run in Home/CPA process, source may be unaudited, restart or config apply may be required.
3. User must type the repository slug or plugin ID to enable the final action.
4. Same install/poll flow as official plugin.

Do not split this into three modal steps. A single risk review dialog is faster, easier to scan, and still blocks accidental install.

### Update Plugin

1. User filters to `Updates`.
2. Row shows installed version -> available version.
3. `Update` opens the same install dialog with update-specific copy.
4. Version field can pin another version if supplied.
5. After mutation, refresh store and reports.

### Uninstall Plugin

1. User opens row action or detail sheet action.
2. Destructive dialog explains that uninstall removes the store manifest and creates delete tasks for all CPA nodes.
3. Frontend calls `POST /plugin-store/:id/uninstall`.
4. Refresh store and node reports.
5. Show "delete task created" and surface pending/failed delete report states in rollout status.

### Auth Required

When `auth_required === true` and `auth_configured === false`:

- Disable install/update.
- Show an auth-required badge and row-level reason.
- Details sheet explains that `plugins.store-auth` references environment variables and tokens are not stored in manifests.
- Link to the config workspace or show a "configure in YAML/config" next action. Do not add token input fields in the plugin store page.

### Ambiguous Source

If backend returns `plugin_store_source_required`:

- Keep the install dialog open.
- Show the error inline.
- Require source selection from known entries with the same plugin ID.
- Retry with `?source=<source_id>`.

## Interaction Critique

Method: dual-agent after explicit sub-agent authorization.

- Assessment A: independent design review of this plan and the plugin implementation.
- Assessment B: deterministic detector plus browser/source evidence.
- Detector command: `node /Users/dylan/.agents/skills/impeccable/scripts/detect.mjs --json docs/plugin-interaction-plan.md src/features/plugins src/routes/admin.plugins.tsx`
- Detector result: clean `[]`.
- Browser evidence: port `3000` was already serving a different checkout, so no new dev server was started. Browser inspection against that server showed `/management.html#/admin/plugins` as Not Found because the embedded `managementRouteTree` in this checkout had not included the new route yet. That route-tree gap has been fixed in `src/app/router/management-route-tree.tsx`.

### Design Health Score

| #     | Heuristic                       | Score | Key issue                                                                                                      |
| ----- | ------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------- |
| 1     | Visibility of system status     |     3 | Verdict exists; rollout uncertainty must remain visible after mutation.                                        |
| 2     | Match system / real world       |     3 | Backend terms are accurate, but `configured`, `registered`, and `effective` still need operator-level framing. |
| 3     | User control and freedom        |     2 | Recovery after partial rollout needs durable controls, not only toasts.                                        |
| 4     | Consistency and standards       |     4 | Uses existing `PageHeader`, `TableSurface`, `Sheet`, `AlertDialog`, table, select, and i18n patterns.          |
| 5     | Error prevention                |     2 | Third-party confirmation is strong; auth and duplicate-source recovery need visible paths.                     |
| 6     | Recognition rather than recall  |     3 | Table and sheet expose facts, but operators must still interpret several backend state flags.                  |
| 7     | Flexibility and efficiency      |     3 | Search, status filter, source filter, update path, and refresh support repeated operation.                     |
| 8     | Aesthetic and minimalist design |     3 | Restrained and table-first; the summary card strip can still compete with the verdict.                         |
| 9     | Error recovery                  |     2 | Source errors and unsupported states exist; mutation error recovery needed inline handling.                    |
| 10    | Help and documentation          |     2 | Critical concepts need explanation at decision points, not only in descriptions.                               |
| Total |                                 | 27/40 | Solid operational foundation; the main improvement area is decision clarity.                                   |

### Priority Issues

**[P1] Avoid implying unsupported plugin management APIs.**
The reference frontend supports plugin config editing, enable/disable, dynamic plugin pages, and plugin deletion through `/plugins` routes. Those routes are absent from the current backend contract. The first implementation must not expose those controls.

**Fix:** ship store install/update/uninstall plus rollout observation only. Leave config editing and dynamic plugin pages behind capability gates for a later backend contract.

**[P1] Store-card browsing is the wrong primary pattern for this product.**
Plugin cards make sense for discovery, but Home Management Center is an operations console. Operators need comparison, state scanning, auth blockers, source errors, and rollout status.

**Fix:** use a compact table as the primary surface and a detail sheet for rich metadata.

**[P1] Install success is not the same as cluster readiness.**
The install endpoint writes config; CPA nodes apply and self-report asynchronously. A success toast alone would overstate the result.

**Fix:** after mutation, refresh store state and node report state. Use pending/partial/failed report badges and avoid claiming authoritative proof. Implementation now includes a rollout column plus a persistent recent-change notice that survives toast dismissal.

**[P1] Auth blockers must offer recovery.**
The store can report `auth_required=true` and `auth_configured=false`; blocking install with only a disabled button tooltip is not enough for touch devices or first-time operators.

**Fix:** show the auth-required badge, disable install/update, and include a visible config-workspace recovery link. Do not collect token values in the plugin page.

**[P1] Duplicate-source recovery must be inline.**
The backend can return `plugin_store_source_required` when the same plugin ID appears in multiple sources.

**Fix:** keep the install dialog open, show source selection when multiple known entries share the plugin ID, and render source-required errors inline instead of relying only on a toast.

**[P2] Third-party risk review should be strict but not slow.**
The reference frontend's multi-step gauntlet protects users but creates modal fatigue.

**Fix:** use one risk review dialog with all identity/source/effect facts visible and a typed confirmation for non-official repositories.

**[P2] Store auth belongs in config, not an ad hoc token form.**
Backend `plugins.store-auth` references environment variable names; token values are not stored in manifests.

**Fix:** show auth-required blockers and route users to configuration guidance. Do not collect token secrets in the plugin store page.

### Persona Red Flags

**Power operator:** can filter updates quickly, but needs durable rollout state after update/uninstall. The implementation now keeps a recent-change notice and row rollout badge, but deeper per-plugin node summaries should remain a future polish target.

**First-time self-hosted operator:** needs help moving from “auth required” to the correct config area. The implementation now shows a visible config recovery link and keeps token collection out of the plugin page.

### Questions To Revisit

1. Should rollout become a first-class table column in all plugin views, or only after a mutation/report requirement exists?
2. Should `configured`, `registered`, and `effective` collapse into fewer operator-facing states?
3. Should `/capabilities` expose plugin store support so navigation can be gated without probing registries?

## Implementation Slices

### Slice 1: Backend Adapter And Capability

Files:

- `src/lib/api/management/plugin-store.ts`
- `src/lib/api/management/system-nodes.ts`
- `src/lib/api/management/types.ts`
- `src/lib/api/management/probe.ts`

Work:

- Add normalized plugin store types.
- Add `fetchPluginStore`, `installPluginFromStore`, and `uninstallPluginFromStore`.
- Preserve optional metadata fields such as `logo`, `homepage`, `license`, and `tags` when present, but do not require them.
- Normalize source errors.
- Extend system node normalization to preserve plugin report root and per-node statuses.
- Decide whether to add a `pluginStore` capability probe. If probing `/plugin-store` is too expensive because it queries registries, keep route visible and handle unsupported state inside the page.

### Slice 2: Feature Hook

Files:

- `src/features/plugins/use-plugin-workbench.ts`

Work:

- Query plugin store when connected and capability/session are ready.
- Query node reports when `capabilities.nodes` is true.
- Derive verdict, counts, filters, mutation pending state, and row actions.
- Poll after install/update/uninstall with bounded timeout.
- Keep backend errors mapped into unsupported, auth, registry, validation, and generic request states.

### Slice 3: Page UI

Files:

- `src/features/plugins/plugins-workbench-page.tsx`
- `src/routes/admin.plugins.tsx`
- `src/app/router/management-route-tree.tsx`
- `src/components/shell/navigation.ts`

Work:

- Add the `Plugins` route under Control navigation.
- Build disconnected, loading, unsupported, error, empty, no-match, partial-source, global-disabled, and pending-report states.
- Use `TableSurface` for the plugin list.
- Use detail `Sheet` for plugin metadata and rollout status.
- Use `AlertDialog` for uninstall.
- Use a dialog/sheet for install/update with version selection and third-party typed confirmation.

### Slice 4: Config Integration

Files:

- `src/features/config/config-workbench-page.tsx`
- `src/lib/api/management/config.ts`
- i18n locale files

Work:

- Add a Plugins config section only for fields the backend contract supports and the current config adapter can safely edit.
- Safe first fields: `plugins.enabled`, `plugins.dir`, `plugins.store-sources`.
- Treat `plugins.store-auth` carefully because it references environment variable names and must not collect secret values.
- Do not edit `plugins.configs` through the general config UI in the first slice.

This slice can be deferred if the first route only links to existing YAML/config support.

### Slice 5: Internationalization

Files:

- `src/lib/i18n/locales/zh-CN.ts`
- `src/lib/i18n/locales/zh-TW.ts`
- `src/lib/i18n/locales/en.ts`
- `src/lib/i18n/locales/ru.ts`

Work:

- Add visible UI copy for navigation, plugin page states, filters, table headings, badges, dialogs, errors, and toasts in all four locales.
- Do not translate plugin IDs, source IDs, versions, repository slugs, config keys, route paths, or protocol/platform literals.

### Slice 6: Verification

Minimum checks after implementation:

```bash
bun run routes:generate
bun run typecheck
```

Recommended review checks before final PR:

```bash
bun run format:check
bun run lint
bun run build
```

Manual scenarios:

- Backend without `/plugin-store` returns unsupported state.
- Registry source failure returns source error state without hiding successful sources.
- Global `plugins.enabled=false` shows installed-but-inactive state.
- `auth_required=true` and `auth_configured=false` blocks install.
- Duplicate plugin ID across sources requires source selection.
- Install official plugin with default version.
- Install third-party plugin requires typed confirmation.
- Update installed plugin.
- Uninstall installed plugin and show delete task/report status.
- `/nodes` unavailable: plugin page still works but rollout panel shows unsupported observation.
- `/nodes` available with `missing_report`, `reported_partial`, `reported_failed`, and `reported_ok`.

## Open Questions For Backend/Product

1. Should `/capabilities` expose `plugin_store` so the frontend can gate navigation without hitting registries during probing?
2. Are `configured`, `registered`, `enabled`, and `effective_enabled` guaranteed fields in `GET /plugin-store`, or should they be treated as optional compatibility fields?
3. Should frontend expose direct editing for `plugins.enabled`, `plugins.dir`, and `plugins.store-sources`, or should plugin setup remain in the existing config workspace/YAML path for now?
4. Is uninstall intended as the only supported way to disable a store-installed plugin, or will a per-plugin enable/disable route be added?
5. Should node plugin reports include stable per-plugin fields for `install_status`, `load_status`, and `delete_status`, or should the frontend display them as flexible key/value details?
