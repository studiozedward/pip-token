# Pip-Token — Repository Setup

Instructions for Claude Code to initialise the GitHub repository before any code is written. This is **Milestone 0** in the build plan — complete this before starting Milestone 1 (skeleton).

Read DESIGN.md and GLOSSARY.md first for product context, then this file for the repo plumbing.

---

## Goal

Set up a public GitHub repository with the right structure, conventions, and documentation scaffolding so that the rest of the build has a clean foundation. By the end of Milestone 0, the repo should:

- Be public on GitHub at `github.com/studiozedward/pip-token`
- Have a clear directory structure
- Have all the design files in their permanent locations
- Have working CI (even if there are no tests yet)
- Have the conventions documented so future commits — by Claude Code or anyone else — follow the same patterns
- Show a clear "v0.1 — work in progress" status to anyone who finds it

The repo is built in public from day 1. Don't be precious about it being incomplete. Visible early progress is the point.

---

## Directory structure

```
pip-token/
├── README.md                       # Public-facing intro, screenshots, install
├── LICENSE                         # MIT
├── CHANGELOG.md                    # User-facing release notes (Keep a Changelog format)
├── CLAUDE.md                       # Project-wide conventions for Claude Code (root level)
├── LESSONS.md                      # Running log of lessons learned during the build
├── .gitignore                      # node_modules, out/, *.vsix, .DS_Store, .env
├── .vscodeignore                   # What gets excluded from the .vsix package
├── package.json                    # Extension manifest
├── package-lock.json
├── tsconfig.json
├── esbuild.config.js
│
├── docs/                           # All design and decision documentation
│   ├── DESIGN.md
│   ├── GLOSSARY.md
│   ├── ARCHITECTURE.md
│   ├── REPO_SETUP.md               # This file
│   ├── TOKEN_DATA_RESEARCH.md
│   ├── CLAUDE_CODE_BUILD_PROMPT.md
│   ├── mockups.html
│   └── decisions/                  # Architecture Decision Records
│       ├── README.md               # Index of ADRs and how to write new ones
│       ├── 0001-monochrome-only.md
│       ├── 0002-no-vscode-status-bar.md
│       └── ...
│
├── assets/                         # Static art (referenced from webview AND README)
│   ├── owl-live.png
│   ├── owl-stats.png
│   ├── owl-history.png
│   ├── owl-tips.png
│   └── owl-about.png
│
├── src/                            # Extension source (Claude Code builds this)
│   ├── CLAUDE.md                   # Conventions for everything under src/
│   ├── extension.ts                # VS Code activation entry point
│   │
│   ├── webview/
│   │   ├── CLAUDE.md               # Webview-specific patterns and gotchas
│   │   ├── PipTokenPanel.ts
│   │   ├── messageBus.ts
│   │   └── ui/
│   │       ├── index.html
│   │       ├── styles.css
│   │       ├── main.ts
│   │       ├── router.ts
│   │       ├── pages/
│   │       └── components/
│   │
│   ├── data/
│   │   ├── CLAUDE.md               # Schema rules, migration approach
│   │   ├── db.ts
│   │   ├── schema.sql
│   │   └── repositories/
│   │
│   ├── parsing/
│   │   ├── CLAUDE.md               # JSONL format quirks, version detection notes
│   │   ├── claudeCodeWatcher.ts
│   │   ├── jsonlParser.ts
│   │   ├── tokenExtractor.ts
│   │   ├── peakHourClassifier.ts
│   │   ├── limitHitDetector.ts
│   │   └── activeSessionTracker.ts
│   │
│   ├── domain/
│   │   ├── CLAUDE.md               # Business logic conventions, pricing source rules
│   │   ├── advisoryEngine.ts
│   │   ├── advisoryRules.ts
│   │   ├── costCalculator.ts
│   │   ├── pricing.json
│   │   ├── thresholdEstimator.ts
│   │   ├── burnRateCalculator.ts
│   │   ├── peakHourSchedule.ts
│   │   └── planTierDefaults.ts
│   │
│   └── utils/
│       ├── dateUtils.ts
│       ├── formatNumber.ts
│       ├── currencyFormatter.ts
│       └── logger.ts
│
├── test/
│   ├── CLAUDE.md                   # How fixtures work, naming conventions
│   ├── jsonlParser.test.ts
│   ├── ...
│   └── fixtures/
│       └── sample-sessions/        # Anonymised real Claude Code logs
│
├── out/                            # esbuild output (gitignored)
│
└── .github/
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.md
    │   ├── feature_request.md
    │   └── parser_compatibility.md
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
        └── ci.yml
```

