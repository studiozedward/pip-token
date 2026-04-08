# src/ — Extension Source Conventions

## TypeScript style

- Strict mode enabled (`"strict": true` in tsconfig.json)
- No `any` — use `unknown` and narrow, or define a proper type
- Prefer `interface` over `type` for object shapes
- File-per-export-class convention

## Import ordering

1. External packages (e.g., `vscode`, `better-sqlite3`)
2. Internal absolute imports (e.g., `../data/db`)
3. Relative imports (e.g., `./helpers`)

## Where to put new code

- `utils/` — pure functions with no side effects (date formatting, number formatting)
- `domain/` — business logic (cost calculation, peak hour classification, advisory rules)
- `parsing/` — everything related to reading and interpreting Claude Code's log files
- `data/` — SQLite database access, schema, repositories
- `webview/` — everything that runs inside the VS Code webview panel

## Hard rules

- **Don't add a frontend framework.** The webview is plain HTML/CSS/TS. No React, no Vue, no Svelte, no Tailwind.
- **Don't add a chart library.** Charts are inline SVG, hand-rolled.
- **No network calls anywhere in src/.** See ADR 0004. This includes font CDNs, telemetry, update checks, and analytics.
