# 0002 — No VS Code native status bar in v1

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Earlier drafts of the spec included two status bar renderings: one inside the extension webview, and one in VS Code's persistent bottom strip via the `StatusBarItem` API. The native version would be visible at all times, even when the extension panel is closed, providing peripheral awareness.

**Decision.** v1 ships with the in-window status bar only. The VS Code-native bottom-strip rendering is removed from v1 scope and reconsidered for v2 if users specifically request it.

**Consequences.** The user only sees status information when the extension panel is open. They lose the "glance value" of always-visible peak/burn/cost data while heads-down in code. Maintenance surface is smaller — we don't need to keep two renderings in sync. The build is faster because we don't have to handle the limited colour and text constraints of VS Code's native API.

**Alternatives considered.**
- Build both renderings as originally specified (rejected — limited value relative to build cost; the constrained native version would look ugly)
- Build only the VS Code native version (rejected — loses the full coloured Pip-Boy aesthetic)
- Build a minimal native version with just a peak/off-peak indicator (deferred to v2 — possibly the right v2 path)