---

## Distributed CLAUDE.md convention

Pip-Token follows Boris Cherny's distributed CLAUDE.md pattern: a small root `CLAUDE.md` containing only project-wide context, plus directory-scoped `CLAUDE.md` files in subdirectories that hold context relevant only to that subdirectory. Claude Code automatically loads the closest CLAUDE.md to wherever it's working, so the right context appears at the right time without overwhelming the global context window.

**Why distribute it.** A single huge root CLAUDE.md becomes noise — most tasks only need 10% of what's in it. Splitting it means parser-specific quirks live next to the parser, webview gotchas live next to the webview, and root only contains the things that are genuinely always relevant.

### Where each CLAUDE.md lives and what it contains

**`/CLAUDE.md` (root)** — Always loaded. Keep this **short**, ideally under 100 lines.

Contents:
- One-paragraph project description (what Pip-Token is)
- Tech stack one-liner (TypeScript, VS Code Extension API, SQLite, no frameworks)
- Build/test/run commands (`npm install`, `npm run build`, `npm test`, `F5 in VS Code`)
- Branching convention (`main` always shippable, feature branches, squash merge)
- Commit convention (Conventional Commits — see section below)
- Where the design lives (`docs/DESIGN.md` is authoritative, mockups are visual reference)
- Where lessons learned live (`LESSONS.md` — check it before tackling tricky areas)
- A pointer telling Claude Code to read the closest sub-directory CLAUDE.md when working in a subfolder

**`/src/CLAUDE.md`** — Loaded when working anywhere under `src/`.

Contents:
- TypeScript style conventions (strict mode, no `any`, prefer `interface` over `type` for object shapes)
- Import ordering (external first, then internal absolute, then relative)
- File-per-export-class convention
- Where to put new utilities (utils/ for pure functions, domain/ for business logic, parsing/ for log handling)
- "Don't add a frontend framework" reminder
- "Don't add a chart library" reminder
- "No network calls anywhere in src/" rule

**`/src/parsing/CLAUDE.md`** — Loaded when working on the parser.

Contents:
- The Claude Code JSONL format is undocumented and may change between versions
- The actual field names confirmed by parser investigation (filled in once Q1 from TOKEN_DATA_RESEARCH.md is answered)
- Defensive parsing rule: any unrecognised line is logged and skipped, never crashes
- Version detection approach
- Where sample fixtures live (`test/fixtures/sample-sessions/`)
- The cache field availability situation (Q2)
- The context breakdown availability situation (Q11)
- How peak hour classification works (timestamp → Pacific time → window check)
- How active session tracking works (2-hour file mtime threshold, defined in one place)

**`/src/webview/CLAUDE.md`** — Loaded when working on the UI.

