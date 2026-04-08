# 0007 — Hand-rolled SVG charts

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Pip-Token displays bar charts on STATS, HISTORY, and several LIVE pages. The natural choice for a TypeScript project would be Chart.js, D3, or Recharts. But Pip-Token's aesthetic is highly opinionated — chunky monospace labels, specific opacity tiers for stacked bars, red alarm markers in specific positions, no animations — and chart libraries are designed to fit modern dashboard conventions, not retro CRT aesthetics.

**Decision.** All charts are hand-rolled inline SVG. The mockups in `mockups/*.html` demonstrate the approach. A small set of helper functions in `src/webview/ui/components/` (`barChart.ts`, etc.) handles the common patterns.

**Consequences.** The aesthetic stays pixel-perfect because we control every element. Bundle size is significantly smaller — a chart library is hundreds of kilobytes; our helpers are kilobytes. There are no library upgrades to manage. The downside is that any new chart type (e.g. line charts, if we add them in v2) must be built from scratch.

**Alternatives considered.**
- Chart.js (rejected — fights the aesthetic at every turn, especially the no-animation requirement)
- D3 (rejected — too much abstraction for our simple needs; we'd write helpers around D3 anyway)
- Recharts (rejected — React-only, and we deliberately don't use React)
- Plain canvas (rejected — SVG is more accessible and easier to debug in browser DevTools)
