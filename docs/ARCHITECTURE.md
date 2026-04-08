# Pip-Token — Architecture

Technical structure for the Claude Code build. Read DESIGN.md for product context and GLOSSARY.md for terminology — all terms used here are defined there.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Required for VS Code extensions |
| Extension framework | VS Code Extension API | Native integration, FileSystemWatcher, command palette, webview panels |
| UI rendering | Webview panel + plain HTML/CSS | No framework needed; the UI is mostly static layout with live data updates |
| Local storage | SQLite via `better-sqlite3` | Synchronous, simple, file-based, no server |
| File watching | `vscode.workspace.createFileSystemWatcher` | Native VS Code API |
| Charts | Inline SVG, hand-rolled | Already proven in mockups; avoids chart library bloat and matches the aesthetic |
| Build tooling | esbuild | Fast, simple, standard for VS Code extensions |
| Package manager | npm | Standard |
| Testing | Vitest for parser logic, manual QA for UI | Pragmatic for v1 |

**Deliberately not using:** React, Vue, Tailwind, Chart.js, D3, Electron-extras, or any backend service. The whole extension should be small enough to install in a few seconds.

---

## File tree

For the full repo layout (docs/, assets/, mockups/, .github/, distributed CLAUDE.md files, ADRs, LESSONS.md, CHANGELOG.md, etc.), see `REPO_SETUP.md`. This document scopes to `src/` — the extension source tree Claude Code builds during M1 onwards.

```
pip-token/
└── src/
    ├── extension.ts                # VS Code entry point — activate/deactivate
    ├── webview/
    │   ├── PipTokenPanel.ts        # Webview panel controller
    │   ├── messageBus.ts           # Webview ↔ extension messaging
    │   └── ui/
    │       ├── index.html          # Webview HTML shell
    │       ├── styles.css          # All Pip-Boy styles
    │       ├── main.ts             # Webview entry point
    │       ├── router.ts           # Page navigation, CRT flicker
    │       ├── pages/
    │       │   ├── liveSession.ts
    │       │   ├── liveContext.ts
    │       │   ├── liveCache.ts
    │       │   ├── statsTokens.ts
    │       │   ├── statsCost.ts
    │       │   ├── historyWeek.ts
    │       │   ├── historyMonth.ts
    │       │   ├── historyQuarter.ts
    │       │   ├── historyYear.ts
    │       │   ├── tips.ts                 # hosts CACHE / PEAK HOURS / CONTEXT / OTHER as internal tabs
    │       │   ├── aboutInfo.ts                # ABOUT / INFO sub-page
    │       │   ├── aboutGlossary.ts            # ABOUT / GLOSSARY sub-page (imports baked glossaryContent.ts)
    │       │   ├── glossaryContent.ts          # Generated at build time from docs/GLOSSARY.md — do not edit by hand
    │       │   └── onboarding.ts
    │       └── components/
    │           ├── statRow.ts
    │           ├── statCard.ts
    │           ├── barChart.ts
    │           ├── fillBar.ts
    │           ├── advisoryBox.ts
    │           ├── statusBar.ts            # In-window only — no VS Code native bar in v1 (see ADR 0002)
    │           ├── projectSelector.ts      # The [ALL PROJECTS ▾] dropdown
    │           ├── periodNavigator.ts      # The [◄] PERIOD [►] arrow controls for HISTORY
    │           └── mascotPanel.ts
    ├── data/
    │   ├── db.ts                   # SQLite connection and migrations
    │   ├── schema.sql              # Initial schema
    │   └── repositories/
    │       ├── windowRepo.ts       # Current 5-hour window CRUD
    │       ├── limitHitRepo.ts     # Limit hit events
    │       ├── sessionRepo.ts      # Claude Code sessions
    │       ├── turnRepo.ts         # Individual turns
    │       ├── syncRepo.ts         # Dashboard sync records (manual calibration)
    │       └── settingsRepo.ts     # Singleton settings
    ├── parsing/
    │   ├── claudeCodeWatcher.ts    # Watches ~/.claude/projects/
    │   ├── jsonlParser.ts          # Parses session JSONL files
    │   ├── tokenExtractor.ts       # Pulls token counts from parsed events
    │   ├── peakHourClassifier.ts   # Decides if a turn is peak or off-peak
    │   ├── limitHitDetector.ts     # Spots 429 errors and timing-gap inferences
    │   └── activeSessionTracker.ts # Tracks which sessions are currently "active"
    ├── domain/
    │   ├── advisoryEngine.ts       # Rules engine for advisory messages
    │   ├── advisoryRules.ts        # Hardcoded rule set (see DESIGN.md sec 10)
    │   ├── costCalculator.ts       # Tokens → API-equivalent cost in user currency
    │   ├── pricing.json            # Per-model API pricing snapshot — single source of truth (ADR 0014)
    │   ├── thresholdEstimator.ts   # Personal threshold from limit hit history
    │   ├── burnRateCalculator.ts   # Tokens per minute over rolling window
    │   ├── peakHourSchedule.ts     # The actual peak window definition
    │   └── planTierDefaults.ts     # Cold-start placeholder thresholds
    └── utils/
        ├── dateUtils.ts
        ├── formatNumber.ts         # 47283 → "47,283", 412000 → "412K"
        ├── currencyFormatter.ts
        └── logger.ts
```

