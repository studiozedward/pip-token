# Pip-Token — Design Specification

A VS Code extension that helps Claude Code users track their token usage in real time and over time, with a Fallout Pip-Boy aesthetic.

**Terminology.** All terms used in this document — *active session, burn rate, peak hours, personal threshold, LEARNING state, window,* and so on — are defined in `GLOSSARY.md`. When a term's meaning needs updating, update it in the glossary, not here. This document references definitions by name.

---

## 1. What this is

Pip-Token is a local-first VS Code extension that monitors a developer's Claude Code usage by reading Claude Code's session logs from disk. It surfaces live token consumption, peak vs off-peak split, cache hygiene, context window utilisation, and historical trends. It is styled after the Pip-Boy 3000 from Fallout 4: monochrome phosphor green on near-black, CRT scan lines, chunky monospace typography, vector mascot art.

The problem it solves: Claude users (especially Claude Code users) regularly hit usage limits without warning and have no historical visibility into their consumption patterns. Anthropic's settings dashboard shows current usage but no trends, no peak/off-peak split, no cache insight, and no projections. Users on Reddit and Discord routinely complain about this. Pip-Token sits in the developer's editor and gives them a glanceable, data-grounded view of where their tokens go.

**Scope: Claude Code only (with manual sync option for everything else).** Pip-Token's primary data source is Claude Code's local session logs. It cannot directly observe Claude.ai chat usage, mobile app usage, or third-party tools that hit the Anthropic API — these don't write local files Pip-Token can read. Because Anthropic's 5-hour and weekly limits are account-wide, anyone who uses both Claude Code and chat/API will see Pip-Token's projections drift from reality unless they sync. Pip-Token offers a manual **dashboard sync** workflow (see GLOSSARY.md) where the user enters their current Anthropic dashboard percentages and Pip-Token attributes the difference to an `OTHER` source bucket. Users who want accurate projections should sync periodically. Users who only use Claude Code don't need to sync at all.

The honest limitation: Anthropic does not expose a "remaining usage" API, does not publish exact session limits, and does not document peak hour multipliers. Pip-Token does not pretend to know these things. It tracks raw token counts locally and uses the user's own historical limit-hit events to estimate when they're approaching trouble. When data is insufficient, the UI shows the LEARNING state (see GLOSSARY.md) rather than guessing.

---

## 2. Core concepts

**Peak vs off-peak tracking.** Anthropic charges session-limit "weight" differently during peak hours (weekdays 5am–11am Pacific Time) vs off-peak. The exact conversion to UK/EU local time shifts by an hour at each DST transition — Pip-Token's code always computes the conversion via Pacific time in `peakHourSchedule.ts`, so the docs deliberately don't hardcode a GMT/UTC equivalent. The exact peak multiplier is undocumented and changes silently. Rather than infer a multiplier, Pip-Token tracks two parallel counters (`peak_tokens` and `offpeak_tokens`) and lets the user's own limit-hit history reveal the relationship empirically.

**Limit hit events.** When the user hits an Anthropic-imposed limit (5-hour session or weekly), Pip-Token logs the event with a snapshot of how many peak vs off-peak tokens had been consumed in the current window. Over time, these events form a personal threshold map: "your last 5 session limits hit at an average of 180k peak tokens / 50k off-peak tokens." This is descriptive, not predictive — the data updates automatically when Anthropic changes the rules.

**Plan tier seeding.** New users have no limit-hit history, so Pip-Token can't compute personal thresholds on day one. The user selects their plan tier (Free, Pro, Max 5x, Max 20x) during onboarding, which seeds rough public estimates. These placeholders are clearly marked as estimates and are replaced by real data once the user accumulates limit-hit events.

**Honest uncertainty.** Anywhere Pip-Token shows a projection or estimate, it must be visually distinguished (e.g. tilde prefix `~2H 14M`, dimmer text colour, or explicit "ESTIMATED" labelling). When data isn't available yet because Pip-Token is still warming up, the field shows a `LEARNING` state (see GLOSSARY). `INSUFFICIENT DATA` is reserved for cases where the data may not be available at all (e.g. per-source context breakdown, pending TOKEN_DATA_RESEARCH Q11) — the distinction matters and both states are used throughout the UI.

---

## 3. Visual design system

### Colour palette

The aesthetic is monochrome phosphor green with red reserved exclusively for alarms. Three greens and one red, plus the background.

| Token | Hex | Purpose |
|---|---|---|
| `--bg` | `#000a00` | Page background |
| `--bg-accent` | `#001500` | Mascot fills, advisory backgrounds |
| `--bg-stat` | `#002200` | Status bar segments |
| `--green-bright` | `#00ff41` | Primary text, primary lines, active stats |
| `--green-mid` | `#00aa2b` | Secondary text, gridlines, dim labels |
| `--green-dim` | `#006a1a` | Inactive menu items, disabled elements |
| `--green-darker` | `#003a0d` | Faintest gridlines |
| `--alarm-red` | `#ff4141` | Limit hit markers, peak status badge |
| `--alarm-bg` | `#2a0000` | Background of red alarm elements |

**Red is the only non-green colour.** It appears only in two places: the PEAK status badge in the status bar (when active), and limit hit markers in charts. Never decorative. Never as accent. If a designer is tempted to use red elsewhere, the answer is no.

### Typography

Monospace throughout. Use a system stack with Courier New as the safe fallback. If a custom font can be bundled with the extension, prefer VT323 or Share Tech Mono for a more authentic CRT feel.

```
font-family: 'VT323', 'Share Tech Mono', 'Courier New', Courier, monospace;
```

Sizes are deliberately chunky to evoke a CRT terminal:

| Element | Size | Weight |
|---|---|---|
| Top menu items | 17px | 700 |
| Sub-menu items | 12px | 400 |
| Stat labels and values | 14px | 400 (700 when highlighted) |
| Stat card large numbers | 15px | 700 |
| Stat card labels | 9px | 400 |
| Description text | 11px | 400 |
| Advisory text | 11px | 400 |
| Status bar | 11px | 700 |
| Header (PIP-TOKEN) | 12px | 400 |
| Chart axis labels | 9-10px | 400 |

**Stat labels and headers use ALL CAPS** to match Pip-Boy convention. Body text in descriptions and advisories uses sentence case for readability.

### Effects

**Scan lines** are applied as a repeating linear gradient overlay on the main extension window:

```css
background: repeating-linear-gradient(
  0deg,
  rgba(0,0,0,0.18) 0px,
  rgba(0,0,0,0.18) 1px,
  transparent 1px,
  transparent 3px
);
pointer-events: none;
```

**CRT flicker on tab switch.** When the user clicks a top-level menu item, the entire content area briefly flashes white-then-dark over ~80ms before rendering the new page. Pure cosmetic, optional to disable in ABOUT.

