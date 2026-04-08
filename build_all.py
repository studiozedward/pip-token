"""Build all Pip-Token mockup HTML files and screenshot them.

Outputs:
- mockups/*.html        : standalone, openable HTML files
- mockups/screenshots/*.png : PNG renders for the README

Run from /home/claude/pip-token.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
MOCKUPS = ROOT / "mockups"
SHOTS = MOCKUPS / "screenshots"
MOCKUPS.mkdir(exist_ok=True)
SHOTS.mkdir(exist_ok=True)

# ============================================================================
# SHARED CSS — phosphor green Pip-Boy aesthetic
# ============================================================================
# NOTE: No remote fonts. ADR 0004 prohibits network calls and font CDNs.
# If you want authentic VT323 rendering, install the font locally or bundle
# a .woff2 file in assets/fonts/ and add @font-face here with a local src.
CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #0a0a0a;
  font-family: 'VT323', 'Share Tech Mono', 'Courier New', Courier, monospace;
  padding: 30px;
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.frame {
  background: #000a00;
  color: #00ff41;
  padding: 18px 22px 14px;
  border: 2px solid #00ff41;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
  width: 680px;
}
.frame::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px);
  pointer-events: none;
  z-index: 10;
}
.inner { position: relative; z-index: 1; }
.titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #00aa2b;
  padding-bottom: 6px;
}
.topnav {
  display: flex;
  gap: 18px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 4px 0 2px;
}
.topnav .a { color: #00ff41; }
.topnav .d { color: #006a1a; }
.subnav {
  display: flex;
  gap: 16px;
  font-size: 12px;
  padding: 6px 0 8px;
  border-bottom: 1px solid #00aa2b;
}
.subnav .a {
  color: #00ff41;
  border-bottom: 2px solid #00ff41;
  padding-bottom: 2px;
}
.subnav .d { color: #006a1a; }

.body {
  display: flex;
  gap: 18px;
  padding: 12px 0 6px;
}
.statlist { flex: 1.3; }
.stat {
  display: flex;
  justify-content: space-between;
  padding: 5px 10px;
  font-size: 14px;
}
.stat.active {
  background: #00ff41;
  color: #000a00;
  font-weight: 700;
}
.mascot {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.mascot img {
  width: 150px;
  height: auto;
  image-rendering: auto;
}
.mascot.small img { width: 110px; }
.mascot .desc {
  font-size: 11px;
  line-height: 1.5;
  color: #00ff41;
  padding: 6px 4px 0;
  text-align: left;
}
.mascot .desc.tiny { font-size: 10px; }

.advisory {
  margin-top: 8px;
  padding: 5px 10px;
  border: 1px dashed #00aa2b;
  font-size: 11px;
  color: #00ff41;
}

.statusbar {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #00aa2b;
  font-size: 11px;
  font-weight: 700;
}
.statusbar > div {
  padding: 4px 8px;
  background: #002200;
}
.statusbar .peak {
  background: #2a0000;
  color: #ff4141;
  border: 1px solid #ff4141;
}

.fillbar-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #00aa2b;
  padding: 6px 0 4px;
  letter-spacing: 1px;
}
.fillbar {
  display: flex;
  height: 22px;
  border: 1px solid #00ff41;
  padding: 2px;
  gap: 1px;
}
.fillbar-legend {
  display: flex;
  gap: 12px;
  font-size: 10px;
  padding-top: 4px;
  color: #00ff41;
  letter-spacing: 0.5px;
}

.cards {
  display: flex;
  gap: 6px;
  padding: 8px 0 0;
}
.card {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid #00aa2b;
}
.card.active {
  background: #00ff41;
  color: #000a00;
  border-color: #00ff41;
}
.card .label {
  font-size: 9px;
  color: #00aa2b;
  letter-spacing: 0.5px;
}
.card.active .label { color: #003a0d; }
.card .value {
  font-size: 15px;
  font-weight: 700;
}

.section-title {
  font-size: 10px;
  color: #00aa2b;
  letter-spacing: 1px;
  padding: 8px 0 4px;
}

.tipcard {
  border: 1px solid #00aa2b;
  padding: 8px 10px;
  margin-bottom: 6px;
  font-size: 12px;
}
.tipcard .num {
  color: #00ff41;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 1px;
}
.tipcard .body { color: #00ff41; line-height: 1.5; padding-top: 3px; }

.aboutgrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 20px;
  font-size: 12px;
  padding: 4px 0;
}
.aboutgrid .k { color: #00aa2b; letter-spacing: 0.5px; }
.aboutgrid .v { color: #00ff41; text-align: right; }

.toggle {
  display: inline-block;
  border: 1px solid #00ff41;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
}
.toggle.on { background: #00ff41; color: #000a00; }

.bigwelcome {
  text-align: center;
  font-size: 22px;
  letter-spacing: 3px;
  padding: 14px 0 8px;
  font-weight: 700;
}
.subwelcome {
  text-align: center;
  font-size: 12px;
  color: #00aa2b;
  letter-spacing: 1px;
  padding-bottom: 14px;
}
.planlist .stat { padding: 8px 12px; font-size: 13px; }
.planlist .stat .price { color: #00aa2b; font-size: 11px; }
.planlist .stat.active .price { color: #003a0d; }
.continuebtn {
  margin-top: 12px;
  padding: 8px;
  text-align: center;
  border: 1px solid #00ff41;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
}
"""