---

## Key data flows

### Flow 1: Live token tracking

```
Claude Code writes turn to ~/.claude/projects/<hash>/<session>.jsonl
       ↓
FileSystemWatcher fires "change" event
       ↓
claudeCodeWatcher reads new lines from the file (tracks file offsets)
       ↓
jsonlParser parses each line into a TurnEvent
       ↓
tokenExtractor pulls input_tokens, output_tokens, cache fields
       ↓
peakHourClassifier tags the turn as PEAK or OFF_PEAK
       ↓
turnRepo writes the turn to SQLite
       ↓
windowRepo increments the current window's counters
       ↓
limitHitDetector checks if this turn was a 429 or follows a suspicious gap
       ↓                                  ↓
   nothing                          limitHitRepo writes event,
                                    closes current window,
                                    opens new window
       ↓
messageBus sends "data updated" to webview
       ↓
Webview re-renders the active page (including in-window status bar)
```

### Flow 2: Page navigation

```
User clicks a top menu item in the webview
       ↓
router.ts intercepts the click
       ↓
CRT flicker animation plays (80ms)
       ↓
Optional blip sound (if enabled in settings)
       ↓
router.ts mounts the new page module
       ↓
Page module requests data from extension via messageBus
       ↓
Extension queries the relevant repository
       ↓
Data returned to webview
       ↓
Page renders
       ↓
Advisory engine evaluates rules for the new page
       ↓
Highest-priority advisory rendered (or hidden if none)
```

### Flow 3: First run (onboarding)

```
extension.ts activates
       ↓
settingsRepo.get() → onboarding_completed_at IS NULL (user never finished)
       ↓
PipTokenPanel opens onboarding page instead of LIVE/SESSION
       ↓
User clicks through welcome → plan tier → currency confirmation
       ↓
Each step writes only its own field to the settings singleton
       ↓
Final "Finish" click sets onboarding_completed_at = now()
       ↓
Webview switches to LIVE/SESSION
       ↓
LEARNING — NEEDS LIMIT HIT shown for projection fields until real data accumulates
```

If the user closes VS Code halfway through onboarding, `onboarding_completed_at` stays NULL and the next launch reopens onboarding — preserving whatever partial settings they already entered rather than starting from scratch.

---

## Component contracts

### claudeCodeWatcher

**Responsibility.** Watch `~/.claude/projects/` for new and modified JSONL files. Emit events when new lines are appended.

**Interface.**

```ts
interface ClaudeCodeWatcher {
  start(): void;
  stop(): void;
  onNewTurn(handler: (turn: RawTurnEvent) => void): void;
  onLimitHit(handler: (event: RawLimitHitEvent) => void): void;
}
```

**Critical concerns.**
- Must track file offsets per file in the `watcher_state` table so it doesn't re-read old turns on restart (performance optimisation).
- Turn IDs are content-addressed (`hash(session_id + timestamp + input_tokens + output_tokens)`) and writes use `INSERT OR IGNORE` — so even if the offset cache is wiped and the parser re-reads from zero, duplicate turns are absorbed rather than double-counted. Idempotency is guaranteed by the ID scheme, not the offset tracking. See ADR 0017 and DESIGN §7.
- Must handle multiple concurrent sessions (multiple JSONL files)
- Must survive Claude Code log format changes via version detection

### jsonlParser

