# 0020 — retainContextWhenHidden: true

**Status.** Accepted

**Date.** 2026-04-08

**Context.** VS Code webview panels can be configured with `retainContextWhenHidden: true`, which keeps the webview in memory even when the user switches to another tab. Without it, switching away from the Pip-Token panel would destroy all live counters and state, requiring a full re-render when the user returns.

**Decision.** Set `retainContextWhenHidden: true` on the Pip-Token webview panel. Live counters are the core value proposition — losing them on a tab switch would be user-hostile.

**Consequences.** The webview stays in memory when hidden, consuming ~20-40MB per VS Code window. This is acceptable for the value it provides. Memory will be measured during M6 polish; if it exceeds 80MB, we'll revisit. The webview continues receiving live update messages even when not visible, so counters stay current.

**Alternatives considered.**
- `retainContextWhenHidden: false` with state serialization (rejected — adds complexity, introduces visible re-render lag, and risks state desync)
- Conditional retention based on active session (rejected — over-engineered for the benefit)
