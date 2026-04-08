# 0016 — MIT License

**Status.** Accepted

**Date.** 2026-04-08

**Context.** Pip-Token is being released publicly on GitHub from day 1 (see ADR 0015). A licence had to be chosen before the first public commit. The choice determines who can use Pip-Token, how they can modify it, and whether commercial forks are allowed.

**Decision.** Pip-Token uses the MIT License. Standard canonical text from https://opensource.org/license/mit, copyright studiozedward.

**Consequences.** Anyone can use, modify, redistribute, and incorporate Pip-Token into commercial products without obligation to share their changes. This maximises adoption — corporate VS Code users can install without legal review hurdles, contributors can fork freely, and the project carries no copyleft strings. The downside is that a well-resourced commercial actor could fork Pip-Token, polish it, and sell it without contributing anything back. We accept this risk because the realistic alternative — a copyleft licence that suppresses adoption — would be worse for a project whose value depends on having users.

**Alternatives considered.**
- Apache 2.0 (rejected — explicit patent grant adds lawyer-friendly complexity that's unnecessary for a project this small; no meaningful benefit over MIT for our use case)
- GPL v3 (rejected — copyleft would force commercial users to publish their modifications, which would suppress adoption with the target audience and contradict the goal of being widely useful)
- Unlicensed / public domain dedication (rejected — leaves users in legal limbo in jurisdictions that don't recognise public domain dedication; MIT is functionally equivalent and globally enforceable)
- BSD 3-Clause (rejected — functionally similar to MIT but slightly less common in the VS Code extension ecosystem; MIT matches convention)
