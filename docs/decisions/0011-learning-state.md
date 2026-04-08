# 0011 — LEARNING state instead of zeros or fake projections

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Several Pip-Token metrics require warmup data before they become meaningful: BURN RATE needs 5 minutes of activity, EST. TIME TO LIMIT needs at least one historical limit hit, projection metrics need several weeks of data. The lazy approach is to show zeros or made-up defaults during warmup. This would be dishonest and would erode user trust the moment users notice.

**Decision.** All metrics with warmup or cold-start dependencies show a `LEARNING` placeholder string instead of fabricated values. Variants like `LEARNING — WAIT 5 MINS`, `LEARNING — NEEDS LIMIT HIT`, and `LEARNING — NEEDS SYNC` tell the user what they're waiting for — see GLOSSARY.md for the canonical list. The ABOUT page explains each LEARNING state. Once data accumulates, the placeholder automatically resolves to a real value with no UI reload needed.

**Consequences.** New users see a sparser dashboard for the first few sessions, which may feel underwhelming. We accept this as the cost of honesty. Users who do see numbers can trust them, which is more valuable than impressive-looking fake data on day one. The LEARNING state also visually distinguishes "we don't know yet" from "the value is genuinely zero."

**Alternatives considered.**
- Show zeros (rejected — looks broken and misleading)
- Show plan-tier-defaulted projections from day 1 (rejected — would mislead users into trusting numbers based on community averages, not their actual usage)
- Hide projection fields entirely until ready (rejected — leaves the UI looking patchy and inconsistent)