**No glow, no neon, no animation beyond the flicker and live-updating numbers.** The aesthetic is a 1980s monochrome terminal, not modern "cyberpunk."

### Component library

**Stat row.** Used in stat lists on LIVE pages. A horizontal row with label on the left and value on the right. Default state is plain text on the page background. Selected state inverts colours: bright green background, dark text, bold weight.

**Stat card.** Used in the row of summary cards on STATS and HISTORY pages. A bordered box (1px green-mid border) with a small ALL-CAPS label on top and a large number below. Selected state inverts to bright green background with dark text.

**Description panel.** Small text below the mascot that explains the currently selected stat. Updates when the user clicks a different stat row or stat card.

**Advisory box.** Bordered dashed box (1px dashed green-mid) with a `>` prefix character. Contains a single sentence of contextual guidance derived from the data on the current page. Generated by the advisory engine (see section 10).

**Status bar segment.** A small inline box with bright green text on dark green background. The PEAK segment is special: when active it uses red text on dark red background with a red border.

**Mascot panel.** A vertical column on the right side of most pages containing the owl PNG and a description text box below it. Mascot size scales with available space (around 150px wide on stat-list pages, 120px on chart-heavy pages).

**Bar chart.** Stacked vertical bars (peak on top in bright green, off-peak on bottom in 45% opacity green) with thin gridlines, an optional dashed average line, and red limit-hit markers above bars.

**Limit hit marker.** Small red rectangles (10px wide × 3px tall) stacked vertically above the bar, one rectangle per limit hit. Above 5 hits, switches to a count badge `!6+` rendered in red with a red border.

**Cache lifetime bar.** A horizontal segmented bar showing time remaining before the prompt cache expires. 10 segments. Filled segments are bright green, the about-to-expire segment is mid-green, expired segments are hatched.

**Context fill bar.** A horizontal segmented bar showing what's filling Claude's context window. Segments are coloured by opacity tier rather than hue: brightest = system prompt, dimming through files → conversation → tools, with hatched fill for free space.

---

## 4. Page structure

```
PIP-TOKEN
├── LIVE
│   ├── SESSION    Live token counters and burn rate
│   ├── CONTEXT    Context window fill (per active session)
│   └── CACHE      Cache hygiene (per active session, timing-inferred where direct cache fields unavailable)
├── STATS          (always shows past 7 days)
│   ├── TOKENS     Daily token chart with summary
│   └── COST       Daily cost chart with summary
├── HISTORY        (arrow nav to step through past periods)
│   ├── WEEK       Daily bars, Mon-Sun
│   ├── MONTH      Weekly bars showing daily averages
│   ├── QUARTER    Monthly bars showing daily averages
│   └── YEAR       Monthly bars showing daily averages
├── TIPS
│   ├── CACHE
│   ├── PEAK HOURS
│   ├── CONTEXT
│   └── OTHER
└── ABOUT
    ├── INFO       Settings, explainers, version
    └── GLOSSARY   In-app rendering of GLOSSARY.md
```

Top-level menu is always visible. Sub-menus appear below the top menu and are page-specific. The active top-level page is wrapped in `[BRACKETS]`. The active sub-menu item has a 2px bright green underline.

**Navigation behaviour.** Click swaps pages with an 80ms CRT flicker. Optional blip sound on click (default on, toggle in ABOUT). HISTORY pages add a period-stepping arrow navigation in the page header (`[◄] APRIL 2026 [►]`) for moving backwards through time.

---

## 5. Page specifications

### 5.1 LIVE / SESSION

**Purpose.** The user's primary at-a-glance dashboard. Live token consumption aggregated across all *active sessions* (see GLOSSARY.md).

**Project selector.** A small dropdown sits at the top of the LIVE pages, just below the sub-menu strip:

```
[ALL PROJECTS ▾]
```

The dropdown lists `[ALL PROJECTS]` as the default plus one entry per active session, showing the project folder name and last activity timestamp:

```
[ALL PROJECTS]              ← default
pip-token        2m ago
my-app           18m ago
side-project     1h 42m ago
```

Selecting `[ALL PROJECTS]` aggregates data across every active session. Selecting a specific project filters the page to that session's data only. The status bar (see section 6) always shows aggregated data regardless of selector state, because it represents the user's position against account-wide limits.

**Why aggregate by default.** Anthropic's 5-hour and weekly limits are account-wide, not per-session. If three Claude Code instances are running, they all consume from the same shared budget. Showing per-session numbers as the default would understate real consumption against the limit and mislead the user. The project filter exists for power users who want to drill into "how is *this specific* project going" — but the act of filtering is a deliberate choice with a visible consequence (the page label changes to reflect the filter).

**Stats list (left column, 7 rows).**

| Stat | Source | Format |
|---|---|---|
| INPUT TOKENS | Sum of input_tokens across all active sessions (or filtered project) | `47,283` |
| OUTPUT TOKENS | Sum of output_tokens across all active sessions (or filtered project) | `12,847` |
| PEAK TOKENS | Input+output from turns whose timestamp falls in the peak window (see GLOSSARY.md) | `38,214` |
| OFF-PEAK TOKENS | Input+output from turns whose timestamp falls outside the peak window | `21,916` |
| BURN RATE | See GLOSSARY.md. Shows `LEARNING — WAIT 5 MINS` until 5 minutes of activity exists | `1.2K/MIN` or `LEARNING — WAIT 5 MINS` |
| EST. TIME TO LIMIT | Personal threshold tokens minus current window tokens, divided by burn rate. See GLOSSARY.md for personal threshold rules. Shows `LEARNING` until first limit hit recorded. Tilde prefix when based on 1–4 limit hits, no tilde when based on 5+ | `~2H 14M`, `2H 14M`, or `LEARNING` |
| SESSION TIME | Wall clock time since the first turn in the active session(s). See GLOSSARY.md | `1H 47M` |

**Default selected stat.** INPUT TOKENS.

**Mascot.** `owl-live.png` (alert pose, glowing eyes).

**Description text.** Updates based on selected stat. Default text for INPUT TOKENS: "Input tokens are sent TO Claude — your prompts, file contents, and conversation history. Large codebases re-read each turn drive this up fast."

**Advisory rules.** See section 10. Examples for this page:
- If burn rate exceeds historical average by 50%+: "Burn rate is unusually high — you're using {N}x your typical pace."
- If session has been running >4 hours: "Long session detected — consider breaking up tasks to keep cache fresh."
- If a project filter is active: "Showing {project} only — status bar still reflects all projects."
- Default: no advisory shown.

### 5.2 LIVE / CONTEXT

**Purpose.** Show what's filling Claude's context window for the active session and warn before it becomes a token drain.

