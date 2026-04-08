# Architecture Decision Records

This directory contains numbered Architecture Decision Records (ADRs) documenting significant choices made during Pip-Token's design and build.

## Format

Each ADR is a short markdown file (~100-300 words) with:
- **Status** — Accepted, Superseded by NNNN, or Deprecated
- **Date** — when the decision was made
- **Context** — what problem we were deciding about
- **Decision** — what we decided
- **Consequences** — upsides and downsides
- **Alternatives considered** — what else we looked at

## How to add a new ADR

1. Number sequentially after the latest existing ADR
2. Name the file `NNNN-short-kebab-title.md`
3. Never reuse a number — if a decision is superseded, write a new ADR that references the old one
4. Keep it under 300 words

## Index

| # | Title | Status |
|---|---|---|
| 0001 | Monochrome aesthetic only | Accepted |
| 0002 | No VS Code native status bar in v1 | Accepted |
| 0003 | Peak/off-peak as raw counters | Accepted |
| 0004 | No telemetry, no network calls | Accepted |
| 0005 | Distributed CLAUDE.md pattern | Accepted |
| 0006 | SQLite via better-sqlite3 | Accepted |
| 0007 | Hand-rolled SVG charts | Accepted |
| 0008 | Plain HTML webview | Accepted |
| 0009 | Active session = 2 hours | Accepted |
| 0010 | ALL PROJECTS hidden on per-session pages | Accepted |
| 0011 | LEARNING state | Accepted |
| 0012 | Manual dashboard sync | Accepted |
| 0013 | Cache TTL assumed 5 minutes | Accepted |
| 0014 | Single pricing.json | Accepted |
| 0015 | Public from day 1 | Accepted |
| 0016 | MIT License | Accepted |
| 0017 | Idempotent turn ingestion | Accepted |
| 0018 | SQLite concurrency (WAL) | Accepted |
| 0019 | Cache TTL detection from real JSONL fields | Accepted (supersedes 0013) |
| 0020 | retainContextWhenHidden: true | Accepted |
| 0021 | Plan tier as free-text string backed by defaults file | Accepted |
