# Changelog

All notable changes to Pip-Token will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-04-08

First public release.

### Added
- Real-time token tracking from Claude Code session logs
- LIVE dashboard: SESSION (burn rate, peak/off-peak split, time-to-limit), CONTEXT (fill bar, utilisation), CACHE (hit/miss tracking, expiry countdown)
- STATS pages: 7-day TOKENS chart and COST estimation in 6 currencies
- HISTORY pages: WEEK, MONTH, QUARTER, YEAR views with stacked peak/off-peak bars
- TIPS page with 20 curated tips across 4 categories
- ABOUT page with settings, dashboard sync, and glossary
- 4-step onboarding wizard with plan tier and currency selection
- Advisory engine with 19 contextual rules
- In-window status bar (PEAK/OFF-PEAK, context fill, burn rate, weekly cost)
- Pip-Boy 3000 aesthetic: monochrome phosphor green, CRT flicker, scan lines
- Web Audio blip sound on navigation
- Owl mascot per section (5 poses)
- SQLite storage with WAL mode for multi-window safety
- Content-addressed turn IDs for idempotent ingestion
- Reduced-motion support via prefers-reduced-motion media query