**Project selector.** A selector appears at the top of the page consistent with other LIVE pages, but with one important difference: **the `[ALL PROJECTS]` option does not appear here**. Context is fundamentally per-session — each Claude Code session has its own context window, and aggregating across sessions makes no conceptual sense. The selector defaults to the most recently active project. If only one project is active, the selector still shows that project name (no chooser logic to fall through). The page always represents exactly one session's context state.

If no projects are active at all, the page shows a friendly empty state: "No active sessions. Open a Claude Code session to see context fill."

**Stats list (v1).**

| Stat | Source | Format |
|---|---|---|
| EST. CONTEXT USED | Total prompt tokens for the most recent turn in the selected session. Labelled EST. because the value is reconstructed from log data and may not exactly match what Claude Code's `/context` command would show | `124,847` |
| CONTEXT MAX | Model's context window size (200,000 for Sonnet 4.6, etc.). Hardcoded per known model in `costCalculator.ts` | `200,000` |
| UTILISATION | EST. CONTEXT USED / CONTEXT MAX, as percentage | `62%` |

**Mascot.** Reuses `owl-live.png` for v1.

**Visual element below stats.** A single solid context fill bar showing utilisation as a percentage. No segmentation in v1.

**Advisory rules.**
- If utilisation > 80%: "Context is {N}% full — consider /clear before next task."
- If utilisation > 60% and trending up across the last 5 turns: "Context is filling fast. Consider /clear if you're switching tasks."
- If utilisation < 30%: no advisory.

---

**Deferred to v2 (pending parser investigation).** The original spec called for a per-source breakdown showing which parts of the context were consuming the most tokens:

| Stat (v2) | Source |
|---|---|
| SYSTEM PROMPT | Tokens attributed to system prompt |
| LOADED FILES | Tokens attributed to file content |
| CONVERSATION | Tokens attributed to conversation history |
| TOOL DEFS | Tokens attributed to tool definitions |

These are deferred to v2 because Claude Code's session JSONL may not expose context broken down by source, and the v1 build should ship with a clean three-row stats list rather than a half-broken four-row one. **However**, when a user runs `/context` in Claude Code, the breakdown clearly exists somewhere — see Q11 in TOKEN_DATA_RESEARCH.md, which asks the build to specifically investigate whether that data is reachable from the JSONL or from another local source. If the investigation finds the breakdown is available, these rows return to v1 scope and the fill bar gains its segmented treatment back.

The advisory rules also have a v2 enhancement waiting: "If LOADED FILES > 50% of total: 'Files dominate your context. Consider /clear before next task to reset.'" This rule depends on the breakdown being available.

### 5.3 LIVE / CACHE

**Purpose.** Surface cache hygiene for the active session, which is the hidden token killer in Claude Code workflows.

**Project selector.** Same behaviour as LIVE/CONTEXT — cache state is per-session, so the `[ALL PROJECTS]` option is hidden. Defaults to the most recently active session. If no projects are active, shows the empty state: "No active sessions. Open a Claude Code session to see cache state."

**Cache TTL assumption.** Pip-Token assumes the **5-minute cache TTL** universally. Anthropic also offers a 1-hour cache, but it's set on the API call by Claude Code (not by the user) and we have no reliable way to detect which TTL is in use from log data alone. Hardcoding the 5-minute assumption keeps the page simple and is correct for the vast majority of Claude Code sessions. If a user is on the 1-hour cache, their cache will appear EXPIRED in Pip-Token long before it actually has — a false-negative we tolerate. The assumption is documented in GLOSSARY.md and explained in ABOUT.

**Stats list (v1).**

| Stat | Source | Format |
|---|---|---|
| CACHE STATE | FRESH / EXPIRING / EXPIRED based on idle time vs assumed 5-min TTL | `FRESH` |
| IDLE TIME | Seconds since last interaction in the active session | `1M 23S` |
| CACHE SIZE | Estimated tokens in the cache for the most recent turn | `87,200` |
| HITS TODAY | Count of turns today where the cache was reused | `47` |
| MISSES TODAY | Count of turns today where the cache had to be rebuilt | `12` |
| SAVED TODAY | Estimated tokens NOT charged at full price thanks to cache hits. See GLOSSARY.md for the calculation and its caveats | `412K` |

**Mascot.** Reuses `owl-live.png` for v1.

**Visual element below stats.** Horizontal cache lifetime bar with 10 segments (each = 30 seconds). Filled segments = time remaining. Last filled segment goes mid-green as a warning state. Empty segments are hatched.

**Advisory rules.**
- If hit rate > 70%: "Cache hit rate is {N}% today — saving you ~{tokens} tokens (~£{cost}). Avoid 5+ minute breaks to keep it fresh."
- If cache state is EXPIRED: "Cache expired. Next turn will re-read full context at base price."
- If hit rate < 40%: "Cache hit rate is low — frequent breaks may be causing expensive cache rebuilds."

**Critical dependency on parser investigation.** This page is best served by Claude Code's session JSONL exposing the `cache_creation_input_tokens` and `cache_read_input_tokens` fields per turn. See Q2 in TOKEN_DATA_RESEARCH.md.

If the build's investigation finds those fields **are available**, all cache stats are computed directly and shown as precise values. If they **are not available**, the page falls back to timing-based inference (gap > 5 minutes since the previous turn = cache miss, otherwise = cache hit) and every stat on the page is labelled ESTIMATED with a tilde prefix. Either way, the page ships in v1 — cutting it would lose one of Pip-Token's most differentiating features, and the estimated mode is still more actionable than nothing. The honest labelling is what keeps the extension trustworthy.

If the fallback mode is in use, a persistent note at the top of the page reads: `CACHE STATS ESTIMATED FROM TIMING — see ABOUT for details.`

### 5.4 STATS / TOKENS

**Purpose.** Past 7 days of token consumption with daily granularity.

**Layout.** Always pinned to "last 7 days" rolling, not calendar week. Useful for "right now, what does my recent usage look like."

**Day boundaries.** Days are bucketed in the user's local timezone, detected at startup via `Intl.DateTimeFormat().resolvedOptions().timeZone`. The detected timezone is shown in ABOUT and can be overridden by the user (useful for travellers who want to keep their "home" timezone). All HISTORY and STATS pages use this same timezone for day boundaries.

**Chart.** Stacked bars showing peak (bright) and off-peak (dim) per day for the last 7 days. Limit hit markers above bars per option A (stacked red ticks).

**Stat cards (4 across).**

| Card | Source |
|---|---|
| TOTAL | Sum of tokens across last 7 days |
| PEAK % | Peak tokens / total tokens |
| LIMIT HITS | Count of limit hit events in the last 7 days |
| AVG/DAY | Average tokens per **active day** only (days with at least one logged turn). Inactive days are excluded from the denominator |