# ============================================================================
# Reusable bits
# ============================================================================

def titlebar():
    return '<div class="titlebar"><span>&#9881; PIP-TOKEN v0.1.3</span><span>[SONNET 4.6]</span></div>'

def topnav(active):
    items = ["LIVE", "STATS", "HISTORY", "TIPS", "ABOUT"]
    parts = []
    for i in items:
        if i == active:
            parts.append(f'<span class="a">[{i}]</span>')
        else:
            parts.append(f'<span class="d">{i}</span>')
    return f'<div class="topnav">{"".join(parts)}</div>'

def subnav(items, active):
    if not items:
        return ''
    parts = []
    for i in items:
        cls = "a" if i == active else "d"
        parts.append(f'<span class="{cls}">{i}</span>')
    return f'<div class="subnav">{"".join(parts)}</div>'

def statusbar(peak=True, ctx="124K/200K", burn="1.2K/MIN", week="3.40"):
    peak_html = '<div class="peak">PEAK</div>' if peak else '<div>OFF-PEAK</div>'
    return f'''<div class="statusbar">
{peak_html}
<div style="flex:1.3">CTX {ctx}</div>
<div style="flex:1.2">BURN {burn}</div>
<div style="flex:1">WK &pound;{week}</div>
</div>'''

def mascot(img, desc, size="normal"):
    cls = "mascot small" if size == "small" else "mascot"
    return f'''<div class="{cls}">
<img src="../assets/{img}" alt="owl"/>
<div class="desc">{desc}</div>
</div>'''

def stat_row(label, value, active=False):
    cls = "stat active" if active else "stat"
    return f'<div class="{cls}"><span>{label}</span><span>{value}</span></div>'

def advisory(text):
    return f'<div class="advisory">&gt; {text}</div>'

def page(title, top_active, sub_items, sub_active, content):
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pip-Token &mdash; {title}</title>
<style>{CSS}</style>
</head><body>
<div class="frame"><div class="inner">
{titlebar()}
{topnav(top_active)}
{subnav(sub_items, sub_active)}
{content}
{statusbar()}
</div></div>
</body></html>'''

# ============================================================================
# Chart helpers (SVG)
# ============================================================================

def bar_chart_week():
    """Daily bar chart for HISTORY/WEEK with stacked tick limit markers (option A)."""
    # data: (day, peak, offpeak, hits)
    data = [
        ("MON", 45, 30, 0),
        ("TUE", 80, 40, 1),
        ("WED", 110, 50, 4),
        ("THU", 95, 35, 2),
        ("FRI", 70, 45, 0),
        ("SAT", 10, 60, 0),
        ("SUN", 5, 25, 0),
    ]
    scale = 0.675  # 200K -> 135px
    bars = []
    centers = [59, 107, 155, 203, 250, 298, 346]
    for (label, peak, off, hits), cx in zip(data, centers):
        peak_h = round(peak * scale)
        off_h = round(off * scale)
        off_y = 150 - off_h
        peak_y = off_y - peak_h
        bx = cx - 13
        bars.append(f'<rect x="{bx}" y="{off_y}" width="26" height="{off_h}" fill="#00ff41" opacity="0.45"/>')
        bars.append(f'<rect x="{bx}" y="{peak_y}" width="26" height="{peak_h}" fill="#00ff41"/>')
        # Stacked tick markers above bar (option A)
        for h in range(min(hits, 5)):
            ty = peak_y - 5 - (h * 5)
            bars.append(f'<rect x="{cx-5}" y="{ty}" width="10" height="3" fill="#ff4141"/>')
    bars_svg = "\n".join(bars)
    labels = "\n".join([f'<text x="{cx}" y="165">{lab}</text>' for (lab,_,_,_), cx in zip(data, centers)])
    return f'''<div class="section-title">DAILY TOKENS &mdash; WEEK OF 31 MAR</div>
