# Pip-Token — Build-time TODO

Items identified during the pre-submission design review (April 2026) that are **not blocking the submission** but should be picked up during the build with Claude Code. Each item has enough context that you can paste it into Claude Code as a task.

Order is rough priority — resolve the top ones earlier in the milestone they touch.

---

## 1. Lock down `retainContextWhenHidden` (M1 or M2)

**Where.** `ARCHITECTURE.md` §"Open architectural questions" item 1 says *"Probably yes for this use case — losing live state every time the user switches tabs would be annoying. Tradeoff: higher memory."* `REPO_SETUP.md` `/src/webview/CLAUDE.md` skeleton treats it as a firm rule.

**Why it matters.** The two documents disagree on whether this is decided. A webview with `retainContextWhenHidden: true` stays in memory even when the user switches away from the Pip-Token panel, which keeps live counters ticking but costs ~20–40 MB of RAM per VS Code window. Without it, switching tabs drops the webview and all live state resets on return.

**What to do.** Decide firmly during M1 when you first instantiate the webview panel. Recommend: **`retainContextWhenHidden: true`** because live counters are the core value proposition and losing them on tab switch would be actively user-hostile. Update `ARCHITECTURE.md` to drop the "probably" hedging and write a short ADR (0019) capturing the decision and the memory tradeoff. Measure actual memory cost during M6 polish and revisit if it's unexpectedly high.

---

## 2. Plan tier enum extensibility (M2)

**Where.** `DESIGN.md §7` settings table: `plan_tier enum: FREE, PRO, MAX_5X, MAX_20X`.

**Why it matters.** Anthropic's plan structure changes occasionally — Team plans already exist, tier names have been reshuffled before, and the Max tiers were introduced mid-2025. A hardcoded enum means that when Anthropic adds a new tier, existing Pip-Token users can't select it without upgrading the extension, and the build phase onboarding screen needs a code change.

**What to do.** Two options to pick from during M2:
- **(a)** Treat `plan_tier` as a free-text string backed by the values in `planTierDefaults.ts`. The onboarding dropdown reads its options from the same file. When Anthropic adds a tier, update one file.
- **(b)** Keep the enum but include an `OTHER` value that lets users describe their own threshold manually in ABOUT. Simpler UI, slightly worse onboarding for non-standard users.

I'd lean (a). Document whichever you pick in a short ADR (0020). Also note in the onboarding flow that users should pick "closest tier" if theirs isn't listed.

---

## 3. Pricing snapshot staleness warning (M4 or M7)

**Where.** `DESIGN.md §7`, `ADR 0014`, `src/domain/pricing.json`.

**Why it matters.** Anthropic adjusts API pricing occasionally and the currency exchange rate snapshot inside `pricing.json` is fixed at build time (see ADR 0014). A user who installs Pip-Token eight months after release could see GBP cost figures that are 10%+ off reality, with no indication that the numbers are stale.

**What to do.** Add a `snapshot_date` field to `pricing.json` (probably already there per ADR 0014 wording — verify). On every extension activation, compare `snapshot_date` to today. If older than 90 days, show a persistent warning on the STATS / COST page and in ABOUT: `PRICING SNAPSHOT IS N DAYS OLD — COST FIGURES MAY BE INACCURATE. UPDATE PIP-TOKEN FOR CURRENT RATES.` Do this during M4 when STATS / COST is built, or defer to M7 polish if M4 is running long. No new ADR needed.

---

## 4. Plan tier threshold numbers re-verification (before M7 package)

**Where.** `DESIGN.md §12` plan tier rough estimates table.

**Why it matters.** The current values (Free 25k/150k, Pro 225k/1.5M, Max 5x 1.1M/7.5M, Max 20x 4.5M/30M) are labelled as placeholders that should be re-verified before shipping. No process currently tells Claude Code to do that verification.

