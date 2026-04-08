# 0009 — Active session = file modified within 2 hours

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Pip-Token needs to know which Claude Code sessions are "currently active" to populate the project selector dropdown. A session that the user has clearly abandoned (e.g. yesterday's work) shouldn't appear. But a session that paused for a lunch break should remain active when the user returns.

**Decision.** A session is considered active if its backing JSONL file in `~/.claude/projects/` has been modified within the last 2 hours. The 2-hour threshold is hardcoded as a single constant in `src/parsing/activeSessionTracker.ts`.

**Consequences.** Users who take normal breaks (lunch, meetings, school runs) come back to find their sessions still listed. Users who left a session running yesterday don't see stale entries. The 2-hour threshold is a single value to tune if it turns out to be wrong. Edge case: a user with five projects all touched in the last 2 hours sees all five in the picker, which is correct but visually busy — the picker shows last-activity timestamps so the user can make sense of it.

**Alternatives considered.**
- 30 minutes (rejected — too aggressive, would drop sessions during normal breaks)
- 24 hours (rejected — would clutter the picker with yesterday's abandoned work)
- "Until Claude Code closes the file" (rejected — Claude Code doesn't always cleanly close files, so this would lead to many false positives)
- Configurable per user (deferred to v2 — adds settings UI complexity for unclear benefit)