<svg viewBox="0 0 380 180" width="100%" style="display:block;">
<line x1="35" y1="15" x2="370" y2="15" stroke="#003a0d" stroke-width="0.5"/>
<line x1="35" y1="49" x2="370" y2="49" stroke="#003a0d" stroke-width="0.5"/>
<line x1="35" y1="82" x2="370" y2="82" stroke="#003a0d" stroke-width="0.5"/>
<line x1="35" y1="116" x2="370" y2="116" stroke="#003a0d" stroke-width="0.5"/>
<line x1="35" y1="150" x2="370" y2="150" stroke="#00aa2b" stroke-width="1"/>
<line x1="35" y1="82" x2="370" y2="82" stroke="#00ff41" stroke-width="0.8" stroke-dasharray="3,3"/>
<text x="372" y="80" font-family="Courier New, monospace" font-size="8" fill="#00ff41">AVG</text>
<g font-family="Courier New, monospace" font-size="9" fill="#00aa2b" text-anchor="end">
<text x="32" y="18">200K</text>
<text x="32" y="52">150K</text>
<text x="32" y="85">100K</text>
<text x="32" y="119">50K</text>
<text x="32" y="153">0</text>
</g>
{bars_svg}
<g font-family="Courier New, monospace" font-size="10" fill="#00ff41" text-anchor="middle">
{labels}
</g>
</svg>
<div class="fillbar-legend">
<span>&#9608; PEAK</span>
<span style="opacity:0.55">&#9608; OFF-PEAK</span>
<span style="color:#ff4141">&#9608; LIMIT HIT (1 mark = 1 hit)</span>
</div>'''

def bar_chart_month():
    """Weekly bar chart for HISTORY/MONTH (option 2 scaling: weeks instead of days)."""
    # (label, peak K, offpeak K, hits)
    data = [
        ("W1", 380, 180, 2),
        ("W2", 520, 240, 5),
        ("W3", 410, 320, 1),
        ("W4", 290, 410, 0),
    ]
    # Scale: max 1000K -> 135px so scale = 0.135
    scale = 0.135
    centers = [85, 175, 265, 355]
    bars = []
    for (label, peak, off, hits), cx in zip(data, centers):
        peak_h = round(peak * scale)
        off_h = round(off * scale)
        off_y = 150 - off_h
        peak_y = off_y - peak_h
        bx = cx - 22
        bars.append(f'<rect x="{bx}" y="{off_y}" width="44" height="{off_h}" fill="#00ff41" opacity="0.45"/>')
        bars.append(f'<rect x="{bx}" y="{peak_y}" width="44" height="{peak_h}" fill="#00ff41"/>')
        for h in range(min(hits, 5)):
            ty = peak_y - 5 - (h * 5)
            bars.append(f'<rect x="{cx-5}" y="{ty}" width="10" height="3" fill="#ff4141"/>')
    bars_svg = "\n".join(bars)
    labels = "\n".join([f'<text x="{cx}" y="165">{lab}</text>' for (lab,_,_,_), cx in zip(data, centers)])
    return f'''<div class="section-title">WEEKLY TOKENS &mdash; MARCH 2026</div>