Contents:
- The webview is plain HTML/CSS/TypeScript — no React, no Vue, no Tailwind
- The `messageBus.ts` is the only path between webview and extension; never use `window.postMessage` directly
- All Pip-Boy styling tokens come from `styles.css` CSS variables — never hardcode colours
- The colour palette is monochrome green plus red ONLY for alarms — see DESIGN.md section 3
- **No remote fonts. No `@import` from fonts.googleapis.com or any CDN.** If VT323 is bundled, it lives as a woff2 file in `assets/fonts/` and is referenced via `@font-face` with a local path. See ADR 0004. If you see a remote `@import` in the mockup CSS, do not copy it.
- **Never read from `docs/` at runtime.** The `.vsix` package strips the `docs/` directory — anything the webview needs from there is baked into a `.ts` module at build time. The ABOUT / GLOSSARY page imports `glossaryContent.ts`, which is generated from `docs/GLOSSARY.md` by a pre-build step. `glossaryContent.ts` is generated, not hand-written — never edit it directly; edit `docs/GLOSSARY.md` and rebuild. See ARCHITECTURE §"Build-time asset baking".
- Charts are inline SVG, hand-rolled — don't import a chart library
- The webview has limited audio support; the blip sound uses Web Audio API to synthesise on the fly
- CRT flicker is a CSS animation, ~80ms, on the page container
- The webview should survive VS Code reloads (`retainContextWhenHidden: true`)

**`/src/data/CLAUDE.md`** — Loaded when working on storage.

Contents:
- SQLite via better-sqlite3, synchronous API
- Database lives in `context.globalStorageUri` per VS Code convention
- **Concurrency:** on every connection open, set `PRAGMA journal_mode = WAL` and `PRAGMA busy_timeout = 5000`. See ADR 0018.
- **Atomic counter updates:** never read-modify-write counter columns. Use `UPDATE windows SET peak_input_tokens = peak_input_tokens + ? WHERE window_id = ?` so two VS Code windows racing on the same row both succeed. The application layer must not hold a counter value in memory and write it back — the SQL expression does the increment.
- **Idempotent writes:** turn inserts use `INSERT OR IGNORE` because `turn_id` is content-addressed. See ADR 0017 and DESIGN §7.
- Schema migrations are numbered SQL files in the migrations folder
- Schema version tracked in a `schema_version` table
- Append-only writes everywhere except settings (singleton) and current window counters
- Repositories are the only path to the database; pages never query directly

**`/src/domain/CLAUDE.md`** — Loaded when working on business logic.

Contents:
- Pricing comes from `pricing.json` — single source of truth, never hardcode prices anywhere else
- Peak hour schedule comes from `peakHourSchedule.ts` — single source of truth, never hardcode the window anywhere else
- Plan tier defaults come from `planTierDefaults.ts` — single source of truth for cold-start estimates
- The advisory engine reads rules from `advisoryRules.ts` (a static array), never inlines rules in pages
- All money math uses integers in minor units (pence, cents) and converts at display time
- All dates are stored as ISO 8601 in UTC, converted to local timezone at display time

**`/test/CLAUDE.md`** — Loaded when working on tests.

Contents:
- Test runner is Vitest
- Test files live next to nothing — they all live in `test/` mirroring the `src/` structure
- Fixture sessions in `test/fixtures/sample-sessions/` are real Claude Code logs with sensitive content stripped
- Fixture files are named `<scenario>-<claude-code-version>.jsonl` so version regressions are obvious
- Parser tests should cover at least: normal turn, tool use, error response, malformed line, unknown field
- Don't commit fixtures with real file paths or API keys. Fixture sanitisation is enforced by CI and by `.gitignore` allowlist, not by memory. Before committing a fixture:
    1. Replace absolute paths (`/Users/...`, `/home/...`, `C:\Users\...`) with `/path/to/project`
    2. Remove any string starting `sk-ant-` or `Bearer `
    3. Skim for proprietary content from other projects
    4. Rename the file to end in `-sanitised.jsonl` so the gitignore allowlist picks it up
  CI will fail the build if any file under `test/fixtures/` contains unsanitised patterns.

### When to add a new CLAUDE.md

Add a new directory-scoped CLAUDE.md whenever:
- A subdirectory has 3+ files with non-obvious conventions
- You catch yourself explaining the same gotcha twice
- The root CLAUDE.md is starting to feel cluttered with subsystem-specific notes

Keep each CLAUDE.md short. If one starts running over 80 lines, that's a signal it should be split or some content should move into LESSONS.md or an ADR.

---

## LESSONS.md convention

`LESSONS.md` is a running log of non-obvious things learned during the build. It lives at the project root. The point is to make sure mistakes happen at most twice — once when they're learned, and never again because the lesson was captured.

