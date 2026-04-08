# Pip-Token — Token Data Research

Investigation results for Claude Code's local log format, confirmed against real JSONL logs from Claude Code version 2.1.87. Originally a list of open questions; now confirmed findings that the parser is built against.

---

## Why this document exists

Anthropic does not publish a schema for Claude Code's session logs. The format lives in `~/.claude/projects/<project-hash>/<session-id>.jsonl` and may change between Claude Code versions without notice. Everything Pip-Token shows depends on parsing these files correctly.

The previous design conversations made educated guesses about what's available. Those guesses must be verified against real log files before parser code is written. This document lists the questions and a recommended investigation procedure.

If something doesn't look right, flag my GitHub repo (StudioZedward/pip-token) or message me on X (@StudioZedward).

---

## Investigation procedure

Before writing any parser code, the build should:

1. **Locate real Claude Code logs** on the development machine. They live in `~/.claude/projects/`. There should be one subdirectory per project, each containing one or more `.jsonl` files.

2. **Inspect a sample file directly.** Open one in a text editor. Each line should be a JSON object. Pretty-print 10–20 lines and read what fields are present.

3. **Categorise the line types.** Most lines will be turn events (user message, assistant response). Others may be system events, errors, tool calls. Document each distinct event type observed.

4. **Cross-reference with Claude Code version.** Run `claude --version` and note it. Pin the parser to versions tested. Document the version range supported in `package.json`.

5. **Save 2–3 anonymised sample sessions** to `test/fixtures/sample-sessions/` for parser tests. Strip any sensitive content from the messages but keep the structural fields intact.

6. **Update this document with findings.** Replace each "open question" below with a "confirmed" answer and the field name(s) used.

---

## Confirmed findings

### Q1: What is the JSONL line schema?

**CONFIRMED** (Claude Code 2.1.87)

4 line types observed: `queue-operation`, `user`, `assistant`, `system`.

Token data is ONLY present in `assistant` type lines, at `message.usage`. Fields:
- `input_tokens` (number)
- `output_tokens` (number)
- `cache_creation_input_tokens` (number)
- `cache_read_input_tokens` (number)
- Nested: `cache_creation.ephemeral_5m_input_tokens`, `cache_creation.ephemeral_1h_input_tokens`

Other key fields:
- **Timestamp:** top-level `timestamp` field, ISO 8601 UTC with Z suffix
- **Model:** `message.model` (e.g. `"claude-opus-4-6"`)
- **Session ID:** top-level `sessionId`

**CRITICAL: Streaming chunks.** Multiple JSONL lines are emitted per API request (streaming). Lines with `stop_reason: null` are intermediate chunks. Only process lines where `stop_reason === 'end_turn'` or `stop_reason === 'tool_use'` for final token counts. The last line per `requestId` has the final `output_tokens`.

---

### Q2: Are cache hit/miss tokens explicit in the log?

**CONFIRMED** (Claude Code 2.1.87)

YES, explicit. Cache fields are present at `message.usage`:
- `cache_creation_input_tokens` — tokens written to cache on this turn
- `cache_read_input_tokens` — tokens read from cache on this turn

Additionally, `message.usage.cache_creation` contains:
- `ephemeral_5m_input_tokens` — tokens cached with 5-minute TTL
- `ephemeral_1h_input_tokens` — tokens cached with 1-hour TTL

These sub-fields reveal the actual cache TTL tier in use per turn. See ADR 0019 for how the parser uses this.

---

### Q3: Is total context size per turn available?

**CONFIRMED — NOT directly available** (Claude Code 2.1.87)

No `total_input_tokens`, `context_tokens`, or equivalent field exists. `input_tokens` on each turn is just the new incremental input for that turn, not the cumulative context window.

However, `cache_read_input_tokens` gives the cached (repeated) context size. The parser can estimate total context per turn as:

```
total_context ~ input_tokens + cache_creation_input_tokens + cache_read_input_tokens
```