**Responsibility.** Parse a single JSONL line into a typed event. Returns `null` if the line is unrecognised.

**Interface.**

```ts
interface JsonlParser {
  parse(line: string): RawTurnEvent | RawLimitHitEvent | null;
  detectVersion(): ClaudeCodeVersion;
}
```

**Critical concerns.**
- The format is not documented. The build must inspect real samples to determine the actual schema. See TOKEN_DATA_RESEARCH.md.
- The parser should be defensive: any unrecognised field is ignored, any malformed line is skipped (logged but not crashed on).

### peakHourClassifier

**Responsibility.** Given a timestamp, decide if it falls within Anthropic's peak window.

**Interface.**

```ts
interface PeakHourClassifier {
  isPeak(timestamp: Date): boolean;
}
```

**Definition.** Peak hours are weekdays (Monday–Friday in Pacific time) from 5:00 to 11:00 Pacific Time. The classifier converts the input timestamp to Pacific time first, then checks. This may need updating if Anthropic changes the window — keep the definition isolated in `peakHourSchedule.ts` so a single edit updates everywhere.

### limitHitDetector

**Responsibility.** Spot limit hit events in the parsed log stream.

**Interface.**

```ts
interface LimitHitDetector {
  process(turn: RawTurnEvent): RawLimitHitEvent | null;
  processGap(lastTurn: Date, nextTurn: Date): RawLimitHitEvent | null;
}
```

**Detection methods.**
1. Explicit 429 error in the log
2. Timestamp gap immediately after a 429-like pattern (inferred)
3. Manual logging via UI button (handled separately, not by this component)

### activeSessionTracker

**Responsibility.** Maintain the list of currently *active sessions* (see GLOSSARY.md). An active session is one whose backing JSONL file has been modified within the last 2 hours.

**Interface.**

```ts
interface ActiveSessionTracker {
  getActiveSessions(): ActiveSession[];
  isActive(sessionId: string): boolean;
  onActiveSessionsChanged(handler: (sessions: ActiveSession[]) => void): void;
}

interface ActiveSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  lastActivity: Date;
}
```

**Behaviour.**
- Polls the project directory every 30 seconds for file modification times
- Also subscribes to `claudeCodeWatcher` for live update events to refresh the list immediately when activity occurs
- Emits a change event whenever a session moves into or out of the active set
- The webview's project selector subscribes to this event to keep the dropdown live

**Critical concerns.**
- The 2-hour threshold is defined in GLOSSARY.md and isolated as a single constant in this file. Changing it requires editing one line.
- Must handle the case where Claude Code creates a new project directory mid-session — the watcher needs to pick up new directories, not just new files in known directories.

### advisoryEngine

**Responsibility.** Given a page name and a snapshot of relevant data, return the highest-priority matching advisory message or `null`.

**Interface.**

```ts
interface AdvisoryEngine {
  evaluate(page: PageName, data: PageDataSnapshot): AdvisoryMessage | null;
}
```

**Rule structure.** See DESIGN.md section 10. Rules live in `advisoryRules.ts` as a static array of objects.

### costCalculator

**Responsibility.** Convert tokens to estimated API-equivalent cost in the user's currency.

**Interface.**

```ts
interface CostCalculator {
  tokensToCost(input: number, output: number, model: string, currency: Currency): number;
}
```

**Critical concerns.**
- Pricing per model is read from `src/domain/pricing.json` (single source of truth). The build should pull current Anthropic pricing from public docs when first creating this file and document the source URL inside the file. Updates to pricing happen in this one file only.
- Currency conversion uses a fixed exchange rate snapshot, also stored in `pricing.json`. Live FX is out of scope for v1.
- The result must be labelled as estimated API-equivalent cost everywhere it appears, not "your spend."

### dashboardSyncService

**Responsibility.** Persist user-submitted dashboard sync values, compute the OTHER bucket delta, and expose the most recent sync (with staleness) to the rest of the app.

**Interface.**

```ts
interface DashboardSyncService {
  recordSync(input: { fivehourPct: number; weeklyPct: number }): SyncResult;
  getMostRecentSync(): SyncRecord | null;
  getStalenessMinutes(): number | null;
  getInferredOtherTokens(): number;
}

interface SyncRecord {
  id: string;
  timestamp: Date;
  fivehourPct: number;
  weeklyPct: number;
  codeTokensAtSync: number;
  inferredOther: number;
  planTierAtSync: PlanTier;
}
```