**Why active days only?** A user who works heavily Mon–Fri and rests on weekends would see misleadingly low AVG/DAY numbers if all 7 days were divided into. Active-day average reflects "how heavy is a working day for me," which is the question users actually want answered. See GLOSSARY.md → Active day.

**Manual limit hit entry.** Limit hits are normally detected automatically from 429 responses in the session JSONL. If detection misses one, the user can log it manually via:

- A button on this page: `[+ LOG LIMIT HIT]`
- A VS Code command palette entry: `Pip-Token: Log Limit Hit`
- A button in ABOUT for the same purpose

**v1 manual entry is "now only".** The user clicks the button and Pip-Token records a limit hit at the current timestamp using the current peak/off-peak counts. Back-dated entry (specifying a time earlier in the day) is deferred to v2.

**Mascot.** `owl-stats.png` (clipboard).

**Default selected card.** TOTAL.

### 5.5 STATS / COST

**Purpose.** Past 7 days of token consumption shown as estimated API-equivalent cost.

**Disclaimer banner (pinned to top of page).** A small bordered notice above the chart, in mid-green text:

> ESTIMATED API-EQUIVALENT COST. Subscription users are not charged per token. This shows what your usage would cost if you were on the pay-as-you-go API.

The same disclaimer is repeated in ABOUT under the explainer "Why are some numbers labelled EST.?"

**Chart.** Stacked bars showing peak vs off-peak cost per day for the last 7 days. Same visual treatment as STATS/TOKENS but y-axis is currency.

**Stat cards (3 across).**

| Card | Source |
|---|---|
| TOTAL | Sum of cost in user's currency across last 7 days |
| AVG {CURRENCY}/DAY | Average cost per **active day** only (days with at least one logged turn). Inactive days excluded from denominator. See GLOSSARY.md → Active day |
| LIMIT HITS | Count of limit hit events in the last 7 days |

**Cost calculation source.** Pricing is read from a single configuration file at `src/domain/pricing.json` (or equivalent). The file contains per-model input and output token prices, the date the snapshot was taken, and the source URL on Anthropic's docs. **All cost calculations across the extension read from this one file.** When Anthropic changes prices, the maintainer edits this file once and the change propagates everywhere. The build should pull current pricing from public docs when first creating this file.

**Currency.** Detected from system locale on first run, overridable in ABOUT. Currency conversion uses a fixed exchange rate snapshot stored alongside the pricing file. Live FX is out of scope for v1.

**Mascot.** `owl-stats.png`.

**Default selected card.** TOTAL.

---

**Note: STATS / EFFICIENCY is removed from v1 scope.** It was originally planned as a third STATS sub-page showing the output:input token ratio over time. Removed because the metric is conceptually fuzzy (high ratio could mean "great efficiency" or "Claude rambled in response to a simple question") and the visualisation cost (a new chart type) is high for unclear value. Added to section 14 (Out of scope for v1) for v2 reconsideration.

The STATS sub-menu therefore has only two sub-pages in v1: `TOKENS | COST`.

### 5.6 HISTORY / WEEK

**Purpose.** Calendar week view (Mon–Sun) of token consumption.

**Week start.** Weeks always start on **Monday** and end on Sunday, regardless of the user's locale. Hardcoded to avoid the US/EU difference creating confusion. The first day of the displayed week is always the most recent Monday on or before today.

