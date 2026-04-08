# 0003 — Peak/off-peak as raw counters, not inferred multipliers

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Anthropic's session limits are consumed faster during peak hours (weekdays 5–11am Pacific) but the exact multiplier is undocumented and changes silently. Pip-Token needs to project "time to limit" accurately. Two approaches were possible: infer the peak multiplier by correlating local token counts with dashboard percentages, or track peak and off-peak as separate raw counters and let the user's own limit-hit history reveal the relationship empirically.

**Decision.** Pip-Token tracks `peak_tokens` and `offpeak_tokens` as two parallel counters. When the user hits a limit, Pip-Token records the snapshot of both counters at the moment of the hit. Over multiple hits, this becomes a personal threshold: "your last 5 limit hits averaged 180k peak / 50k off-peak." Projections come from the user's own history, not from any inferred Anthropic constant.

**Consequences.** Pip-Token never has to guess the multiplier. When Anthropic silently changes the rules, the next limit hit automatically updates the user's threshold. The downside is that brand-new users have no personal threshold and must wait for their first hit before EST. TIME TO LIMIT becomes meaningful — the LEARNING state covers this.

**Alternatives considered.**
- Infer a multiplier from dashboard correlation (rejected — fragile and presents inferred numbers as facts)
- Hardcode a community-sourced multiplier (rejected — stale immediately after Anthropic adjustments)
- Skip peak/off-peak tracking entirely (rejected — peak hours are the most actionable signal Pip-Token offers)