<svg viewBox="0 0 380 180" width="100%" style="display:block;">
<line x1="35" y1="15" x2="370" y2="15" stroke="#003a0d" stroke-width="0.5"/>
<line x1="35" y1="49" x2="370" y2="49" stroke="#003a0d" stroke-width="0.5"/>
<line x1="35" y1="82" x2="370" y2="82" stroke="#003a0d" stroke-width="0.5"/>
<line x1="35" y1="116" x2="370" y2="116" stroke="#003a0d" stroke-width="0.5"/>
<line x1="35" y1="150" x2="370" y2="150" stroke="#00aa2b" stroke-width="1"/>
<g font-family="Courier New, monospace" font-size="9" fill="#00aa2b" text-anchor="end">
<text x="32" y="18">1M</text>
<text x="32" y="52">750K</text>
<text x="32" y="85">500K</text>
<text x="32" y="119">250K</text>
<text x="32" y="153">0</text>
</g>
{bars_svg}
<g font-family="Courier New, monospace" font-size="10" fill="#00ff41" text-anchor="middle">
{labels}
</g>
</svg>
<div class="fillbar-legend">
<span>&#9608; PEAK</span>
<span style="opacity:0.55">&#9608; OFF-PEAK</span>
<span style="color:#ff4141">&#9608; LIMIT HIT</span>
</div>'''

def sparkline_tokens():
    """Small 7-day sparkline for STATS pages."""
    pts = [(40, 130), (80, 100), (120, 70), (160, 85), (200, 90), (240, 130), (280, 145)]
    polyline = " ".join([f"{x},{y}" for x, y in pts])
    dots = "\n".join([f'<circle cx="{x}" cy="{y}" r="2.5" fill="#00ff41"/>' for x, y in pts])
    labels = ["MON","TUE","WED","THU","FRI","SAT","SUN"]
    label_svg = "\n".join([f'<text x="{40+i*40}" y="170" font-family="Courier New, monospace" font-size="9" fill="#00aa2b" text-anchor="middle">{lab}</text>' for i, lab in enumerate(labels)])
    return f'''<svg viewBox="0 0 320 180" width="100%" style="display:block;">