**Period navigation.** Arrow controls in the page header allow the user to step backwards through previous weeks: `[◄] WEEK OF 31 MAR [►]`. The right arrow is greyed out when on the current week (since there's no future). To return to the current week from a past view, the user clicks `[►]` repeatedly until they're back. Same arrow pattern is used on MONTH, QUARTER, and YEAR pages. No "today" shortcut button in v1 — keeps the UI clean and matches the constraint of "minimum viable nav."

**Chart.** Same stacked-bar pattern as STATS/TOKENS but pinned to the displayed calendar week. Y-axis shows tokens. Day labels MON–SUN. Limit hit markers per option A (stacked red ticks, fall back to `!N+` count badge above 5 hits per day).

**Stat cards (4 across).**

| Card | Source |
|---|---|
| TOTAL | Sum of tokens across the displayed week |
| PEAK % | Peak tokens / total |
| LIMIT HITS | Count of limit hit events in the displayed week |
| AVG/DAY | Average tokens per **active day** only, within the displayed week |

**Advisory examples.**
- If peak % > 50%: "{N}% of your tokens this week ran during peak hours. Shifting heavy work to evenings could reduce limit hits."
- If limit hits > 0: "You hit limits on {days}. Your busiest day was {day} with {tokens}."
- If viewing a past week: "Viewing past week. Click ► to move forward."

### 5.7 HISTORY / MONTH

**Purpose.** This calendar month's usage, aggregated by week.

**Month start.** A month starts on the **1st** and ends on the last day of the month. Weeks within the month are counted from day 1: Week 1 is days 1–7, Week 2 is days 8–14, Week 3 is days 15–21, Week 4 is days 22–28, and Week 5 (when present) covers days 29–end. This means most months have a partial Week 5 of 1–3 days. That's fine because bars show daily averages, not totals — see below.

**Period navigation.** Arrow controls: `[◄] APRIL 2026 [►]`. Right arrow greyed out when on current month.

**Chart.** Stacked bars showing **average daily tokens per week** (peak and off-peak split, calculated over active days only within each week). Showing daily averages instead of weekly totals means the partial Week 5 is comparable to the full earlier weeks — a partial week with high daily averages is a heavy week, regardless of how many days it contained.

**Limit hit markers.** At the monthly scale, stacked ticks become noisy. Use the **`!N` count badge by default** above each bar — shows total limit hits in that week as a single number rather than individual ticks.

**Stat cards (4 across).**

| Card | Source |
|---|---|
| TOTAL | Sum of tokens across the displayed month |
| PEAK % | Peak tokens / total |
| LIMIT HITS | Count this month |
| AVG/DAY | Average tokens per active day across the whole month |

**Advisory examples.**
- If a week's daily average is 2x+ the month's overall daily average: "Week {N} was unusually heavy — {N}x your monthly daily average."
- If viewing a past month: "Viewing past month. Click ► to move forward."

### 5.8 HISTORY / QUARTER

**Purpose.** Current calendar quarter, aggregated by month.

**Period navigation.** Arrow controls: `[◄] Q2 2026 [►]`. Right arrow greyed out when on current quarter.

**Chart.** Three stacked bars showing **average daily tokens per month** (peak and off-peak split, active days only). Same daily-average treatment as MONTH for the same comparability reason. Limit hit count badges (`!N`) above each bar.

**Stat cards (4 across).**

| Card | Source |
|---|---|
| TOTAL | Sum of tokens across the quarter |
| PEAK % | Peak tokens / total |
| LIMIT HITS | Count this quarter |
| AVG/DAY | Average tokens per active day across the whole quarter |

### 5.9 HISTORY / YEAR

**Purpose.** Current calendar year, aggregated by month.

**Period navigation.** Arrow controls: `[◄] 2026 [►]`. Right arrow greyed out when on current year.

**Chart.** Twelve bars showing **average daily tokens per month** (active days only). For months earlier than today, the bar shows real data. For months later than today in the current year, **no bar is drawn** — the slot is empty. No projections in v1. Limit hit count badges above each completed month.

**Stat cards (4 across).**

| Card | Source |
|---|---|
| YR SO FAR | Sum of tokens from January 1 through today |
| PEAK % | Peak tokens / total |
| LIMIT HITS | Count this year |
| AVG/DAY | Average tokens per active day across the whole year so far |

**No projections in v1.** The original spec showed dimmed projection bars for future months with a `PROJ EOY` card. Removed because linear projection from year-to-date is naive and would mislead users with bursty patterns. Future months are simply blank. Reconsidered for v2 once we have a less naive projection model.

### 5.10 TIPS

**Purpose.** Curated tips for reducing token usage. Cycled and grouped by category.

**Sub-pages.** CACHE, PEAK HOURS, CONTEXT, OTHER.

**Layout.** Scrollable list of tip cards. Each card is a bordered box with a tip number, a short title, and 2-3 sentences of body copy. No mascot per tip — single mascot at top of page. Status bar persistent at bottom.

**Footer block.** Below the tip list, a small bordered notice:

> Have a tip to share or a correction to suggest? Let me know on X — **@StudioZedward**

**Mascot.** `owl-tips.png` (lightbulb).

**Initial tip content.** Pip-Token ships with ~20 hand-written tips, distributed across the four categories. Examples:

CACHE category:
- "Don't take 5+ minute breaks during a session — the prompt cache expires and your next message re-reads everything at full cost."
- "Group small questions together rather than asking them across separate sessions."

PEAK HOURS category:
- "Anthropic's peak hours are weekdays 5–11am Pacific / 1–7pm GMT. Schedule heavy refactors outside this window."
- "If you're in the UK, save big tasks for after 7pm GMT — your tokens go ~50% further."

CONTEXT category:
- "Use /clear between unrelated tasks to reset Claude Code's context window."
- "Add specific files with @ rather than letting Claude Code scan the whole project."

OTHER category:
- "Use Sonnet for routine work and only switch to Opus for genuinely hard problems."
- "Long Markdown CLAUDE.md files get loaded every session — keep them tight."

### 5.11 ABOUT

**Purpose.** Plugin info, settings, version, credits, explanations of how Pip-Token works, and the in-app glossary.

**Layout.** ABOUT now has **two sub-pages** (an exception to the original "ABOUT has no sub-pages" rule). The sub-menu reads `INFO | GLOSSARY`.

#### 5.11.1 ABOUT / INFO

**Sections.**

- **PIP-TOKEN v0.1** header with the about owl mascot
- **Plan tier** dropdown (Free / Pro / Max 5x / Max 20x) — changing this re-seeds threshold estimates
- **Currency** dropdown (USD / GBP / EUR / etc.) auto-detected from locale, user-overridable
- **Timezone** display (auto-detected via `Intl.DateTimeFormat`) with override option for travellers
- **Sound** toggle (blip on tab change) — default on
- **CRT flicker** toggle — default on
- **Sync with dashboard** button — opens the dashboard sync modal (see section 5.12)
- **Log limit hit now** button — manually records a limit hit at the current time using current peak/off-peak counts. Also available via VS Code command palette as `Pip-Token: Log Limit Hit`
- **Reset history** button (with confirmation) — wipes all stored data
- **Export data** button — exports counters and limit hit log to CSV
- **Version**, **Claude Code version detected**, and **GitHub link**

**Feedback footer.** Below the settings list:

> Found a bug or want to request a feature? Let me know on X — **@StudioZedward**

**Explanatory sub-sections (collapsible).** Below the settings, four short explainers help users understand metric behaviour:

- **"Why does it say LEARNING?"** Explains that some metrics need warmup data before they become meaningful: BURN RATE needs 5 minutes of activity, EST. TIME TO LIMIT needs at least one limit hit recorded, projection metrics need several weeks of data. Explains how the user can resolve each (the answer is usually "keep using Pip-Token, it will fill in").
- **"How are active projects detected?"** Explains that Pip-Token watches Claude Code's session files in `~/.claude/projects/` and considers a project "active" if its session file has been modified in the last 2 hours. Lists the currently detected active projects with their last activity time. Notes that switching to `[ALL PROJECTS]` aggregates everything (where applicable), which is the honest view against your account-wide limits.
- **"Why should I sync with the dashboard?"** Explains that Pip-Token only sees Claude Code usage. If the user also uses Claude.ai chat, the mobile app, or third-party tools that hit the Anthropic API, those tokens still count against the same account limits but Pip-Token can't see them directly. Periodic dashboard sync closes this gap by letting Pip-Token learn the difference between what it tracked locally and what Anthropic sees overall. Users who only use Claude Code can ignore this. Recommended sync frequency: once a day or whenever you notice projections feel optimistic.
- **"Why are some numbers labelled EST.?"** Explains the EST. prefix and the tilde marker, points users at the cost framing in particular (subscription users are not actually charged per token).
- **"Why does cache assume 5 minutes?"** Explains that Anthropic offers both a 5-minute and a 1-hour prompt cache, that 5-minute is the default and most common, and that Pip-Token can't reliably detect which TTL is active from log data. So we hardcode the 5-minute assumption. Users on the 1-hour cache may see their cache marked EXPIRED early — a known false-negative we accept.

**Mascot.** `owl-about.png` (waving).

#### 5.11.2 ABOUT / GLOSSARY

**Purpose.** In-app rendering of the full GLOSSARY.md content, styled in Pip-Boy aesthetic so users can look up term meanings without leaving the extension.

**Layout.** Scrollable Pip-Boy text panel rendering the glossary content. Section headers (`## Sessions and projects`, etc.) styled as bright green ALL CAPS with underline. Term headers (`### Active session`) styled as inverted blocks (bright green background, dark text) for visual rhythm. Body text in normal phosphor green. Code blocks (the SQL-ish data structure examples) shown in slightly dimmer green within bordered boxes. Internal references like "see GLOSSARY.md → Active day" become clickable anchors that scroll to the relevant term.

**Source of truth.** The page content is generated at build time from `GLOSSARY.md` so the documentation file and the in-app rendering can never drift apart. The build pipeline reads the markdown file, applies a Pip-Boy-styled HTML template, and bundles the result as the GLOSSARY sub-page content.

**Mascot.** Reuses `owl-about.png`.

### 5.12 Dashboard sync modal

**Purpose.** Capture the user's current Anthropic dashboard percentages and turn them into a calibration record.

**Trigger.** User clicks the SYNC WITH DASHBOARD button in ABOUT, or follows a "Sync recommended" advisory shown elsewhere.

**Layout.** A small Pip-Boy modal overlay (not a full page) with:

- Title: `DASHBOARD SYNC`
- Instructional text: "Open Anthropic's Settings → Usage page in your browser. Read the current 5-hour and weekly usage percentages and enter them below. Pip-Token will use the difference to learn how much non-Code usage you have."
- A link or button: `[OPEN ANTHROPIC DASHBOARD]` — opens https://claude.ai/settings/usage in the user's browser via VS Code's `env.openExternal` API
- Two number input fields:
  - `5-HOUR USAGE %` — accepts 0–100, integer or one decimal place
  - `WEEKLY USAGE %` — accepts 0–100, integer or one decimal place
- Last sync display: "Last synced 2h 14m ago — 5h: 38%, weekly: 19%" — or "Never synced" for first-time users
- Buttons: `[CANCEL]` and `[SAVE SYNC]`

**On save.** Pip-Token writes a sync record to the database, recalculates the OTHER bucket delta, updates personal thresholds and projections, and closes the modal. A brief confirmation toast appears: "Sync saved. OTHER bucket updated."

**Validation.** Both fields must be 0–100. If a value is suspiciously low (e.g. user enters 0% when the previous sync was 47% an hour ago), show a confirmation: "That's lower than your last sync. Did Anthropic reset your window? [CONFIRM] [CANCEL]". This catches typos.

**Mascot.** Reuses `owl-about.png`.

### 5.13 Onboarding (first run)

**Purpose.** Get the user set up with plan tier and currency before showing them an empty dashboard.

**Layout.** A single full-screen Pip-Boy panel that takes over the extension window on first launch.

**Steps.**

1. Welcome screen with the about owl: "WELCOME TO PIP-TOKEN. Tracking your Claude Code usage one token at a time. [CONTINUE]"
2. Plan tier selection with each plan as a stat row, user clicks to select.
3. Currency confirmation: "We've detected your locale as GBP. Is this correct? [YES] [CHANGE]"
4. Final screen: "READY. Pip-Token will now track your usage. Some metrics will show LEARNING until enough data accumulates. [START]"

**Empty state messaging.** Until the user accumulates limit hit events, projection fields show the `LEARNING` state (see GLOSSARY.md) in green-mid colour. EST. TIME TO LIMIT and personal threshold cards display `LEARNING` as their value. Once data accumulates, these automatically resolve to real numbers with no UI reload required.

---

## 6. Status bar

The status bar appears **only inside the extension window**, at the bottom of every page. There is no VS Code-native bottom-strip rendering in v1.

**Why no VS Code native status bar in v1.** Earlier drafts of the spec included a parallel rendering in VS Code's persistent bottom strip, but the native API is heavily constrained (text-only, limited colour control) and the constrained version would deliver limited value relative to its build cost. Removed from v1 to keep the build focused. Reconsidered for v2 if users specifically request it.

**Status bar segments (in-window).** Four segments in this order:

| Segment | Format | Notes |
|---|---|---|
| PEAK / OFF-PEAK | `PEAK` (red bg, red text, red border) or `OFF-PEAK` (green) | Red ONLY when in peak hours |
| Context | `CTX 124K/200K` | Live current-turn context fill for the most recently active session |
| Burn rate | `BURN 1.2K/MIN` | Rolling 5-min average across all active sessions |
| Cost (week) | `WK £3.40` | Week-to-date estimated API-equivalent cost (since Monday 00:00 in the user's local timezone), in user currency. Distinct from STATS "rolling 7 days" — see GLOSSARY.md "Week periods" |

Order matters because the leftmost segment is the most-glanced. Peak indicator is leftmost because it's the most actionable signal.

The status bar always shows aggregated data across all active sessions, regardless of any project filter active on the current page. Its job is to answer "where do I stand against my account limits" — that's account-wide.

---

## 7. Data model

### Counters (current 5-hour window)

```
window_id              UUID
window_started_at      timestamp
peak_input_tokens      int
peak_output_tokens     int
offpeak_input_tokens   int
offpeak_output_tokens  int
model                  string
```

A new window is created either (a) when the previous window's 5-hour timer elapses, or (b) when a limit hit event is logged (the limit hit closes the current window and opens a new one).

### Limit hit events

```
event_id                       UUID
timestamp                      timestamp
window_id                      UUID (the window that hit the limit)
peak_tokens_at_hit              int
offpeak_tokens_at_hit           int
limit_type                      enum: SESSION_5H, WEEKLY
model                           string
detected_via                    enum: API_ERROR, MANUAL_LOG, INFERRED
```

### Sessions (Claude Code sessions)

```
session_id      string (from Claude Code's session UUID)
started_at      timestamp
ended_at        timestamp (nullable while active)
project_path    string
model           string
total_input     int
total_output    int
total_cost_minor int (minor units of user currency, e.g. pence or cents — see src/domain/CLAUDE.md rule on money math)
```

### Turns (individual interactions within a session)

```
turn_id            TEXT PRIMARY KEY (content hash — see ADR 0017)
session_id         string
timestamp          timestamp
input_tokens       int
output_tokens      int
cache_creation     int (cached prompt write tokens)
cache_read         int (cached prompt read tokens)
context_tokens     int (estimated total context for the turn)
peak_window        boolean
model              string
```

The `turn_id` is derived by hashing `session_id + timestamp + input_tokens + output_tokens` rather than generated as a random UUID. This makes ingestion idempotent — re-parsing the same JSONL line (which happens on every VS Code restart until the file-offset cache kicks in) produces the same ID, and the insert is absorbed by `INSERT OR IGNORE`. Without this, restarts would multiply counters. See ADR 0017 and `watcher_state` below.

**Peak/off-peak classification.** A turn's `peak_window` boolean is decided from its recorded timestamp only — specifically the assistant-response timestamp written by Claude Code. A turn that begins at 10:58 Pacific and finishes at 11:02 Pacific is classified entirely by whichever timestamp lands in the log (typically the response time, so 11:02 = off-peak). Boundary-straddling turns are not split across buckets. This is intentional: token counts are per-turn, not per-second, and attempting to pro-rate would introduce more error than it removes.

### Watcher state (file offset cache)

```
file_path              TEXT PRIMARY KEY
last_byte_offset       int
last_modified_at       timestamp
last_parsed_at         timestamp
```

Tracks how many bytes of each JSONL file the parser has already consumed. On `claudeCodeWatcher.start()`, each tracked file is resumed from `last_byte_offset` instead of being re-read from zero. This is a performance optimisation — correctness is already guaranteed by the content-addressed `turn_id` above. If the offset cache is corrupted or wiped, the parser re-reads from zero and the idempotent IDs dedupe naturally.

### Settings (singleton)

```
plan_tier         enum: FREE, PRO, MAX_5X, MAX_20X
currency          enum: USD, GBP, EUR, ...
sound_enabled     boolean
flicker_enabled          boolean
first_run_at             timestamp
onboarding_completed_at  timestamp (nullable — NULL until user clicks "Finish" on the last onboarding step)
```

**First-run detection uses `onboarding_completed_at IS NULL`, not row presence.** A user who closes VS Code halfway through onboarding will have a partial settings row written by each step (plan tier, currency, etc.) but the `onboarding_completed_at` field stays NULL until they complete the final "Finish" click. On next launch, the onboarding flow reappears and the user can resume from where they left off. Each onboarding step writes only its own field so partial completion never leaves the DB in an incoherent state.

### Dashboard syncs (manual calibration records)

```
sync_id              UUID
timestamp            timestamp
fivehour_pct         decimal (0-100, e.g. 47.0)
weekly_pct           decimal (0-100, e.g. 23.0)
code_tokens_at_sync  int   (Pip-Token's own measured CODE total in current window)
inferred_other       int   (computed delta attributed to OTHER bucket)
plan_tier_at_sync    enum  (snapshot of plan tier in case user changes it later)
```

Each row records one user-initiated sync. Append-only — old syncs stay in the database forever for audit and trend analysis. The most recent sync drives current OTHER bucket values; older syncs are used to detect whether the user's chat/API usage patterns are stable or drifting.

### Storage

SQLite database stored in VS Code's `globalStorage` directory for the extension. Single file, e.g. `pip-token.db`. All writes are append-only except for the singleton settings row and the current open window counters.

**Concurrency.** The database is opened in WAL (write-ahead logging) mode with a 5-second busy-timeout, so multiple VS Code windows can safely share it without blocking or corruption. Counter updates to the current window use atomic `UPDATE windows SET peak_input_tokens = peak_input_tokens + ?` increments rather than read-modify-write cycles, which prevents two windows from racing to overwrite each other. See ADR 0018.

---

## 8. Data sources

### Primary: Claude Code session logs

Claude Code stores session data as JSONL files in `~/.claude/projects/<project-hash>/<session-id>.jsonl`. Each line is a JSON event representing a turn or system action. Pip-Token watches this directory using VS Code's `FileSystemWatcher` API, reads new lines as they're appended, and parses out token counts and timestamps.

**This format is undocumented and may change between Claude Code versions.** Pip-Token must:
- Version-detect the Claude Code installation on startup
- Apply a parser appropriate to that version
- Fail gracefully (show an "UNSUPPORTED CLAUDE CODE VERSION" message) rather than crash if the parser doesn't recognise the format

### Secondary: API error responses

When Claude Code receives a 429 rate limit response from the Anthropic API, it logs the error in the session JSONL. Pip-Token watches for these errors and logs them as `LIMIT_HIT` events with `detected_via = API_ERROR`.

### Manual fallback

If automatic limit detection fails or misses a hit, the user can manually log a hit via a button in ABOUT or a context menu item: "I just hit a limit". This logs an event with `detected_via = MANUAL_LOG`.

### Tertiary: Dashboard sync (manual)

The user opens Anthropic's Settings → Usage page in any browser, reads the displayed 5-hour and weekly usage percentages, and types them into the dashboard sync modal in Pip-Token (see section 5.14). Pip-Token records the values, computes the delta against its own locally-measured CODE tokens, and attributes the difference to the OTHER source bucket.

This is the only way Pip-Token learns about Claude.ai chat, mobile app, or third-party API usage. It is entirely user-initiated — Pip-Token does not call any Anthropic API, scrape any web page, or automate the sync in any way. Users who only use Claude Code can ignore this workflow entirely.

### Not used

Pip-Token does **not** call the Anthropic Admin API. The Admin API is org-level and aggregated daily, not useful for real-time individual tracking.

Pip-Token does **not** intercept network traffic from Claude Code (no proxy mode). This was considered and rejected as too invasive.

---

## 9. Limit hit detection

A limit hit is detected when one of the following occurs:

1. **API error in session log.** The session JSONL contains an entry with HTTP status 429 and an Anthropic-formatted rate limit error message. Pip-Token captures the timestamp and the current window's peak/off-peak token counts.

2. **Manual log.** The user clicks "I just hit a limit" in the UI. Same data captured, `detected_via = MANUAL_LOG`.

3. **Inferred from gap.** If the session log shows a 5+ minute gap immediately after a 429-like error pattern, Pip-Token infers a limit hit even if the explicit error format wasn't recognised. Lower confidence — flagged as `detected_via = INFERRED`.

After a limit hit is logged, the current window is closed and a new window is opened with all counters reset to zero. The historical hit is preserved permanently.

---

## 10. Advisory engine

Advisories are short single-sentence prompts shown in the dashed advisory box on each page. They are generated by a simple rules engine that runs after each data update.

### Rule format

Each rule has:
- A page scope (which pages it can fire on)
- A condition (a function over the current data state)
- A message template (with variable substitution)
- A priority (1-10, highest wins if multiple rules match)

### Initial rule set

Hardcoded in v1. Stored as a JSON or TS file in the extension source. Future versions could allow user-defined rules.

### Examples

```
{
  page: "LIVE/SESSION",
  condition: (data) => data.burnRate > data.historicalAvgBurnRate * 1.5,
  message: "Burn rate is {burnRate}, ~{multiplier}x your typical pace.",
  priority: 8
}

{
  page: "LIVE/CONTEXT",
  condition: (data) => data.loadedFilesPct > 0.5,
  message: "Files dominate your context. Consider /clear before next task to reset.",
  priority: 6
}

{
  page: "HISTORY/WEEK",
  condition: (data) => data.peakPercent > 0.5,
  message: "{peakPercent}% of your tokens this week ran during peak hours. Shifting heavy work to evenings could reduce limit hits.",
  priority: 7
}
```

### Display rules

Only the highest-priority matching advisory is shown per page. If no rules match, no advisory is shown (the dashed box is hidden, not shown empty).

Advisories must reference real data from the current view, not generic tips. Generic tips live in the TIPS page.

---

## 11. Cold start

A new user has zero historical data. Pip-Token must remain useful from the moment of installation while being honest about what it doesn't know.

All "I don't have enough data yet" cases use the **LEARNING** state defined in GLOSSARY.md, never zeros or fabricated values.

### Day 0

- All counters start at zero
- `BURN RATE` shows `LEARNING — WAIT 5 MINS`
- `EST. TIME TO LIMIT` shows `LEARNING`
- All raw counters (INPUT TOKENS, OUTPUT TOKENS, etc.) display normally — these don't need history to be meaningful
- Charts on STATS and HISTORY pages show "LEARNING — BUILDING DATA" until at least 1 day of data exists

### After first session

- Live counters work normally
- BURN RATE computes after 5+ minutes of activity (LEARNING state lifts)
- Cache hit rate computes after 10+ turns

### After first limit hit

- `EST. TIME TO LIMIT` becomes computable, shown with tilde prefix (`~3H 14M`) until 5 hits accumulate
- Personal threshold cards show real values
- After 5+ hits, the tilde prefix drops
- Drift detection becomes possible after 3+ hits

### Never seeded with community data

Pip-Token is local-first and makes no network calls without your consent. It does not call any backend by default, does not share user data, and does not seed thresholds from community averages. The plan tier selection is the only "seed" — and even that just uses rough public estimates labelled as such. Opt-in anonymous analytics is being considered for v2 but is not present in v1.

---

## 12. Settings and onboarding

### First run

The extension detects no existing settings row and triggers the onboarding flow described in 5.13.

### Settings storage

The settings row is a single record in the SQLite database. Edited via the ABOUT page.

### Plan tier rough estimates (for cold start only)

These are placeholder thresholds shown to new users until real limit-hit data exists. They are clearly labelled as "ROUGH ESTIMATE — based on public reports" and replaced as soon as the user accumulates 3+ personal limit hits.

| Plan | 5h estimate | Weekly estimate |
|---|---|---|
| Free | ~25k tokens | ~150k tokens |
| Pro | ~225k tokens | ~1.5M tokens |
| Max 5x | ~1.1M tokens | ~7.5M tokens |
| Max 20x | ~4.5M tokens | ~30M tokens |

These numbers are placeholders. The build process should re-verify them against current public reports before shipping.

---

## 13. Honest limitations (non-negotiable)

These limitations must be reflected in the UI and never hidden behind false confidence.

1. **Pip-Token does not know your actual remaining quota.** It tracks tokens locally and estimates from your history. The Anthropic dashboard remains the source of truth.

2. **Pip-Token only sees Claude Code usage directly.** Claude.ai chat, the mobile app, and third-party tools that hit the Anthropic API all consume from the same account-wide limits but don't write local files Pip-Token can read. Users who split work across these surfaces should periodically use the dashboard sync workflow (see GLOSSARY.md → Dashboard sync) to keep projections accurate. Users who only use Claude Code don't need to sync. The UI must clearly indicate the OTHER bucket's last sync time so users understand the freshness of the data.

3. **Peak/off-peak multipliers are not modelled.** Pip-Token tracks peak and off-peak as separate counters and lets the user's history reveal the relationship empirically.

4. **Limit hits are best-effort detected.** If Claude Code's log format changes, detection may break. The manual logging fallback exists for this reason.

5. **Cost is API-equivalent, not subscription cost.** Subscription users are not actually charged per token. The cost figure is a useful proxy but must be labelled as estimated API-equivalent cost.

6. **Context breakdown may not be available.** If Claude Code's logs only expose total context tokens, the segmented breakdown collapses to a single bar. Document the actual capability in TOKEN_DATA_RESEARCH.md.

7. **Cache hit rate is estimated.** Without explicit cache hit/miss flags in Claude Code's logs, Pip-Token infers cache state from timing gaps. Mark estimated values clearly.

---

## 14. Out of scope for v1

These are deliberately deferred to keep v1 shippable:

- **STATS / EFFICIENCY sub-page.** The output:input ratio metric is conceptually fuzzy and the line chart is a new visual element. Reconsider for v2 once we know what users actually want.
- **Back-dated manual limit hit entry.** v1 only allows logging a hit "now." v2 will add a date/time picker so users can record hits they noticed earlier in the day.
- **VS Code native status bar item.** The constrained text-only rendering would deliver limited value relative to its build cost. Reconsider for v2 if users specifically request it.
- **Projection bars in HISTORY/YEAR.** Removed because linear projection from year-to-date is naive. Reconsider for v2 with a smarter projection model.
- **Per-source context breakdown (LIVE/CONTEXT).** Deferred pending parser investigation. See Q11 in TOKEN_DATA_RESEARCH.md.
- **In-bar limit hit markers** (the option D from the marker discussion). Requires per-event timestamps, may not be reconstructable from logs.
- **Cache lifetime toggle.** Read-only and assumed 5-min in v1.
- **Multi-user / team features.** Pip-Token is single-user, single-machine.
- **Crowdsourced thresholds.** No backend, no data sharing.
- **Pause / resume tracking.** Always-on.
- **Custom advisory rules.** Hardcoded in v1.
- **Multiple model comparison view.** Sonnet vs Opus comparison would be useful but is v2.
- **Browser extension companion.** Would unlock direct chat tracking. Manual dashboard sync is the v1 substitute.
- **Opt-in anonymous analytics.** Considered and deferred to v2. v1 makes zero network calls of any kind. If we add analytics in v2, it will be opt-in only, default off, with full disclosure of what gets collected and a public dashboard. See ADR 0004 for the framing.
- **Sound effects beyond the blip.** No background hum, no startup jingle.
- **Mobile companion.** Not happening.
- **Live FX rates for currency conversion.** Fixed snapshot in v1.
- **"Today" return shortcut on HISTORY pages.** Arrow nav only in v1.

---

## 15. File deliverables for the build

The build will receive the following files alongside this DESIGN.md:

- `GLOSSARY.md` — single source of truth for all terms used in the spec and UI. Read this first.
- `REPO_SETUP.md` — repo structure, distributed CLAUDE.md pattern, LESSONS.md convention, and Milestone 0 instructions. Claude Code follows this exactly during M0.
- `mockups.html` — single HTML file with all pages rendered statically. Visual reference for Claude Code to match against. Note that mockups predate some spec revisions — DESIGN.md is authoritative.
- `ARCHITECTURE.md` — technical structure, file tree, technology choices, build commands.
- `TOKEN_DATA_RESEARCH.md` — open questions about Claude Code's log format that the build needs to investigate before implementing log parsing.
- `CLAUDE_CODE_BUILD_PROMPT.md` — the kickoff prompt to paste into Claude Code.
- `assets/owl-live.png`, `owl-stats.png`, `owl-history.png`, `owl-tips.png`, `owl-about.png` — mascot artwork.

All design files live in `docs/` once the repo is set up. The owl PNGs live in `assets/`.
