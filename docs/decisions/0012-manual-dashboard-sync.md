# 0012 — Manual dashboard sync for chat/API usage

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Pip-Token reads Claude Code's local session logs, which means it can't see usage from Claude.ai chat, the mobile app, or third-party tools that hit the Anthropic API directly. Anthropic's 5-hour and weekly limits are account-wide, so users who split work between Claude Code and chat will see Pip-Token's projections drift from reality. Three solutions were possible: a browser extension companion to capture chat traffic, a manual sync workflow, or accepting the limitation.

**Decision.** Pip-Token offers a manual dashboard sync workflow in v1. The user opens Anthropic's Settings → Usage page, reads the current 5-hour and weekly percentages, and enters them into a small modal in ABOUT. Pip-Token compares the dashboard percentages with its own locally-tracked Claude Code counters and attributes the difference to an `OTHER` source bucket. The browser extension companion is deferred to v2.

**Consequences.** v1 ships with a working solution for mixed-surface users without doubling the build scope. The sync is opt-in — users who only use Claude Code can ignore it entirely. Users who do sync get noticeably more accurate projections. The downside is that sync is manual and decays over time; a sync from 2 days ago is less trustworthy than one from 2 hours ago.

**Alternatives considered.**
- Build a browser extension companion in v1 (rejected — doubles maintenance surface, adds three browsers to support)
- Accept the limitation with no mitigation (rejected — projections would be systematically wrong for a large fraction of the target audience)
- Wait for Anthropic to ship a usage API (rejected — uncertain timeline, not under our control)
