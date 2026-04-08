# 0008 — Plain HTML webview, no frontend framework

**Status.** Accepted

**Date.** 2026-04-08

**Context.** VS Code webviews can host any web technology. Most extensions use React or Vue for non-trivial UI. Pip-Token has a moderate amount of UI: 13 pages, dynamic charts, live updates from the extension host.

**Decision.** Pip-Token's webview is plain TypeScript, plain HTML, plain CSS. No React, no Vue, no Svelte, no Tailwind. State is held in module-level variables; updates from the extension host trigger plain DOM updates via small render functions per page.

**Consequences.** The bundle is small. Build time is fast. There are no framework upgrades to chase. Anyone reading the code only needs to know HTML/CSS/TS, not framework-specific patterns. The downside is that we manually wire up DOM updates instead of relying on a reactive framework — this is fine for 13 pages but would become painful at 50+. We're explicitly accepting that limit.

**Alternatives considered.**
- React (rejected — adds complexity and bundle size for a project this size)
- Vue (rejected — same as React)
- Svelte (rejected — would bring real benefits but adds a build step we don't need)
- Lit / Web Components (rejected — would be a reasonable choice but adds nothing over plain DOM for 13 pages)