### When to write a lesson

Add an entry whenever:
- A bug took more than 30 minutes to track down and the cause was non-obvious
- A design assumption from DESIGN.md turned out to be wrong and you had to work around it
- An API or library behaved differently than the docs suggested
- A platform-specific quirk (Windows vs Mac, different VS Code versions, different Node versions) caused unexpected behaviour
- A "clever" approach was tried and abandoned because something simpler worked better
- You had to revisit the same area twice because the first solution didn't stick

Don't add an entry for routine bugs, syntax errors, or anything you'd remember anyway.

### Format

Each lesson is a small dated section. Newest at the top. Format:

```markdown
## YYYY-MM-DD — Short title

**Context.** What were we trying to do?

**Problem.** What went wrong, in concrete terms.

**What we tried.** Approaches that didn't work, and why.

**What worked.** The solution we settled on.

**Lesson.** The general principle to remember next time.

**Where the fix lives.** File paths or commit SHAs so future-you can find it.
```

Keep each entry under 30 lines. If a lesson is bigger than that, it probably wants to become an ADR in `docs/decisions/` instead.

### Example seed entry

```markdown
## 2026-04-08 — JSONL parser missed multiline turns

**Context.** Building the M2 parser for Claude Code session logs.

**Problem.** Parser was treating each JSONL line as a complete turn, but
some Claude Code versions write a single turn across multiple lines when
the response is very large. Token counts came out roughly half of what
the dashboard showed.

**What we tried.** Stricter line splitting (no help — the format is
genuinely multi-line). Reading the whole file and JSON.parse-ing it (no
— it's not valid JSON, just a stream of objects).

**What worked.** Buffer lines until we see a closing brace at the start
of a line, then attempt to parse the buffer.

**Lesson.** Don't assume "JSONL" means strictly one-object-per-line —
some producers chunk large objects across lines.

**Where the fix lives.** src/parsing/jsonlParser.ts, commit a3f81d2.
```

### How Claude Code uses LESSONS.md

The root CLAUDE.md instructs Claude Code to read LESSONS.md before starting any task that touches a previously-problematic area. The build prompt also reminds Claude Code to add new entries when warranted. Don't let it become a graveyard of forgotten lessons — entries should be revisited and pruned when they become irrelevant (e.g. a lesson about a Claude Code version that's no longer supported).

---

## Architecture Decision Records (ADRs)

`docs/decisions/` contains numbered ADRs documenting significant choices. Each is a short markdown file with the format:

```markdown
# 0001 — Title of decision

**Status.** Accepted | Superseded by 0017 | Deprecated

**Date.** YYYY-MM-DD

**Context.** What problem were we deciding about?

**Decision.** What did we decide?

**Consequences.** What does this mean for the project? Both upsides and downsides.

**Alternatives considered.** What else did we look at, and why did we not pick it?
```

Keep ADRs short — 100-300 words each. Number sequentially, never reuse a number even if a decision is superseded (write a new ADR that supersedes the old one).

### Initial ADR set (create during Milestone 0)

The following decisions have already been made during the design phase. Create an ADR for each so the reasoning is captured permanently:

