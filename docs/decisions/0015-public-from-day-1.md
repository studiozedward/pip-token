# 0015 — Public from day 1

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Pip-Token can be developed in two ways: privately until v0.1 is feature-complete and ready to share, or publicly from the first commit with a clear "work in progress" status. The private approach feels safer because nobody sees half-built work. The public approach builds in transparency, attracts feedback early, and may surface contributors.

**Decision.** The repository is created public on GitHub from Milestone 0. The README clearly marks v0.1 as work in progress. The CHANGELOG.md tracks progress milestone by milestone. Issues are open from day 1.

**Consequences.** People who find Pip-Token early see incomplete work, which carries some perception risk. The audience for token-tracking tools (Reddit and Discord users frustrated with Anthropic's opaque limits) is technically literate and accustomed to seeing early-stage projects. Building in public also creates accountability — visible progress is harder to abandon. Early issues help shape the design before it's set in stone. The GitHub commit history becomes a useful artifact in itself, showing how the project evolved.

**Alternatives considered.**
- Private until v0.1 (rejected — delays feedback and risks waiting forever for "ready")
- Public after Milestone 1 once the skeleton clicks through (rejected — splits the difference badly; the design package alone is more interesting than an empty skeleton)
- Public read-only with issues disabled (rejected — kills the feedback loop entirely)
