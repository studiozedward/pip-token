# 0001 — Monochrome aesthetic only

**Status.** Accepted

**Date.** 2026-04-08

**Context.** We needed to decide whether Pip-Token's Pip-Boy aesthetic should allow any colour beyond phosphor green. Multi-colour schemes are visually richer but dilute the Fallout Pip-Boy identity, which is uncompromisingly monochrome.

**Decision.** Pip-Token uses monochrome phosphor green throughout (`#00ff41` primary, with mid and dim tiers for hierarchy). Red (`#ff4141`) is the only exception, reserved exclusively for alarm states: the PEAK status badge when in peak hours, and limit hit markers in charts.

**Consequences.** Strong visual identity and instant recognition. Red gains real semantic weight because it's never decorative — when users see red, something needs attention. Charts must use opacity tiers to differentiate categories rather than colour. Mascot art is constrained to vector linework in green. Future contributors must resist the urge to add accent colours for emphasis.

**Alternatives considered.**
- Multi-colour scheme similar to modern dashboards (rejected — breaks Pip-Boy authenticity)
- Greyscale with green accents (rejected — loses the phosphor feel)
- Allowing accent colours for chart categories (rejected — would dilute the alarm meaning of red)
- Dark amber instead of green (rejected — Pip-Boy 3000 in Fallout 4 is green; this is the canonical reference)