1. **0001 — Monochrome aesthetic only.** No second colour except red for alarms.
2. **0002 — No VS Code native status bar in v1.** In-window only.
3. **0003 — Peak/off-peak as raw counters, not multipliers.** Don't infer multipliers.
4. **0004 — No telemetry, no network calls without consent.** v1 has zero network calls; opt-in analytics deferred to v2.
5. **0005 — Distributed CLAUDE.md pattern.** Per Boris Cherny.
6. **0006 — SQLite via better-sqlite3.** Synchronous, file-based.
7. **0007 — Hand-rolled SVG charts.** No chart library.
8. **0008 — Plain HTML webview.** No frontend framework.
9. **0009 — Active session = file modified within 2 hours.**
10. **0010 — `[ALL PROJECTS]` aggregation hidden on per-session pages.** Context and cache can't honestly aggregate.
11. **0011 — LEARNING state instead of zeros or fake projections.** Honest empty states.
12. **0012 — Manual dashboard sync for chat/API usage.** No browser extension in v1.
13. **0013 — Cache TTL assumed 5 minutes.** Detection is unreliable.
14. **0014 — Single pricing.json source of truth.** All cost math reads from one file.
15. **0015 — Public from day 1.** Build in transparency.
16. **0016 — MIT License.** Maximises adoption, matches VS Code extension convention.
17. **0017 — Idempotent turn ingestion via content-addressed IDs.** Turn IDs derived from a hash of turn contents so re-reads dedupe automatically.
18. **0018 — SQLite concurrency: WAL mode, busy_timeout, atomic increments.** Multi-window VS Code safe by default.

You can lift the rationale for each from DESIGN.md, GLOSSARY.md, and the build prompt. Each ADR is ~10 minutes of writing.

---

## Initial files to create in Milestone 0

The following files need to exist by the end of Milestone 0. Each has a template below where it's not obvious what to write.

### `README.md`

```markdown
# Pip-Token

A VS Code extension that helps Claude Code users track their token usage in real time, with a Fallout Pip-Boy aesthetic.

> **Status: v0.1 — work in progress.** Built in public. Not yet on the VS Code marketplace.

[Screenshot of LIVE/SESSION page]

## What it does

- Live token counters from your Claude Code sessions
- Peak vs off-peak split so you can see which hours are eating your limits
- Personal limit-hit history that improves projections over time
- Cache hygiene tracking (when available)
- Historical views: week, month, quarter, year
- Hand-written tips for reducing token usage
- A friendly owl that watches you work

## What it doesn't do

- It can't see Claude.ai chat or mobile app usage directly. Sync your dashboard percentages periodically (one button in ABOUT) for accurate projections.
- It can't predict exactly when you'll hit your limit. It estimates from your own history — projections improve as Pip-Token learns your habits.
- It doesn't phone home. v1 makes zero network calls of any kind — no telemetry, no update checks, nothing. Everything is stored locally on your machine. (v2 may add opt-in anonymous analytics, default off, fully disclosed.)

## Install

Clone the repo, run `npm install`, then `npm run build`, then `F5` in VS Code to launch the extension in a development host. Marketplace install will come once v0.1 is feature-complete.

## Documentation

- `docs/DESIGN.md` — full product spec
- `docs/GLOSSARY.md` — term definitions
- `docs/ARCHITECTURE.md` — technical structure
- `docs/decisions/` — why we made the choices we did

## Feedback

Found a bug or want to request a feature? Let me know on X — **@StudioZedward**

## Licence

MIT — see `LICENSE`.
```

Once a screenshot of the LIVE/SESSION page exists (after M3), drop it into `assets/screenshot-live.png` and update the README.

### `LICENSE`

Standard MIT license, copyright studiozedward, current year. Use the canonical text from https://opensource.org/license/mit.

### `CHANGELOG.md`

```markdown
# Changelog

All notable changes to Pip-Token will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial repository scaffolding
- Design package: DESIGN.md, GLOSSARY.md, ARCHITECTURE.md, REPO_SETUP.md, TOKEN_DATA_RESEARCH.md
- Owl mascot artwork (5 poses)
- ADRs documenting initial design decisions

## [0.1.0] — TBD

First public release. Coming soon.
```

### `CLAUDE.md` (root)

```markdown
# Pip-Token — Project Conventions

A VS Code extension that helps Claude Code users track their token usage with a Fallout Pip-Boy aesthetic.

## Tech stack

TypeScript, VS Code Extension API, SQLite (better-sqlite3), plain HTML/CSS in the webview. No frontend frameworks. No chart libraries. No network calls.

## Commands

- `npm install` — install dependencies
- `npm run build` — compile and bundle with esbuild
- `npm run watch` — dev mode
- `npm test` — run Vitest tests
- `npm run package` — build .vsix
- F5 in VS Code — launch the extension in a development host

## Branching and commits

- `main` is always shippable
- Feature branches off main, named `feat/short-description` or `fix/short-description`
- Squash-merge into main via PR
- Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`, `chore: ...`

