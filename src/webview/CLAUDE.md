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
- CRT flicker is a CSS animation, ~80ms, on the page container
- Blip sound uses Web Audio API synthesis (no audio files)
- The webview survives VS Code reloads (`retainContextWhenHidden: true`) — see ADR 0020

## Settings changes and data refresh

When a setting that affects computed data (currency, plan tier) changes, the webview must re-request pageData for the current page — not just update local UI state. The `settingsChanged` handler in `main.ts` sends a `requestPageData` message for these keys so the extension recomputes with the new value.

## Error display

- Errors show as subtle in-panel Pip-Boy-themed warnings (e.g., "PARSER: 3 LINES SKIPPED")
- Never use VS Code native toast notifications for errors
- Advisory-style messages in green-on-dark, consistent with the aesthetic
