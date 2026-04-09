# src/webview/ — Webview Conventions

## No frameworks

The webview is plain HTML/CSS/TypeScript — no React, no Vue, no Tailwind. State is held in module-level variables; updates trigger plain DOM updates via small render functions per page.

## Messaging

`messageBus.ts` is the **only** path between webview and extension. Never use `window.postMessage` directly.

## Styling

- All Pip-Boy styling tokens come from `styles.css` CSS variables — never hardcode colours
- The colour palette is monochrome green plus red ONLY for alarms — see DESIGN.md section 3
- **No remote fonts.** No `@import` from fonts.googleapis.com or any CDN. If VT323 is bundled, it lives as a woff2 in `assets/fonts/` via `@font-face`. See ADR 0004.

## Runtime file access

- **Never read from `docs/` at runtime.** The `.vsix` strips `docs/`. Anything the webview needs is baked into a `.ts` module at build time.
- `glossaryContent.ts` is generated from `docs/GLOSSARY.md` by a pre-build step — never edit it directly.

## Charts and effects

- Charts are inline SVG, hand-rolled — don't import a chart library
- Chart tooltips use transparent SVG hit-area rects with `data-*` attributes; the tooltip div is positioned via JS mousemove. Values are stored as floats — always use `parseFloat`, never `parseInt`, when reading them back.
- Chart legends render below the SVG inside the `.chart-area` container (which uses `flex-direction: column`)
- CRT flicker is a CSS animation, ~80ms, on the page container. The toggle is deferred to post-v0.1; flicker is always on.
- Blip sound uses Web Audio API synthesis (no audio files)
- The webview survives VS Code reloads (`retainContextWhenHidden: true`) — see ADR 0020

## Custom dropdowns

The session/project selector uses a custom `.pip-select` dropdown (not a native `<select>`) so the dropdown menu matches the Pip-Boy aesthetic. Native `<select>` dropdowns are OS-rendered and cannot be styled inside a VS Code webview. The settings dropdowns on the about/onboarding pages still use native `<select>` (small fixed option lists where it matters less).

## Sync indicator

When a data resync is triggered, `setSyncing(true)` (from `statusBar.ts`) makes the status bar show a blinking "RESYNCING DATA" message on every page. It auto-clears when the next `updateStatusBarData()` call arrives with fresh data. Any new resync-like operation should call `setSyncing(true)` before sending its message.

## Settings changes and data refresh

When a setting that affects computed data (currency, plan tier) changes, the webview must re-request pageData for the current page — not just update local UI state. The `settingsChanged` handler in `main.ts` sends a `requestPageData` message for these keys so the extension recomputes with the new value.

## Error display

- Errors show as subtle in-panel Pip-Boy-themed warnings (e.g., "PARSER: 3 LINES SKIPPED")
- Never use VS Code native toast notifications for errors
- Advisory-style messages in green-on-dark, consistent with the aesthetic