## Where things live

- Product spec: `docs/DESIGN.md` (authoritative)
- Visual reference: `mockups/*.html` at repo root, generated by `build_all.py` (predates some spec changes — DESIGN.md wins)
- Terminology: `docs/GLOSSARY.md`
- Architecture: `docs/ARCHITECTURE.md`
- Decisions made and why: `docs/decisions/`
- Lessons learned during build: `LESSONS.md` — **read this before tackling areas marked as "previously problematic"**

## Subdirectory CLAUDE.md files

Pip-Token uses a distributed CLAUDE.md pattern. When working in `src/parsing/`, `src/webview/`, `src/data/`, `src/domain/`, or `test/`, also read the local `CLAUDE.md` in that directory — it contains conventions specific to that subsystem.

## Hard rules

- **v1 makes no network calls. Anywhere.** Don't add any network code, even libraries that imply network capability. Telemetry and update checks are strictly v2+ territory and would need their own ADR superseding 0004.
- All cost math reads from `src/domain/pricing.json`. Never hardcode prices.
- Peak hour schedule lives only in `src/domain/peakHourSchedule.ts`. Never duplicate.
- Honest uncertainty: use the LEARNING state, not zeros or fake projections.

## Update LESSONS.md when

You spend more than 30 minutes tracking down a non-obvious bug, or you discover a platform/library quirk worth remembering. See `LESSONS.md` for the format.
```

### `LESSONS.md`

```markdown
# Pip-Token — Lessons Learned

A running log of non-obvious things learned during the build. Newest at the top. See `docs/REPO_SETUP.md` for the format and when to add an entry.