**Fallback applied.** CONTEXT USED is marked as ESTIMATED in the UI. The estimate is reasonable because cached tokens represent the repeated context from prior turns.

---

### Q4: Can context be decomposed by source?

**CONFIRMED — NOT available** (Claude Code 2.1.87)

No breakdown by system prompt, file content, conversation history, or tool definitions exists in the JSONL. No `context_breakdown`, `prompt_components`, or similar field was found.

**Fallback applied.** LIVE/CONTEXT uses a single fill bar showing total estimated context. The SYSTEM PROMPT / LOADED FILES / CONVERSATION / TOOL DEFS rows are dropped from v1. Per-source breakdown stays in v2 scope.

---

### Q5: How are 429 rate limit errors logged?

**CONFIRMED — FOUND** (Claude Code 2.1.87, updated 2026-04-08)

Rate limit events ARE logged as assistant-type JSONL lines with a distinctive fingerprint:

```json
{
  "type": "assistant",
  "error": "rate_limit",
  "isApiErrorMessage": true,
  "message": {
    "model": "<synthetic>",
    "stop_reason": "stop_sequence",
    "usage": { "input_tokens": 0, "output_tokens": 0, ... },
    "content": [{ "type": "text", "text": "You've hit your limit · resets 4pm (Europe/London)" }]
  }
}
```

Detection keys: `error === "rate_limit"` AND `isApiErrorMessage === true` at the top level. The `model` is `"<synthetic>"` (not a real API response) and all token counts are zero.

**Dedup required.** Rate limits are account-wide. When the limit trips, every active session logs its own `rate_limit` event. Stale sessions that wake up during the same limit window also log one. The parser deduplicates by checking the most recent recorded limit hit — if the new event is within N minutes of the last, it's skipped. The dedup window is plan-tier-specific (configured in `pricing.json`).

---

### Q6: What model identifier is used?

**CONFIRMED** (Claude Code 2.1.87)

Model identifier is at `message.model`, using a friendly format: `"claude-opus-4-6"`. This is straightforward for pricing lookup — no date-based API ID to parse. The pricing lookup table in `costCalculator.ts` maps directly from these friendly names.

---

### Q7: Does the timestamp format require timezone handling?

**CONFIRMED** (Claude Code 2.1.87)

Timestamps are UTC ISO 8601 with Z suffix (e.g. `"2026-04-07T22:07:33.184Z"`). This is the cleanest possible case: unambiguous UTC, trivially convertible to Pacific time for peak hour classification. Standard `Date` constructor in JavaScript handles this natively.

---

### Q8: Are tool calls and tool results in the same line as the turn, or separate?

**CONFIRMED** (Claude Code 2.1.87)

Each tool use is a SEPARATE `assistant` line with `stop_reason: 'tool_use'`. Each has independent `message.usage` data. A single user question that triggers 3 tool calls produces 3 separate assistant lines (plus streaming chunks for each).

The parser treats each completed line (where `stop_reason === 'tool_use'` or `stop_reason === 'end_turn'`) as its own turn with its own token counts. This may inflate turn count slightly compared to a "logical exchange" count, but token totals remain accurate.

---

### Q9: Is there a session start/end marker?

**CONFIRMED — NO explicit markers** (Claude Code 2.1.87)

No explicit "session started" or "session ended" events exist. Sessions are implicit: they begin with the first `queue-operation` or `user` line in a JSONL file, and end when the file stops growing.

The parser uses the timestamp of the first line in the active JSONL file as session start time. Session end is determined by file inactivity (no new lines within the active session timeout window).

---

### Q10: Where do sub-agent / parallel agent token counts go?

**NOT YET VERIFIED** (Claude Code 2.1.87)

Sub-agent behavior has not been tested with a deliberate sub-agent session. It is unknown whether sub-agent tokens appear in the main session JSONL or in separate files.

**Deferred to M7.** Requires a deliberate test: run a multi-file refactor that spawns sub-agents, then compare JSONL totals against the Anthropic dashboard. Until verified, ABOUT page will note: "Sub-agent token tracking is approximate."