**What to do.** During M7 (tests and packaging), ask Claude Code to web-search current Reddit/Discord/blog posts reporting observed Claude Code session and weekly limits for each plan tier. Update `DESIGN.md §12` and `src/domain/planTierDefaults.ts` with whatever the latest community data suggests. Document the sources and the date inside `planTierDefaults.ts` as a comment. These are only used as cold-start placeholders until the user accumulates three real limit hits, so precision is less important than being in the right order of magnitude.

---

## 5. WAL sidecar file note for README troubleshooting (M7)

**Where.** `ADR 0018` consequences section.

**Why it matters.** WAL mode creates a `pip-token.db-wal` sidecar file next to the main database. Users who poke around `globalStorage` might see it and think something is wrong or be tempted to delete it (which would lose unflushed writes).

**What to do.** Add a one-paragraph note to the README troubleshooting section: "You may see `pip-token.db-wal` and `pip-token.db-shm` files next to `pip-token.db`. These are SQLite's write-ahead log files and are part of normal operation — don't delete them."

---

## 6. Glossary in-app rendering quality check (M5)

**Where.** ABOUT / GLOSSARY sub-page, `glossaryContent.ts` generated at build time.

**Why it matters.** `docs/GLOSSARY.md` uses markdown features (tables, headings, code blocks, bold/italic) that need to render correctly inside the webview. The build-time bake only delivers the raw string — the page still needs a markdown renderer (a lightweight one, no frameworks per ADR 0008).

**What to do.** During M5, pick a tiny markdown renderer (candidates: `markdown-it` is ~100KB which may be too heavy; consider `micromark` or a hand-rolled subset parser that only handles headings, paragraphs, bold/italic, code, and tables). Render the glossary inside the ABOUT page and visually verify every entry looks right. If the renderer trips on any GLOSSARY content, the fix goes in `docs/GLOSSARY.md` (simplify the markdown), not in code-level workarounds.

---

## 7. Sub-agent token tracking verification (M2)

**Where.** `TOKEN_DATA_RESEARCH.md` Q10.

**Why it matters.** If Claude Code spawns sub-agents for parallel work and their token counts go into separate log files (or don't get logged at all), Pip-Token will systematically under-count usage. The question is open but untested.

**What to do.** During M2 parser work, deliberately run a Claude Code task that uses sub-agents (e.g. a multi-file refactor or parallel investigation) and compare Pip-Token's resulting token count against the Anthropic dashboard for that session. Document the finding in the ADR log or update `TOKEN_DATA_RESEARCH.md` with confirmed behaviour. If there's a meaningful gap, add a note to ABOUT: "Sub-agent token tracking is approximate — dashboard remains the source of truth for exact values."

---

## Things NOT on this list (deliberately)

The medium-priority bugs I found during the review that have already been fixed in-spec and don't need a build-time task:

- **M8** (glossary page couldn't read GLOSSARY.md at runtime) — fixed: build-time bake documented in ARCHITECTURE.md and REPO_SETUP.md.
- **M9** (silent data corruption on restart) — fixed: content-addressed turn IDs in DESIGN §7 and ADR 0017.
- **M10** (SQLite concurrency / multi-window crash risk) — fixed: WAL mode in DESIGN §7 Storage, `src/data/CLAUDE.md` rules, ADR 0018.
- **M11** (onboarding can't recover from half-completion) — fixed: `onboarding_completed_at` field in DESIGN §7.
- **M12** (LIVE/CACHE was both v1 and "maybe cut") — fixed: committed to shipping with timing-based fallback.

---

## How to use this file

When you start a Claude Code session on Pip-Token, before opening the build prompt, glance at this file and decide whether any of the items fit the milestone you're about to work on. If so, paste the relevant item into your working context and let Claude Code include it in the milestone's work. Remove the item from this file once it's landed in the repo (delete the section, don't strike through — this file is a queue, not a changelog).

Add new items to the bottom as you discover them during the build. If an item turns out to need an ADR, write the ADR during the same session and link to it from here before removing the TODO entry.