(No lessons yet — the build hasn't started.)
```

### `.gitignore`

```
node_modules/
out/
*.vsix
.DS_Store
.env
.env.*
coverage/
*.log
.vscode-test/

# Generated at build time from docs/GLOSSARY.md — see ARCHITECTURE §"Build-time asset baking"
src/webview/ui/pages/glossaryContent.ts

# Parser fixtures: gitignored by default, explicit allowlist for sanitised files
test/fixtures/sample-sessions/*
!test/fixtures/sample-sessions/*-sanitised.jsonl
```

### `.vscodeignore`

```
.vscode/**
.vscode-test/**
src/**
test/**
docs/**
.gitignore
.vscodeignore
*.config.js
tsconfig.json
**/*.map
**/*.ts
!out/**/*.js
```

### `.github/workflows/ci.yml`

A simple workflow that installs dependencies, builds, and runs tests on every push and PR. ~40 lines of YAML. Use `actions/checkout@v4` and `actions/setup-node@v4` with Node 20. Run `npm ci`, `npm run build`, `npm test`. Don't add deploy steps yet — Milestone 0 ships nothing.

**Also add a fixture sanitisation step** that fails the build if any file under `test/fixtures/` matches any of:
- `/Users/` or `/home/` or `C:\\Users\\` (absolute paths)
- `sk-ant-` (API key prefix)
- `Bearer ` followed by a token-like string

Roughly five lines of grep in a bash step:

```yaml
- name: Check fixture sanitisation
  run: |
    if grep -rEn '/Users/|/home/|C:\\Users\\|sk-ant-|Bearer [A-Za-z0-9_-]{20,}' test/fixtures/ 2>/dev/null; then
      echo "❌ Unsanitised patterns found in test/fixtures/. See test/CLAUDE.md."
      exit 1
    fi
```

This is a second line of defence behind the `.gitignore` allowlist.

### `.github/ISSUE_TEMPLATE/bug_report.md`

Standard bug report template asking for: what happened, what was expected, steps to reproduce, Claude Code version, VS Code version, OS, Pip-Token version, screenshots if applicable.

### `.github/ISSUE_TEMPLATE/feature_request.md`

Standard feature request template asking for: what problem the feature would solve, proposed approach, alternatives considered, whether the user is willing to help build it.

### `.github/ISSUE_TEMPLATE/parser_compatibility.md`

Pip-Token-specific template for "the parser broke after a Claude Code update." Asks for: Claude Code version (run `claude --version`), Pip-Token version, what stopped working, and a sanitised sample of 5–10 lines from the affected JSONL file. The sample is the most important field — that's what lets the parser get fixed quickly.

**The template must include an explicit redaction checklist the user ticks before posting:**

```markdown
Before submitting, please confirm:
- [ ] I have replaced absolute file paths (e.g. `/Users/me/...`) with `/path/to/project`
- [ ] I have removed any string starting with `sk-ant-` or `Bearer `
- [ ] I have removed any content from messages that I wouldn't want public
- [ ] I understand this issue will be visible on a public GitHub repo and indexed by search engines
```

This is a public repo and users will paste logs containing real project contents. The checklist is the only thing between a careless paste and a permanent leak.

### `.github/PULL_REQUEST_TEMPLATE.md`

Brief template asking for: what the PR does, what it's linked to (issue or ADR), what was tested, any breaking changes, any LESSONS.md or ADR updates needed.

### `package.json` (skeleton — full content comes in M1)

For Milestone 0 just enough to make the repo recognisable as a VS Code extension:
- `name: pip-token`
- `displayName: Pip-Token`
- `description: Track your Claude Code token usage with a Fallout Pip-Boy aesthetic`
- `version: 0.1.0`
- `engines.vscode: ^1.85.0` (or whatever's current)
- `categories: ["Other"]`
- `keywords: ["claude", "claude-code", "tokens", "usage", "tracking"]`
- `license: MIT`
- `author: studiozedward`
- `repository`, `bugs`, `homepage` fields pointing at the GitHub repo
- Empty `contributes` and `activationEvents` for now — M1 fills these in

Don't register a marketplace publisher yet. That comes after M5 when the extension is feature-complete.

---

## Branching and commit conventions

### Branches

- **`main`** is always shippable. Never commit broken code directly to main.
- **Feature branches** are named `feat/short-description` (e.g. `feat/live-cache-page`)
- **Fix branches** are named `fix/short-description` (e.g. `fix/timezone-day-boundary`)
- **Doc branches** are named `docs/short-description` (e.g. `docs/update-glossary`)
- All work goes through a PR back to main, even for solo work — it gives the CI a chance to run

### Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add live cache page
fix: correct peak hour timezone handling
docs: update glossary with active day definition
refactor: extract burn rate calculation to its own module
test: add fixtures for tool-use turns
chore: bump esbuild to 0.24
```

Squash-merge PRs into main with a single Conventional Commit as the merge commit.

---

## What Milestone 0 produces

By the end of Milestone 0, the repo should look like this when you run `git log`:

```
chore: add CI workflow and issue templates
docs: add initial ADRs (0001-0018)
docs: add CLAUDE.md, LESSONS.md, and subdirectory CLAUDE.md skeletons
docs: add design package (DESIGN, GLOSSARY, ARCHITECTURE, etc)
chore: add LICENSE and CHANGELOG
chore: initial repo scaffolding
```

Six commits, all clean, ready for Milestone 1 to start adding actual code.

After M0 is committed and pushed:

1. Verify the repo is publicly visible at `github.com/studiozedward/pip-token`
2. Verify CI is green (it should be — there's nothing to break yet)
3. Verify the README renders correctly
4. Confirm with the user before starting M1

---

## Things explicitly NOT in Milestone 0

- Any TypeScript code beyond the empty `package.json` skeleton
- Any actual tests
- Any feature work
- A VS Code marketplace publisher registration (deferred until M5+)
- A code of conduct (add later if the project gets contributors)
- A contributing guide (add later if the project gets contributors)
- GitHub Discussions, GitHub Pages, or any other GitHub features
- An icon or polished marketplace assets (deferred until M5+)
