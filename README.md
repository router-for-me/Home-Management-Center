<p align="center">
  <img src="src/assets/brand/favicon.png" width="72" height="72" alt="" />
</p>

<h1 align="center">Home Management Center</h1>

<p align="center">
  The web console for <a href="https://github.com/router-for-me/CLIProxyAPIHome">CLIProxyAPIHome</a>.<br />
  Operators manage the gateway and its credentials. Users find models, manage their API keys, and track usage.
</p>

<p align="center">
  <strong>English</strong> · <a href="README_CN.md" lang="zh-CN">简体中文</a><br />
  <a href="#quick-start">Quick start</a> · <a href="#console-tour">Console tour</a> · <a href="#development">Development</a>
</p>

[![Administrator dashboard showing gateway readiness, token consumption, request volume, and request health](docs/screenshots/dashboard-en.png)](docs/screenshots/dashboard-en.png)

_All screenshots use example data. Select an image to view it at full size._

## Quick start

Official Home binaries and Docker images include both workspaces. Start Home, then open the entry for your role. [Home installation guide](https://github.com/router-for-me/CLIProxyAPIHome#deploying-an-official-release)

- **Administrator console** · Sign in with your Home management key.<br />
  `http://localhost:8327/management.html`
- **User workspace** · Sign in with your Home user account.<br />
  `http://localhost:8327/user.html`

For a remote instance, use its hostname and port. Keep the management key private and protect remote administrative access with HTTPS and server-side access controls.

## Console tour

### Upstream account credentials

Open **Upstream → Account Credentials** to see which accounts are enabled and how much quota remains. Add accounts through OAuth or import credential files. Select an account to inspect its models and edit its metadata. The adjacent **Model Providers** tab holds provider API keys.

[![Upstream account credentials with provider names, enabled states, and quota remaining for each account](docs/screenshots/upstream-accounts-en.png)](docs/screenshots/upstream-accounts-en.png)

### User model catalog

Users can search by model ID and filter by provider, input modality, or tool support. Once signed in, they can see which models their own keys can call and compare published input and output prices.

[![User model catalog showing accessible models, context limits, supported inputs, and per-token pricing](docs/screenshots/model-catalog-en.png)](docs/screenshots/model-catalog-en.png)

### Other operator tasks

- **Manage access.** Issue client keys and set access rules for users.
- **Investigate requests.** Follow a failed request from usage records into call diagnostics or runtime logs.
- **Review billing.** Set model prices and review usage costs and reports.
- **Change configuration.** Edit gateway settings and review the diff before saving.

The interface supports English, Simplified Chinese, Traditional Chinese, and Russian. Choose a language or follow the browser setting. Light and dark themes are available on desktop and mobile in Chrome, Edge, Firefox, and Safari.

## Development

Use Node.js 24 or later, Bun 1.3 or later, and a running Home instance. Start the development server from this repository.

```sh
bun install --frozen-lockfile
bun run dev
```

Open `http://localhost:3000/management.html` or `http://localhost:3000/user.html`. The development proxy points to `http://127.0.0.1:8327` by default.

| Task                  | Command                                |
| --------------------- | -------------------------------------- |
| Check types and lint  | `bun run typecheck` and `bun run lint` |
| Check formatting      | `bun run format:check`                 |
| Build and preview     | `bun run build` and `bun run preview`  |
| Build assets for Home | `bun run build:embedded`               |

The frontend uses React 19, TypeScript, TanStack Router and Query, Tailwind CSS, and Rsbuild. The project scripts also cover route generation, formatting, and unused-code checks. [Scripts and dependencies](package.json)

Home's build guide explains how to package the contents of `dist/` with the backend. [Build Home with the console](https://github.com/router-for-me/CLIProxyAPIHome#building-and-releasing-the-bundled-frontend)

For UI changes, include a screenshot and the checks you ran. For bug reports, include the Home version, browser, and steps to reproduce. [Product guide](PRODUCT.md) · [Design guide](DESIGN.md) · [Contributor instructions](AGENTS.md)

## License

[MIT](LICENSE)