**Behaviour.**
- On `recordSync`, the service reads the user's current CODE token total from `windowRepo`, computes the implied total tokens consumed (`fivehourPct × personal_threshold` or `× plan_tier_default` if no personal threshold yet), subtracts the CODE total to get `inferred_other`, and writes a new row to `dashboard_syncs` via `syncRepo`.
- The OTHER bucket value displayed in the UI is always the `inferred_other` from the most recent sync. It is not extrapolated forward — it's a snapshot, and staleness alone signals "this may be out of date."
- `getStalenessMinutes` returns `null` if the user has never synced, otherwise the minutes since the last sync. The UI uses this to show "Synced 2h ago" labels and to surface "Sync recommended" advisories after configurable thresholds (default: 24 hours).

**Critical concerns.**
- The `fivehourPct × threshold` calculation depends on having either a personal threshold or a plan tier default. For brand-new users with neither, the OTHER bucket falls back to `LEARNING — NEEDS SYNC`. Once a sync exists but the projection still needs a first limit hit, the state becomes `LEARNING — NEEDS LIMIT HIT`.
- Validation must catch obvious typos (negative values, values >100, dramatic regressions vs the previous sync) before writing.
- The service is purely reactive — it does not poll or auto-sync. All sync events come from explicit user action.

---

## Webview ↔ extension messaging

The webview and the extension run in separate contexts. They communicate via VS Code's `postMessage` API.

### Messages from webview to extension

| Message | Purpose |
|---|---|
| `requestPageData` | Webview asks for data needed to render a page |
| `navigateTo` | User clicked a menu item — used for analytics and state tracking |
| `setProjectFilter` | User picked a project from the active sessions dropdown (or `[ALL PROJECTS]`) |
| `manualLimitHit` | User clicked "I just hit a limit" |
| `dashboardSync` | User submitted dashboard sync values (5-hour % and weekly %) from the sync modal |
| `updateSettings` | User changed a setting in ABOUT |
| `resetHistory` | User confirmed history reset |
| `completeOnboarding` | User finished onboarding flow |

### Messages from extension to webview

| Message | Purpose |
|---|---|
| `pageData` | Response to `requestPageData`. Includes the current project filter so the page can label itself accordingly |
| `liveUpdate` | Pushed when new data arrives, includes only the deltas needed for the current page |
| `activeSessionsChanged` | Pushed when the active sessions list changes (project added or removed) |
| `settingsChanged` | Pushed when settings update from any source |
| `firstRunDetected` | Tells webview to mount onboarding instead of normal pages |

### Update frequency

- Live counters: pushed within ~500ms of new data parsed
- Burn rate: recalculated every 5 seconds
- Cache state: recalculated every 5 seconds
- Charts: recalculated when day boundary crosses or on page mount

---

## Storage details

### SQLite location

```
<vscode globalStorage>/pip-token/pip-token.db
```

VS Code provides `context.globalStorageUri` for this purpose. The directory is per-extension, persistent across reloads, and not synced.

### Migrations

Schema is created on first launch via `schema.sql`. Future schema changes use a simple migration runner: each migration is a numbered SQL file, and a `schema_version` table tracks which have been applied.

### Backup and export

Deferred to post-v1 (see README roadmap). Users who need their data before then can copy the SQLite file directly from `<vscode globalStorage>/pip-token/pip-token.db` — it's a standard SQLite database and any tool (the `sqlite3` CLI, DB Browser for SQLite, etc.) will read it.

---

## Status bar

There is **no VS Code-native bottom-strip status bar** in v1. The status bar lives only inside the extension webview, rendered by `webview/ui/components/statusBar.ts`. See DESIGN.md section 6 for the rationale (the constrained native API would deliver limited value relative to its build cost).

If users specifically request a native status bar in v2, the API to use would be VS Code's `StatusBarItem`, with the `[PEAK]` segment using `errorBackground` colour. Documented here for future reference, not for v1 implementation.

---

## VS Code commands

Pip-Token contributes the following commands to the VS Code command palette via `package.json`:

| Command ID | Title | What it does |
|---|---|---|
| `pipToken.openPanel` | `Pip-Token: Open Panel` | Opens or focuses the webview panel |
| `pipToken.logLimitHit` | `Pip-Token: Log Limit Hit` | Manually records a limit hit at the current timestamp using current peak/off-peak counts |
| `pipToken.syncDashboard` | `Pip-Token: Sync Dashboard` | Opens the dashboard sync modal |

