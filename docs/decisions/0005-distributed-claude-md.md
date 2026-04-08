# 0005 — Distributed CLAUDE.md pattern

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Claude Code reads `CLAUDE.md` files for project context. A single root file works for small projects but becomes a noisy dumping ground as conventions accumulate, with parser quirks living next to webview gotchas living next to commit conventions. Boris Cherny has written about a distributed pattern where each subdirectory carries its own CLAUDE.md with locally-relevant context, loaded automatically when Claude Code is working in that area.

**Decision.** Pip-Token uses a distributed CLAUDE.md pattern. The root CLAUDE.md is short (target under 100 lines) and contains only project-wide context: tech stack, build commands, branching conventions, hard rules. Subdirectory CLAUDE.md files live in `src/`, `src/parsing/`, `src/webview/`, `src/data/`, `src/domain/`, and `test/`, each containing conventions specific to that subsystem.

**Consequences.** Subsystem context appears at the right time without overwhelming the global context window. Adding a new convention has an obvious home — the closest CLAUDE.md to where the convention applies. The root file stays scannable. Contributors can find local conventions next to the code they're touching rather than searching a giant document.

**Alternatives considered.**
- Single root CLAUDE.md with section headers (rejected — becomes unwieldy as the project grows)
- No CLAUDE.md, rely on inline comments (rejected — comments don't survive refactoring and aren't auto-loaded by Claude Code)
- Use CONTRIBUTING.md instead (rejected — that's for human contributors, not for Claude Code's working memory)