<line x1="20" y1="150" x2="310" y2="150" stroke="#00aa2b" stroke-width="0.8"/>
<polyline points="{polyline}" fill="none" stroke="#00ff41" stroke-width="2"/>
{dots}
{label_svg}
</svg>'''

# ============================================================================
# PAGE DEFINITIONS
# ============================================================================

PAGES = {}

# ---------- ONBOARDING ----------
onboarding_content = f'''
<div style="padding: 12px 0;">
<div class="bigwelcome">PIP-TOKEN</div>
<div class="subwelcome">&mdash; INITIAL CONFIGURATION &mdash;</div>
<div style="display:flex;justify-content:center;padding:8px 0 14px;">
<img src="../assets/owl-about.png" style="width:130px;"/>
</div>
<div style="font-size:11px;color:#00aa2b;letter-spacing:1px;text-align:center;padding-bottom:8px;">SELECT YOUR CLAUDE PLAN</div>
<div class="planlist" style="max-width:380px;margin:0 auto;">
<div class="stat"><span>FREE</span><span class="price">&pound;0</span></div>
<div class="stat active"><span>PRO</span><span class="price">&pound;16/MO</span></div>
<div class="stat"><span>MAX 5x</span><span class="price">&pound;80/MO</span></div>
<div class="stat"><span>MAX 20x</span><span class="price">&pound;160/MO</span></div>
<div class="stat"><span>TEAM</span><span class="price">&pound;25/USER/MO</span></div>
<div class="stat"><span>API ONLY</span><span class="price">PAY-AS-YOU-GO</span></div>
</div>
<div style="max-width:380px;margin:8px auto 0;font-size:10px;color:#00aa2b;text-align:center;line-height:1.5;">
Plan can be changed later in ABOUT &gt; SETTINGS. Pip-Token uses your plan tier only to seed initial limit estimates &mdash; your real thresholds are learned from your usage.
</div>
<div class="continuebtn" style="max-width:380px;margin:14px auto 0;">[ CONTINUE ]</div>
</div>
'''
PAGES["onboarding"] = ('Setup', None, [], None, onboarding_content)

# ---------- LIVE / SESSION ----------
live_session_content = f'''
<div style="font-size:11px;color:#00aa2b;letter-spacing:1px;padding:6px 0 2px;">[ALL PROJECTS &#9662;]</div>
<div class="body">
<div class="statlist">
{stat_row("INPUT TOKENS", "47,283", active=True)}
{stat_row("OUTPUT TOKENS", "12,847")}
{stat_row("PEAK TOKENS", "38,214")}
{stat_row("OFF-PEAK TOKENS", "21,916")}
{stat_row("BURN RATE", "1.2K/MIN")}
{stat_row("EST. TIME TO LIMIT", "~2H 14M")}
{stat_row("SESSION TIME", "1H 47M")}
</div>
{mascot("owl-live.png", "INPUT TOKENS are sent TO Claude &mdash; your prompts, file contents, and conversation history. Large codebases re-read each turn drive this up fast.")}
</div>
{advisory("Burn rate is high. At current pace you may hit a session limit by 14:30. Consider deferring large file reads.")}
'''
PAGES["live-session"] = ('Live Session', 'LIVE', ['SESSION','CONTEXT','CACHE'], 'SESSION', live_session_content)

# ---------- LIVE / CONTEXT ----------
live_context_content = f'''
<div style="font-size:11px;color:#00aa2b;letter-spacing:1px;padding:6px 0 2px;">[pip-token &#9662;]</div>
<div class="body">
<div class="statlist">
{stat_row("EST. CONTEXT USED", "124,847", active=True)}
{stat_row("CONTEXT MAX", "200,000")}
{stat_row("UTILISATION", "62%")}
</div>
{mascot("owl-live.png", "EST. CONTEXT USED is total tokens loaded in Claude's working memory. Every new turn re-reads ALL of this &mdash; large contexts compound costs fast.")}
</div>
<div class="fillbar-label"><span>CONTEXT FILL &mdash; 124,847 / 200,000</span></div>
<div class="fillbar">
<div style="width:62%;background:#00ff41"></div>
<div style="flex:1;background:repeating-linear-gradient(45deg,#002200 0 4px,transparent 4px 8px)"></div>
</div>
{advisory("Context at 62%. Consider /clear before your next big task to free up working memory.")}
'''
PAGES["live-context"] = ('Live Context', 'LIVE', ['SESSION','CONTEXT','CACHE'], 'CONTEXT', live_context_content)

# ---------- LIVE / CACHE ----------
live_cache_content = f'''
<div style="font-size:11px;color:#00aa2b;letter-spacing:1px;padding:6px 0 2px;">[pip-token &#9662;]</div>
<div class="body">
<div class="statlist">
{stat_row("CACHE STATE", "FRESH", active=True)}
{stat_row("IDLE TIME", "1M 23S")}
{stat_row("CACHE SIZE", "87,200")}
{stat_row("HITS TODAY", "47")}
{stat_row("MISSES TODAY", "12")}
{stat_row("SAVED TODAY", "412K")}
</div>
{mascot("owl-live.png", "FRESH means your prompt cache is active. Returning within 5 min reuses context at ~10% cost. After expiry the next turn re-reads everything at full price.")}
</div>
<div class="fillbar-label"><span>CACHE LIFETIME &mdash; 3M 37S REMAINING</span><span>5M TOTAL</span></div>
<div class="fillbar">
<div style="flex:1;background:#00ff41"></div>
<div style="flex:1;background:#00ff41"></div>
<div style="flex:1;background:#00ff41"></div>
<div style="flex:1;background:#00ff41"></div>
<div style="flex:1;background:#00ff41"></div>
<div style="flex:1;background:#00ff41"></div>
<div style="flex:1;background:#00ff41"></div>
<div style="flex:1;background:#00aa2b"></div>
<div style="flex:1;background:repeating-linear-gradient(45deg,#002200 0 4px,transparent 4px 8px)"></div>
<div style="flex:1;background:repeating-linear-gradient(45deg,#002200 0 4px,transparent 4px 8px)"></div>
</div>
{advisory("Cache hit rate is 80% today &mdash; saving you ~412K tokens (~&pound;1.20). Avoid 5+ minute breaks to keep it fresh.")}
'''
PAGES["live-cache"] = ('Live Cache', 'LIVE', ['SESSION','CONTEXT','CACHE'], 'CACHE', live_cache_content)

# ---------- STATS / TOKENS ----------
stats_tokens_content = f'''
<div style="padding: 8px 0 0;">
<div class="section-title">TOKEN USAGE &mdash; LAST 7 DAYS</div>
{sparkline_tokens()}
</div>
<div class="cards">
<div class="card active"><div class="label">TOTAL</div><div class="value">700K</div></div>
<div class="card"><div class="label">DAILY AVG</div><div class="value">100K</div></div>
<div class="card"><div class="label">PEAK %</div><div class="value">59%</div></div>
<div class="card"><div class="label">VS LAST WEEK</div><div class="value">+12%</div></div>
</div>
<div class="body" style="padding: 10px 0 0;">
<div class="statlist">
{stat_row("INPUT TOKENS", "542K")}
{stat_row("OUTPUT TOKENS", "158K")}
{stat_row("PEAK TOKENS", "413K")}
{stat_row("OFF-PEAK TOKENS", "287K")}
{stat_row("BUSIEST DAY", "WED (160K)")}
{stat_row("QUIETEST DAY", "SUN (30K)")}
</div>
{mascot("owl-stats.png", "Past 7 days at a glance. Click any stat for details. 78% input vs 22% output is typical for coding sessions.", "small")}
</div>
{advisory("You're up 12% on last week. WED was your peak day &mdash; you hit 4 session limits.")}
'''
PAGES["stats-tokens"] = ('Stats Tokens', 'STATS', ['TOKENS','COST'], 'TOKENS', stats_tokens_content)

# ---------- STATS / COST ----------
stats_cost_content = f'''
<div style="font-size:10px;color:#00aa2b;padding:8px 0 4px;letter-spacing:0.5px;border:1px dashed #006a1a;padding:4px 8px;margin-top:6px;">
&#9432; Costs are estimated API-equivalent values, not actual charges. Subscription users are not billed per token.
</div>
<div class="cards" style="padding-top:8px;">
<div class="card active"><div class="label">TOTAL</div><div class="value">&pound;3.40</div></div>
<div class="card"><div class="label">AVG/DAY</div><div class="value">&pound;0.49</div></div>
<div class="card"><div class="label">LIMIT HITS</div><div class="value">7</div></div>
</div>
<div class="body" style="padding: 10px 0 0;">
<div class="statlist">
{stat_row("INPUT COST", "&pound;1.62")}
{stat_row("OUTPUT COST", "&pound;1.78")}
{stat_row("CACHE SAVED", "&pound;1.24")}
{stat_row("PEAK SPEND", "&pound;2.01")}
{stat_row("OFF-PEAK SPEND", "&pound;1.39")}
{stat_row("MOST EXPENSIVE TURN", "&pound;0.18")}
</div>
{mascot("owl-stats.png", "Cost is calculated from API list pricing. Subscription users don't pay this directly &mdash; it's a proxy for value extracted.", "small")}
</div>
{advisory("Cache saved you &pound;1.24 this week. Keep breaks under 5 minutes to maintain your hit rate.")}
'''
PAGES["stats-cost"] = ('Stats Cost', 'STATS', ['TOKENS','COST'], 'COST', stats_cost_content)

# ---------- HISTORY / WEEK ----------
history_week_content = f'''
<div style="display:flex;gap:14px;padding:10px 0 6px;">
<div style="flex:2;">
{bar_chart_week()}
</div>
{mascot("owl-history.png", "Your busiest day was WED with 160K tokens. You hit 4 session limits on WED, 2 on THU, 1 on TUE.", "small")}
</div>
<div class="cards">
<div class="card active"><div class="label">TOTAL</div><div class="value">700K</div></div>
<div class="card"><div class="label">PEAK %</div><div class="value">59%</div></div>
<div class="card"><div class="label">LIMIT HITS</div><div class="value">7</div></div>
<div class="card"><div class="label">AVG/DAY</div><div class="value">100K</div></div>
</div>
{advisory("59% of your tokens this week ran during peak hours. Shifting heavy work to evenings could reduce limit hits.")}
'''
PAGES["history-week"] = ('History Week', 'HISTORY', ['WEEK','MONTH','QUARTER','YEAR'], 'WEEK', history_week_content)

# ---------- HISTORY / MONTH ----------
history_month_content = f'''
<div style="display:flex;gap:14px;padding:10px 0 6px;">
<div style="flex:2;">
{bar_chart_month()}
</div>
{mascot("owl-history.png", "March: 8 limit hits across 4 weeks. Week 2 was your worst &mdash; you started a new project and re-read large files.", "small")}
</div>
<div class="cards">
<div class="card active"><div class="label">TOTAL</div><div class="value">2.75M</div></div>
<div class="card"><div class="label">PEAK %</div><div class="value">54%</div></div>
<div class="card"><div class="label">LIMIT HITS</div><div class="value">8</div></div>
<div class="card"><div class="label">AVG/WEEK</div><div class="value">688K</div></div>
</div>
{advisory("Limit hits trending DOWN week-on-week. Your cache hygiene is improving &mdash; keep it up.")}
'''
PAGES["history-month"] = ('History Month', 'HISTORY', ['WEEK','MONTH','QUARTER','YEAR'], 'MONTH', history_month_content)

# ---------- TIPS ----------
tips_content = f'''
<div class="body" style="padding-top:8px;">
<div style="flex:2;">
<div class="tipcard">
<div class="num">TIP 01 / CACHE</div>
<div class="body">Take breaks shorter than 5 minutes to keep your prompt cache alive. After 5 min the cache expires and the next turn re-reads everything at full token cost.</div>
</div>
<div class="tipcard">
<div class="num">TIP 02 / CACHE</div>
<div class="body">If you must take a long break, finish with a small interaction first. The cost of one short turn is cheaper than re-reading your whole context.</div>
</div>
<div class="tipcard">
<div class="num">TIP 03 / CACHE</div>
<div class="body">Claude Code stores cache state per project. Switching projects mid-task always invalidates the cache.</div>
</div>
</div>
{mascot("owl-tips.png", "Tips rotate daily. Use the sub-menu to filter by category.", "small")}
</div>
{advisory("Your cache hit rate is 80% &mdash; above average. Top 20% of users hit 90%+.")}
'''
PAGES["tips"] = ('Tips', 'TIPS', ['CACHE','PEAK HOURS','CONTEXT','OTHER'], 'CACHE', tips_content)

# ---------- ABOUT ----------
about_content = f'''
<div class="body" style="padding-top:10px;">
<div style="flex:1.5;">
<div class="section-title">SETTINGS</div>
<div class="aboutgrid">
<div class="k">PLAN TIER</div><div class="v">PRO</div>
<div class="k">CURRENCY</div><div class="v">GBP (&pound;)</div>
<div class="k">CRT FLICKER</div><div class="v"><span class="toggle on">ON</span></div>
<div class="k">BLIP SOUND</div><div class="v"><span class="toggle on">ON</span></div>
</div>
<div class="section-title">ACTIONS</div>
<div style="display:flex;flex-direction:column;gap:4px;padding:4px 0;">
<div style="padding:4px 8px;border:1px solid #00aa2b;font-size:11px;letter-spacing:0.5px;">[ SYNC WITH DASHBOARD ]</div>
<div style="padding:4px 8px;border:1px solid #00aa2b;font-size:11px;letter-spacing:0.5px;">[ LOG LIMIT HIT NOW ]</div>
<div style="padding:4px 8px;border:1px solid #00aa2b;font-size:11px;letter-spacing:0.5px;color:#00ff41;">[ RESYNC DATA ]</div>
<div style="padding:4px 8px;border:1px solid #ff4141;font-size:11px;letter-spacing:0.5px;color:#ff4141;">[ CLEAR ALL DATA ]</div>
</div>
<div class="section-title">INFO</div>
<div class="aboutgrid">
<div class="k">VERSION</div><div class="v">v0.1.3</div>
<div class="k">DATABASE</div><div class="v">pip-token.db</div>
<div class="k">SESSIONS</div><div class="v">3</div>
<div class="k">TURNS</div><div class="v">1,247</div>
<div class="k">LAST SYNC</div><div class="v">NEVER</div>
</div>
</div>
{mascot("owl-about.png", "Pip-Token is open source. Star it, fork it, file issues at github.com/studiozedward/pip-token.", "small")}
</div>
{advisory("No dashboard sync recorded. Sync to include non-Claude-Code usage in projections.")}
'''
PAGES["about"] = ('About', 'ABOUT', ['INFO','GLOSSARY'], 'INFO', about_content)

# ============================================================================
# WRITE HTML + SCREENSHOT
# ============================================================================

def build():
    for slug, (title, top, sub_items, sub_active, content) in PAGES.items():
        if top is None:
            # Onboarding has no top nav
            html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pip-Token &mdash; {title}</title>
<style>{CSS}</style>
</head><body>
<div class="frame"><div class="inner">
{titlebar()}
{content}
</div></div>
</body></html>'''
        else:
            html = page(title, top, sub_items, sub_active, content)
        out = MOCKUPS / f"{slug}.html"
        out.write_text(html)
        print(f"wrote {out.name}")

def shoot():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 760, "height": 800}, device_scale_factor=2)
        page_obj = ctx.new_page()
        for slug in PAGES.keys():
            html_path = (MOCKUPS / f"{slug}.html").absolute()
            page_obj.goto(f"file://{html_path}")
            page_obj.wait_for_load_state("networkidle")
            # Screenshot just the .frame element for tight crop
            frame = page_obj.locator(".frame")
            shot = SHOTS / f"{slug}.png"
            frame.screenshot(path=str(shot))
            print(f"shot {shot.name}")
        browser.close()

if __name__ == "__main__":
    build()
    shoot()
    print("done")
