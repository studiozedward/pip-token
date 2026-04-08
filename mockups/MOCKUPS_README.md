# Mockups — read this first

These HTML mockups are **visual reference only**. They were generated from an earlier draft of the design and have since drifted from the final `docs/DESIGN.md` in a few places. Use them to understand the Pip-Boy aesthetic, layout patterns, component styling, and overall feel. For any question about *what a page actually contains*, defer to `docs/DESIGN.md`.

## Known drifts

| Mockup | Drift from final DESIGN.md |
|---|---|
| `live-session.html` | Label reads `TIME TO LIMIT`; should be `EST. TIME TO LIMIT`. Missing the `[ALL PROJECTS ▾]` project selector at the top. Missing the LEARNING state example. |
| `live-context.html` | Still shows the segmented fill bar and per-source breakdown (SYSTEM PROMPT, LOADED FILES, CONVERSATION, TOOL DEFS). Final DESIGN.md collapses this to a single solid fill bar and three stat rows — the breakdown is deferred to v2 pending parser investigation. `[ALL PROJECTS]` is hidden on this page per the final spec. |
| `live-cache.html` | Includes a `CACHE TYPE` row that was cut. Final DESIGN.md hardcodes the 5-minute assumption. `[ALL PROJECTS]` is hidden on this page per the final spec. This entire page is conditionally scoped — it may be cut from v1 if cache fields aren't available in Claude Code's JSONL (see Q2 in TOKEN_DATA_RESEARCH.md). |
| `stats-tokens.html` | `AVG/DAY` calculation shown is Total / 7. Final DESIGN.md uses "average per active day only" — days with zero activity are excluded from the denominator. |
| `stats-cost.html` | Still shows `PEAK %` and `PROJECTED MONTH` cards that were cut. Final DESIGN.md has three cards only: TOTAL, AVG/DAY (active days only), LIMIT HITS. Also missing the pinned disclaimer banner. |
| `stats-efficiency.html` | **DELETED — this page was cut from v1.** Do not recreate. |
| `history-week.html` | No arrow navigation (`[◄] WEEK OF 31 MAR [►]`). AVG/DAY same issue as STATS. Advisory text doesn't include limit-hit-count-per-day nuance. |
| `history-month.html` | Bars show weekly totals. Final DESIGN.md shows weekly *daily averages* (average tokens per active day within each week) so that partial last weeks are visually comparable to full earlier weeks. No arrow navigation. |
| (missing) `history-quarter.html` | Never generated. See DESIGN.md section 5.8. |
| (missing) `history-year.html` | Never generated. See DESIGN.md section 5.9. YR SO FAR card label, no projection bars. |
| (missing) `tips.html` | Never generated. See DESIGN.md section 5.10. Should include @StudioZedward feedback footer. |
| (missing) `about-info.html`, `about-glossary.html` | Never generated. ABOUT now has two sub-pages per final DESIGN.md. |
| (missing) `onboarding.html` | Never generated. See DESIGN.md section 5.13. |
| All mockups | None show the in-window status bar. The final DESIGN.md specifies the status bar appears at the bottom of every page with PEAK / CTX / BURN / WK segments. No VS Code-native status bar in v1. |

## What to do about this

Two options:

**Option A (recommended): treat them as visual-only reference, rebuild during the build.** When Claude Code reaches the UI milestone, it will implement each page against `docs/DESIGN.md` directly. The mockups serve as styling reference (colours, borders, fonts, mascot placement, stat row treatment, chart appearance) but the content comes from DESIGN.md. No need to update the HTMLs first.

**Option B: regenerate the mockups to match DESIGN.md.** Edit `build_all.py` (in the repo root) to align with the final spec, delete `stats-efficiency.html`, add the missing pages, re-run the script. Worth doing if you plan to use the mockups as a public showcase on GitHub, less worth doing if they're just a private reference for the build.

If you pick option B, remember to:
- Remove every reference to `stats-efficiency.html` from `build_all.py`
- Add project selector UI at top of LIVE pages
- Add in-window status bar to every page
- Update every label that starts with `TIME TO LIMIT` to `EST. TIME TO LIMIT`
- Use "active day" language in STATS card labels
- Add arrow navigation to all HISTORY pages
- Add YR SO FAR card and drop projection bars from HISTORY/YEAR
- Add disclaimer banner to STATS/COST
- Add @StudioZedward feedback footers to TIPS and ABOUT
- Generate the missing mockups: history-quarter, history-year, tips, about-info, about-glossary, onboarding