---

### Q11: Where does Claude Code's `/context` command get its breakdown data?

**CONFIRMED — NOT in JSONL** (Claude Code 2.1.87)

No `context_breakdown`, `prompt_components`, or similar field exists in the JSONL. The `/context` command's per-source breakdown (system prompt, loaded files, conversation, tool definitions) is computed from Claude Code's in-memory runtime state and is not persisted to disk.

This means possibility 4 from the original investigation plan is correct: the breakdown is in-memory only. Pip-Token cannot access it without injecting input into Claude Code's process, which we will not do.

**Fallback applied.** Per-source context breakdown stays in v2 scope. LIVE/CONTEXT page shows total estimated context only with a note: "Per-source breakdown coming in v2." Will monitor Claude Code release notes for any future `--print-context` flag or IPC interface that exposes this data.

---

## Open questions for the community (still open)

These are questions where the answer probably exists in the wider Claude Code user community (Reddit, Discord, GitHub issues, blog posts) rather than purely in local file inspection. Posting these somewhere visible may surface answers faster than reverse-engineering from scratch.

Anyone reading this who has insight into any of these questions is encouraged to open an issue on the Pip-Token GitHub repo. The list will grow as we discover more.

### CQ1: Has anyone reverse-engineered Claude Code's session JSONL format?
We're looking for any prior work on the schema. Even partial documentation would save the parser investigation a lot of time. If you've built a Claude Code analytics tool, dashboard, or wrapper, we'd love to compare notes.

### CQ2: Does `/context` read from a persistent file or only from runtime state?
See Q11 above. If anyone from Anthropic or anyone who has read Claude Code's source can answer this directly, it changes whether the per-source context breakdown is in v1 or v2 of Pip-Token.

### CQ3: What does the published Anthropic peak/off-peak multiplier actually look like?
We know peak hours exist (weekdays 5–11am Pacific) and that they consume session limits faster. We don't know by how much. If Anthropic ever publishes a number, we want to capture it. If multiple users have correlated their dashboard percentages with Pip-Token's local counts during peak vs off-peak hours, we'd love to hear the ratios you observed.

### CQ4: Have rate limits changed recently, and when?
Anthropic has a track record of silently adjusting limits. We want to capture a community-maintained changelog so users understand "is Pip-Token's projection wrong because I changed my behaviour, or because Anthropic changed the rules?" Worth coordinating with subreddits that track this.

### CQ5: Are there existing community tools that do parts of what Pip-Token does?
Knowing what already exists helps us avoid duplicating work and helps Pip-Token interop where useful. Any pointers welcome.

---

## How to feed findings back into the build

After completing the investigation:

1. **Update this document** by replacing each open question with a "confirmed" answer and the actual field paths.
2. **Update DESIGN.md** sections that depended on uncertain capabilities — particularly LIVE/CONTEXT and LIVE/CACHE.
3. **Write the parser** in `src/parsing/jsonlParser.ts` against the confirmed schema, with defensive handling of unknown fields.
4. **Save sample fixtures** to `test/fixtures/sample-sessions/` and write parser tests against them.
5. **Note the Claude Code version** the parser was tested against in `package.json` engines field or README.

If Claude Code's format changes in a future update, the parser version-detects, falls back to a "UNSUPPORTED VERSION — please update Pip-Token" message in the UI, and Pip-Token's maintainer ships a parser update.

---

## Public references that may help

- Anthropic API token usage docs: https://docs.claude.com/en/docs/build-with-claude/token-counting
- Anthropic prompt caching docs: https://docs.claude.com/en/docs/build-with-claude/prompt-caching
- Claude Code documentation: https://docs.claude.com/en/docs/claude-code

None of these document the local log format. They're useful for understanding the wire format the API uses, which Claude Code likely mirrors.

The build should also search GitHub for any open-source projects that already parse Claude Code logs (e.g. Claude usage trackers, dashboards). If any exist, their parsing code is the fastest path to a working parser. Cite the source if borrowing logic.