The `pipToken.logLimitHit` command is intentionally available outside the webview panel because users may notice a limit hit while focused on their code and want to log it without context-switching into the extension.

---

## Timezone handling

All day boundaries (for STATS, HISTORY, and active-day calculations) are computed in the user's local timezone, detected at startup via:

```ts
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
```

The detected timezone is stored in the settings table and shown in ABOUT. Users can override it with a different IANA timezone string (useful for travellers who want to keep their "home" timezone).

The timezone is **only** used for day boundary computation. Peak hour classification still uses Pacific time directly (see `peakHourSchedule.ts`) because Anthropic's peak window is defined in Pacific time regardless of where the user is.

---

## Build commands

```
npm install                # Install dependencies
npm run build              # Compile TypeScript and bundle
npm run watch              # Dev mode with auto-rebuild
npm run test               # Run Vitest tests
npm run package            # Build .vsix for distribution
```

### Build-time asset baking

Some static content from `docs/` needs to be available inside the packaged `.vsix` even though `.vscodeignore` strips the whole `docs/` directory out of the bundle. Rather than un-ignoring `docs/` (which would bloat the package with design files users don't need), the build bakes the required content into TypeScript modules at compile time.

Currently one file is baked:

- **`docs/GLOSSARY.md`** → `src/webview/ui/pages/glossaryContent.ts` (exports the raw markdown as a string constant). The ABOUT / GLOSSARY sub-page imports the constant and renders it. A small esbuild pre-step reads the markdown file and writes the TS module on every build. This keeps GLOSSARY.md as the single source of truth (edited once, bundled everywhere it's needed) and avoids any runtime filesystem access from the webview.

If other `docs/` files ever need to be shown inside the extension, add them to the same pre-step. Never read from `docs/` at runtime — the directory does not exist inside the installed extension.

---

## Performance budget

- Extension activation: <300ms
- Webview initial render: <200ms
- Live update latency (turn finishes → number on screen): <500ms
- SQLite query for any single page: <50ms
- Memory footprint: <80MB with 1 year of history

If any of these blow out, the build should profile and optimise rather than ship a sluggish extension. Pip-Boy aesthetic doesn't excuse slow software.

---

## Security and privacy

- **v1 makes no network calls. Period.** The extension does not phone home, does not check for updates from a server, does not send telemetry. The extension declares no network permissions in `package.json`. Adding any network call in v1 requires a new ADR superseding 0004.
- All data is local. SQLite file lives in VS Code's per-extension storage.
- The README must state these guarantees clearly. Users on Reddit will check.
- v2 may add opt-in anonymous analytics (default off, fully disclosed) — see ADR 0004.

---

## Open architectural questions

These should be resolved during the build. See TOKEN_DATA_RESEARCH.md for the data-format-specific ones.

1. **Webview lifecycle.** Should the panel persist across VS Code reloads (`retainContextWhenHidden`)? Probably yes for this use case — losing live state every time the user switches tabs would be annoying. Tradeoff: higher memory.

2. **Multi-window VS Code — RESOLVED (see ADR 0018).** If the user has multiple VS Code windows open, each runs its own extension instance, but they share the SQLite file via `globalStorageUri`. Resolution: open the database in WAL (write-ahead logging) mode with a 5-second busy-timeout, which allows one writer plus multiple readers concurrently without blocking. Counter updates to the current window use atomic `UPDATE windows SET peak_input_tokens = peak_input_tokens + ?` increments rather than read-modify-write cycles, preventing two windows from racing on the same row. Two writers competing for the same row will still serialise through the busy-timeout, but no writer will crash or corrupt. Documented in `src/data/CLAUDE.md`.

3. **Sound implementation.** Webview audio is constrained. Either bundle a small audio file as base64 in the webview, or use the Web Audio API to synthesise a blip on the fly. The latter is more authentic to the aesthetic and avoids file bundling.

4. **CRT flicker.** A CSS animation on the page container is the simplest implementation. Should be brief and skippable for users with motion sensitivity.

5. **Onboarding state.** If a user dismisses onboarding without completing it, should it reappear next launch or be marked dismissed? Recommend: reappear until completed at least once.
