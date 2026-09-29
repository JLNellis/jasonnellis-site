# 80% of Your Comments Are Robots: UI Implementation Plan (Plan 3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the playable page at `/robot-comments.html` (clean URL comes in Plan 4): the approved mock's screens plus resume, source sheets, definitions on tap, the card guide, end-screen share and links.

**Architecture:** Two new files. `robot-comments.html` holds the head, the game-only CSS tokens and styles, the SVG ink filter and the script tags. `robot-comments-ui.js` is the browser-only controller: it renders every screen from `RobotEngine` state and takes every string from `RobotCopy` / `RobotData`. No text lives in the controller. The approved mock (`scratchpad/robot-comments-mock.html`, untracked) is the visual reference; this plan supersedes it.

**Tech Stack:** Vanilla JS and CSS, no dependencies. Eleventy passthrough. Spec: `docs/superpowers/specs/2026-09-28-robot-comments-design.md` §5, §5a, §10, §10a, §12. Branch `robot-comments`; do not push.

**Left for Plan 4 (do not build here):** Plausible snippet and goals, OG/Twitter tags and images, the share pages at `/robot-comments/r/<slug>/`, the evidence page at `/robot-comments/evidence/`, the Kit email form (Plan 3 leaves an empty `<div id="notify">`), `_redirects`, sitemap, `/experiments` card, `/privacy`, CLAUDE.md. Links to the share and evidence URLs are built here and 404 until Plan 4.

**Checkpoints:** A after Task 1 (page builds and renders); B after Task 3 (browser-verified); done after Task 4 (review). Browser verification (Tasks 2 and 3) is run by the controller session, which has the browser pane; implementer subagents do Task 1 and Task 4 fixes.

**Local preview:** `preview_start` with name `site` (Eleventy on :8080), then `http://localhost:8080/robot-comments.html`. The local server does not apply `_redirects`.

---

## File map

| File | Change |
|---|---|
| Create `robot-comments.html` | Head, CSS, ink filter, script tags. |
| Create `robot-comments-ui.js` | Controller: screens, sheets, resume, share, analytics calls. |
| Modify `.eleventy.js` | Passthrough for the page and the five JS files. |
| Modify spec §3 | Add the UI file row. |

---

### Task 1: Page and controller

**Files:**
- Create: `robot-comments.html`, `robot-comments-ui.js`
- Modify: `.eleventy.js`

- [ ] **Step 1: Create `robot-comments.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>80% of Your Comments Are Robots: a LinkedIn posting game</title>
<meta name="description" content="Twelve weeks of LinkedIn posting decisions. Every mechanic is stamped Proven, Measured, Disputed or Invented, with its source.">
<link rel="canonical" href="https://jasonnellis.com/robot-comments">
<meta name="theme-color" content="#0A2540">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<!-- Plan 4 adds: Plausible snippet, Open Graph / Twitter tags -->
<link rel="stylesheet" href="/colors_and_type.css">
<style>
/* Game-only tokens (spec §12): engineering pad, index cards, four stamp inks. Site tokens untouched. */
:root{
  --rc-paper:#E3E9DF; --rc-grid:rgba(52,104,74,.12); --rc-grid-strong:rgba(52,104,74,.22);
  --rc-card:#FBFAF5; --rc-rule:#D9DCD4; --rc-margin:#C8423A;
  --rc-ink:#1B2630; --rc-ink-2:#46535C; --rc-ink-3:#76828A;
  --rc-proven:#1F6B45; --rc-measured:#99620E; --rc-disputed:#6E3A6B; --rc-invented:#B3261E;
  --rc-carbon:#2A2E31; --rc-carbon-ink:#E9E6DC; --rc-tape:rgba(236,226,190,.72);
  --rc-feed:#C9CFC7; --rc-you:var(--color-accent-vivid);
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg-base);-webkit-font-smoothing:antialiased;scroll-behavior:auto}
body{font-family:var(--font-sans);color:var(--rc-ink)}
button{font:inherit;color:inherit}
.pad{max-width:430px;min-height:100dvh;margin:0 auto;position:relative;
  background-color:var(--rc-paper);
  background-image:linear-gradient(var(--rc-grid) 1px,transparent 1px),linear-gradient(90deg,var(--rc-grid) 1px,transparent 1px);
  background-size:18px 18px;background-position:-1px -1px;
  padding:0 16px 24px;display:flex;flex-direction:column;overflow-x:hidden}
.num{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
:focus-visible{outline:2px solid var(--rc-you);outline-offset:2px}

/* title block: an engineering pad header that records real state */
.tb{display:grid;grid-template-columns:1fr auto auto;border:1.5px solid var(--rc-ink);border-top:0;margin:0 -16px 14px;background:rgba(251,250,245,.55)}
.tb>div{padding:7px 10px;border-left:1px solid var(--rc-ink)}
.tb>div:first-child{border-left:0}
.tb small{display:block;font-size:10.5px;color:var(--rc-ink-3);letter-spacing:.01em}
.tb b{font-weight:500;font-size:14px}
.tb .num{font-size:15px}

/* strip chart */
.strip{display:grid;grid-template-columns:78px repeat(12,1fr);gap:2px;align-items:center;margin-bottom:14px}
.strip .lab{font-size:11px;color:var(--rc-ink-2);white-space:nowrap;background:none;border:0;padding:0;text-align:left;cursor:help;
  text-decoration:underline dotted var(--rc-ink-3);text-underline-offset:2px}
.strip .c{height:11px;border-radius:1.5px;outline:1px solid var(--rc-grid-strong);outline-offset:-1px}
.strip .c.ev{background:repeating-linear-gradient(135deg,var(--rc-grid-strong) 0 2px,transparent 2px 5px)}
.strip.big{grid-template-columns:96px repeat(12,1fr)}
.strip.big .c{height:18px}

/* index cards */
.hand{display:flex;flex-direction:column;margin:2px 0 8px}
.card{position:relative;display:block;width:100%;text-align:left;border:0;padding:0;cursor:pointer;border-radius:3px;background:var(--rc-card);
  box-shadow:0 1px 0 rgba(0,0,0,.05),0 8px 16px -9px rgba(20,40,30,.5);transition:transform .22s ease,box-shadow .22s ease}
.hand .card:nth-child(1){transform:rotate(-.7deg)} .hand .card:nth-child(2){transform:rotate(.5deg)} .hand .card:nth-child(3){transform:rotate(-.3deg)}
.card+.card{margin-top:-14px}
.card .in{padding:14px 14px 14px 60px;min-height:104px;display:flex;flex-direction:column}
.card .cost{position:absolute;top:13px;right:13px;font-size:15px;font-weight:500;font-variant-numeric:tabular-nums;color:var(--rc-ink-2)}
.card .slot{position:absolute;left:12px;top:14px;width:38px;height:38px;border-radius:50%;border:1.5px dashed var(--rc-ink-3);opacity:.55}
.card h3{margin:0 42px 0 0;font-size:19px;line-height:1.28;font-weight:500;letter-spacing:-.01em;padding-bottom:10px;border-bottom:1.5px solid var(--rc-margin)}
.card .tags{display:none;padding-top:6px;font-size:12.5px;color:var(--rc-ink-2);line-height:22px;
  background-image:repeating-linear-gradient(transparent 0 21px,var(--rc-rule) 21px 22px);background-position:0 6px}
.card .tags span+span::before{content:" · ";color:var(--rc-ink-3)}
.hand .card.sel,.card.sel{transform:translateY(-4px) rotate(0deg);box-shadow:0 0 0 2px var(--rc-ink),0 14px 22px -10px rgba(20,40,30,.55);z-index:5}
.card.sel .tags{display:block}
.card.static{cursor:default}
.card[disabled]{cursor:not-allowed}
.card[disabled] .in{opacity:.42}
.card .need{display:none}
.card[disabled] .need{display:inline;position:absolute;right:11px;bottom:8px;font-size:11.5px;color:var(--rc-invented)}
.handnote{display:flex;justify-content:space-between;gap:12px;min-height:30px;margin-bottom:6px}
.handnote .link{font-size:13px}
.handnote .define{margin-left:auto}

/* engagement: three ruled boxes, one inked */
.eng-h{font-size:12px;color:var(--rc-ink-2);margin:0 0 6px}
.eng{display:grid;grid-template-columns:repeat(3,1fr);border:1.5px solid var(--rc-ink);border-radius:3px;overflow:hidden;background:rgba(251,250,245,.6);margin-bottom:12px}
.eng button{border:0;border-left:1px solid var(--rc-ink);background:transparent;padding:9px 6px;font-size:12.5px;line-height:1.25;cursor:pointer}
.eng button:first-child{border-left:0}
.eng button[aria-pressed=true]{background:var(--rc-ink);color:var(--rc-card)}
.eng button[disabled]{color:var(--rc-ink-3);cursor:not-allowed;text-decoration:line-through}

.go{display:flex;align-items:center;gap:16px;margin-top:auto}
.btn{appearance:none;border:0;border-radius:3px;background:var(--rc-ink);color:var(--rc-card);font-weight:500;font-size:16px;padding:14px 18px;cursor:pointer;flex:1;text-align:center;text-decoration:none}
.btn.ghost{background:transparent;color:var(--rc-ink);box-shadow:inset 0 0 0 1.5px var(--rc-ink)}
.btn[disabled]{opacity:.35;cursor:not-allowed}
.link{background:none;border:0;padding:6px 0;font-size:14px;color:var(--rc-ink-2);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.term{background:none;border:0;padding:0;font:inherit;color:inherit;text-align:left;cursor:help;text-decoration:underline dotted var(--rc-ink-3);text-underline-offset:3px}

/* resolve: abstract feed */
.resolve{display:grid;grid-template-columns:92px 1fr;gap:14px;align-items:start;margin-bottom:12px}
.feed{position:relative;height:196px;overflow:hidden;border-radius:4px;background:rgba(27,38,48,.06);padding:8px}
.feed i{display:block;height:24px;border-radius:5px;background:var(--rc-feed);margin-bottom:8px}
.feed i.you{height:34px;background:var(--rc-card);box-shadow:0 0 0 2px var(--rc-you)}
.feed .light{position:absolute;left:0;right:0;height:70px;top:-80px;pointer-events:none;
  background:radial-gradient(ellipse 60% 50% at 50% 50%,rgba(255,255,240,.9),transparent 70%);mix-blend-mode:screen}
.feed .ticks{position:absolute;right:2px;top:88px;display:flex;flex-direction:column;gap:2px}
.feed .ticks b{width:6px;height:2px;background:var(--rc-ink)}
.nums{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:13px;margin:6px 0 10px}
.nums dt{color:var(--rc-ink-2)} .nums dd{margin:0;text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.why{font-size:14.5px;line-height:1.5;color:var(--rc-ink);margin:0 0 6px}
.src{font-size:12px;color:var(--rc-ink-3);margin:0 0 6px}
.src a,.src .link{color:inherit;font-size:12px;padding:0}

/* the stamp (signature) */
.stamp{position:absolute;width:96px;height:96px;left:-8px;top:-10px;pointer-events:none;z-index:6;mix-blend-mode:multiply;transform:rotate(var(--r));opacity:.92}
.stamp svg{width:100%;height:100%;overflow:visible;display:block}
.stamp.land{animation:land .3s cubic-bezier(.2,.9,.3,1.25) both}
@keyframes land{from{transform:scale(1.45) rotate(var(--r));opacity:0}to{transform:scale(1) rotate(var(--r));opacity:.92}}
.stamp-btn{pointer-events:auto;background:none;border:0;padding:0;border-radius:50%;cursor:pointer;z-index:7}
.played{margin:20px 0 12px}
.played .card .in{padding-left:100px;min-height:96px}

/* event: carbon-copy memo, taped in */
.memo{position:relative;background:var(--rc-carbon);color:var(--rc-carbon-ink);padding:26px 18px 20px;margin:18px 4px 16px;
  clip-path:polygon(0 6px,4% 0,9% 5px,15% 1px,22% 6px,30% 0,37% 4px,45% 1px,53% 6px,61% 2px,68% 5px,76% 0,84% 6px,91% 1px,100% 5px,100% 100%,0 100%);
  box-shadow:0 10px 20px -12px rgba(0,0,0,.6)}
.memo::before{content:"";position:absolute;top:-6px;left:50%;width:92px;height:22px;transform:translateX(-50%) rotate(-3deg);background:var(--rc-tape)}
.memo .kind{font-size:12px;opacity:.7;margin:0 0 4px}
.memo h3{margin:0 0 10px;font-size:22px;font-weight:700;letter-spacing:-.01em}
.memo p{margin:0 0 10px;font-size:15.5px;line-height:1.5}
.memo .conseq{border-top:1px dashed rgba(233,230,220,.35);padding-top:10px;font-size:14px}

/* setup and resume */
.hero{padding:30px 0 6px;position:relative}
.hero h1{font-size:38px;line-height:1.02;letter-spacing:-.03em;margin:0 64px 8px 0;font-weight:700}
.hero .tag{font-size:17px;color:var(--rc-ink-2);margin:0 0 14px;font-style:italic}
.hero p{font-size:15.5px;line-height:1.5;margin:0 0 8px}
.hero .slot{position:absolute;right:0;top:32px;width:58px;height:58px;border-radius:50%;border:1.5px dashed var(--rc-ink-3);opacity:.6}
.introlinks{display:flex;flex-wrap:wrap;gap:0 16px;margin:0 0 4px}
.introlinks .link{font-size:13.5px}
.pick h2{font-size:14px;font-weight:500;margin:14px 0 8px}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tile{border:1.5px solid var(--rc-ink);border-radius:3px;background:rgba(251,250,245,.7);text-align:left;padding:9px 10px;cursor:pointer}
.tile b{display:block;font-weight:500;font-size:14.5px}
.tile span{display:block;font-size:12px;color:var(--rc-ink-2);margin-top:2px}
.tile[aria-pressed=true]{background:var(--rc-ink);color:var(--rc-card)}
.tile[aria-pressed=true] span{color:rgba(251,250,245,.75)}
.budget{grid-template-columns:repeat(3,1fr)}
.resume-card{border:1.5px solid var(--rc-ink);border-radius:3px;background:rgba(251,250,245,.85);padding:14px;margin:18px 0}
.resume-card p{margin:0 0 12px;font-size:15.5px}

/* end */
.gametitle{position:relative;font-size:13.5px;color:var(--rc-ink-2);margin:22px 0 0;padding-right:80px}
.titlestamp{left:auto;right:6px;top:-26px;width:78px;height:78px}
.end h1{font-size:44px;line-height:.98;letter-spacing:-.035em;margin:18px 0 8px;font-weight:700}
.end .tagline{font-style:italic;font-size:17px;color:var(--rc-ink-2);margin:0 0 18px}
.score{display:grid;grid-template-columns:1fr auto;align-items:end;border-top:1.5px solid var(--rc-ink);border-bottom:1.5px solid var(--rc-ink);padding:10px 0;margin-bottom:14px}
.score .big{font-variant-numeric:tabular-nums;font-weight:700;font-size:60px;line-height:.9;letter-spacing:-.03em}
.score small{display:block;font-size:12.5px;color:var(--rc-ink-2);margin-top:4px}
.score .band{font-size:22px;font-weight:700;text-align:right}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:13px}
.facts b{display:block;font-size:18px;font-weight:500}
.disc{font-size:13px;line-height:1.5;color:var(--rc-ink-2);border-left:3px solid var(--rc-margin);padding-left:10px;margin:6px 0 0}
.after{margin-top:26px}
.actions{display:flex;gap:10px;margin:16px 0 8px}
.podcast{border-top:1.5px solid var(--rc-ink);margin-top:18px;padding-top:14px;font-size:15px;line-height:1.55}
.podcast a{color:var(--rc-ink)}
.srch{font-size:14px;font-weight:500;margin:18px 0 6px}
.sources{font-size:12.5px;line-height:1.5;color:var(--rc-ink-2);padding-left:18px;margin:0}
.sources a{color:inherit}

/* sheets: definitions, sources, card guide */
.sheet-bg{position:fixed;inset:0;background:rgba(10,20,30,.45);z-index:20;display:flex;align-items:flex-end;justify-content:center}
.sheet{position:relative;width:100%;max-width:430px;max-height:86dvh;overflow:auto;background:var(--rc-card);border-radius:10px 10px 0 0;
  padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(0,0,0,.25)}
.sheet .x{position:absolute;top:10px;right:14px}
.sheet h2{font-size:19px;margin:0 70px 10px 0;font-weight:700;letter-spacing:-.01em}
.sheet dl{margin:0}
.sheet dt{font-weight:500;margin-top:10px}
.sheet dd{margin:2px 0 0;color:var(--rc-ink-2);font-size:14.5px;line-height:1.45}
.sheet .bigstamp{position:relative;left:auto;top:auto;width:120px;height:120px;margin:0 auto 8px}
.sheet .tiers{display:grid;grid-template-columns:56px 1fr;gap:8px 12px;align-items:center;margin-top:8px}
.sheet .tiers .stamp{position:relative;left:auto;top:auto;width:56px;height:56px}
.guide{position:relative;margin:6px 0 12px}
.guide .mk{position:absolute;z-index:8;width:20px;height:20px;border-radius:50%;background:var(--rc-ink);color:var(--rc-card);font-size:12px;font-weight:700;display:grid;place-items:center}
.guide ol{margin:0;padding-left:22px}
.guide li{font-size:14.5px;line-height:1.45;margin:0 0 6px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--rc-ink);color:var(--rc-card);padding:9px 14px;border-radius:3px;font-size:14px;z-index:30}

@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<main class="pad" id="app"><noscript><p style="padding:24px 0">This game needs JavaScript.</p></noscript></main>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="ink" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="1" seed="3" result="m"/>
      <feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.55" result="mask"/>
      <feComposite in="d" in2="mask" operator="in"/>
    </filter>
    <path id="ring" d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0"/>
  </defs>
</svg>

<script src="/robot-comments-data.js"></script>
<script src="/robot-comments-bands.js"></script>
<script src="/robot-comments-engine.js"></script>
<script src="/robot-comments-copy.js"></script>
<script src="/robot-comments-ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `robot-comments-ui.js`**

```js
/*
 * 80% OF YOUR COMMENTS ARE ROBOTS: page controller (browser only)
 * ------------------------------------------------------------------
 * Renders every screen from RobotEngine state. Every string comes from
 * RobotCopy or RobotData; none is written here.
 * Load order: robot-comments-data.js, -bands.js, -engine.js, -copy.js, then this.
 * Saves: localStorage 'rc_run' (in progress) and 'rc_last' (finished game),
 * both E.serialize() output, restored with E.replay() (spec §5a).
 * Analytics: track() is a no-op until Plan 4 adds the Plausible snippet.
 * Spec: docs/superpowers/specs/2026-09-28-robot-comments-design.md
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';
  const D = window.RobotData, E = window.RobotEngine, C = window.RobotCopy;
  const L = C.labels, G = C.glossary;
  const app = document.getElementById('app');
  const EVIDENCE_URL = '/robot-comments/evidence/';
  const METRICS = ['impressions', 'held', 'contributions', 'visits', 'dms', 'coherence'];
  const INK = { proven: 'var(--rc-proven)', measured: 'var(--rc-measured)', disputed: 'var(--rc-disputed)', invented: 'var(--rc-invented)' };

  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
  const short = src => (D.SOURCES[src] ? D.SOURCES[src].cite.split(',')[0].split(':')[0] : '');
  const tilt = key => (E.hashStr(String(key)) % 19) - 9;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shareUrl = slug => location.origin + '/robot-comments/r/' + slug + '/';
  const track = (name, props) => { try { if (window.plausible) window.plausible(name, props ? { props } : undefined); } catch (e) {} };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const show = html => { app.innerHTML = html; window.scrollTo(0, 0); };

  let S = null, sel = null, eng = 'none';
  const setup = { archetype: 'seriesb', budget: 3 };
  const save = () => store.set('rc_run', E.serialize(S));

  // ------------------------------------------------------------ pieces
  function stampSVG(stamp, src) {
    const word = L.stamps[stamp].toUpperCase();
    const ring = (short(src) + ' · ' + short(src)).toUpperCase().slice(0, 44);
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <g filter="url(#ink)" fill="none" stroke="${INK[stamp]}" style="color:${INK[stamp]}">
        <circle cx="50" cy="50" r="46" stroke-width="3.6"/>
        <circle cx="50" cy="50" r="41" stroke-width="1.2"/>
        <text font-family="DM Sans, sans-serif" font-weight="700" font-size="7.2" letter-spacing="1.1" fill="currentColor" stroke="none"><textPath href="#ring" startOffset="2%">${esc(ring)}</textPath></text>
        <rect x="6" y="40" width="88" height="20" fill="var(--rc-card)" stroke-width="2.2"/>
        <text x="50" y="55" text-anchor="middle" font-family="DM Sans, sans-serif" font-weight="700" font-size="${word.length > 7 ? 11.5 : 13.5}" letter-spacing="0.8" fill="currentColor" stroke="none">${esc(word)}</text>
      </g></svg>`;
  }

  function cardHTML(k, opts) {
    const cost = E.cardCost(k);
    const tags = [L.formats[k.fmt], L.topics[k.topic], L.hooks[k.hook], L.substance[k.sub], L.cta[k.cta]];
    const inner = `<span class="slot"></span><span class="cost">${cost}h</span>
      <div class="in"><h3>${esc(k.title)}</h3><div class="tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>
      <span class="need">${esc(fill(C.week.overBudget, { hours: cost }))}</span>`;
    if (opts.static) return `<div class="card sel static" data-id="${k.id}">${inner}</div>`;
    return `<button class="card${opts.sel ? ' sel' : ''}" data-id="${k.id}" ${opts.disabled ? 'disabled' : ''} aria-pressed="${!!opts.sel}">${inner}</button>`;
  }

  function stripHTML(big) {
    const max = {};
    for (const m of METRICS) max[m] = Math.max(1e-9, ...S.rows.map(r => r[m] || 0));
    let h = '';
    for (const m of METRICS) {
      h += `<button class="lab" data-metric="${m}">${esc(L.metrics[m])}</button>`;
      for (let w = 1; w <= 12; w++) {
        const r = S.rows.find(x => x.week === w);
        if (!r) { h += '<span class="c"></span>'; continue; }
        if (r.kind === 'event' && m !== 'coherence' && !(m === 'contributions' && r.contributions)) { h += '<span class="c ev"></span>'; continue; }
        const v = m === 'coherence' ? r.coherence : (r[m] || 0) / max[m];
        h += `<span class="c" style="background:rgba(27,38,48,${(0.08 + 0.85 * v).toFixed(2)})"></span>`;
      }
    }
    return `<div class="strip${big ? ' big' : ''}">${h}</div>`;
  }

  function titleBlock(week) {
    return `<div class="tb">
      <div><small>${esc(C.week.titleBlock.project)}</small><b>${esc(C.title)}</b></div>
      <div><small>${esc(C.week.titleBlock.week)}</small><span class="num">${Math.min(week, 12)}/12</span></div>
      <div><small>${esc(C.week.titleBlock.hours)}</small><span class="num">${S.setup.budget}h</span></div>
    </div>`;
  }

  function bindCommon() {
    app.querySelectorAll('[data-metric]').forEach(b => { b.onclick = () => defineOne(L.metrics[b.dataset.metric], G.metrics[b.dataset.metric]); });
    app.querySelectorAll('[data-term]').forEach(b => { b.onclick = () => defineOne(b.textContent, G.terms[b.dataset.term]); });
  }

  // ------------------------------------------------------------ sheets
  let lastFocus = null;
  function openSheet(title, bodyHTML) {
    closeSheet();
    lastFocus = document.activeElement;
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
      <button class="x link">${esc(C.cardGuide.close)}</button><h2 id="sheet-h">${esc(title)}</h2>${bodyHTML}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg) closeSheet(); });
    bg.querySelector('.x').onclick = closeSheet;
    document.body.appendChild(bg);
    bg.querySelector('.x').focus();
  }
  function closeSheet() {
    const bg = document.querySelector('.sheet-bg');
    if (!bg) return;
    bg.remove();
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  const defineOne = (title, text) => openSheet(title, `<p class="why">${esc(text)}</p>`);

  function defineTags(k) {
    const rows = [
      [L.formats[k.fmt], G.formats[k.fmt]], [L.topics[k.topic], G.topics[k.topic]], [L.hooks[k.hook], G.hooks[k.hook]],
      [L.substance[k.sub], G.substance[k.sub]], [L.cta[k.cta], G.cta[k.cta]],
    ];
    openSheet(C.week.defineTags, `<dl>${rows.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`);
  }

  function sourceSheet(lever, why) {
    const src = D.SOURCES[lever.src] || {};
    openSheet(L.stamps[lever.stamp], `<div class="stamp bigstamp" style="--r:${tilt(lever.key)}deg">${stampSVG(lever.stamp, lever.src)}</div>
      <p class="why">${esc(why || C.why[lever.key] || '')}</p>
      <p class="src">${esc(L.stampMeaning[lever.stamp])}${lever.mag === 'ours' ? ' ' + esc(C.week.oursNote) : ''}</p>
      <p class="src">${esc(src.cite || '')}${src.url ? ` <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(C.week.sourceLink)}</a>` : ''}</p>`);
  }

  function cardGuide() {
    track('rc_card_guide_opened');
    const g = C.cardGuide, k = E.cardById('d01');
    const mk = (n, css) => `<span class="mk" style="${css}">${n}</span>`;
    openSheet(g.title, `<div class="guide">${cardHTML(k, { static: true })}
        ${mk(1, 'left:100px;top:6px')}${mk(2, 'left:100px;bottom:26px')}${mk(3, 'right:-4px;top:-6px')}${mk(4, 'left:-4px;top:-4px')}</div>
      <ol class="guide"><li>${esc(g.firstLine)}</li><li>${esc(g.tags)}</li><li>${esc(g.cost)}</li><li>${esc(g.slot)}</li></ol>
      <p class="why">${esc(g.stampsIntro)}</p>
      <div class="tiers">${['proven', 'measured', 'disputed', 'invented'].map(t =>
        `<div class="stamp" style="--r:${tilt(t)}deg">${stampSVG(t, 'feedsr')}</div><p class="why"><b>${esc(L.stamps[t])}.</b> ${esc(L.stampMeaning[t])}</p>`).join('')}</div>`);
  }

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ------------------------------------------------------------ screens
  const heroHTML = () => `<section class="hero"><span class="slot" aria-hidden="true"></span>
    <h1>${esc(C.title)}</h1><p class="tag">${esc(C.tagline)}</p>${C.intro.map(p => `<p>${esc(p)}</p>`).join('')}</section>`;

  function renderResume(game) {
    const A = D.ARCHETYPES[game.setup.archetype];
    show(heroHTML() + `<div class="resume-card"><p>${esc(fill(C.resume.line, { week: game.week, archetype: A.name, budget: C.setup.budgets[game.setup.budget] }))}</p>
      <div class="go"><button class="btn" id="resume">${esc(C.resume.resume)}</button><button class="link" id="restart">${esc(C.resume.restart)}</button></div></div>`);
    app.querySelector('#resume').onclick = () => { S = game; track('rc_resume', { week: String(game.week) }); next(); };
    app.querySelector('#restart').onclick = () => { store.del('rc_run'); renderSetup(); };
  }

  function renderSetup() {
    const A = D.ARCHETYPES;
    const lastSave = store.get('rc_last'), lastGame = lastSave ? E.replay(lastSave) : null;
    show(heroHTML() +
      `<p class="introlinks"><button class="link" id="guide">${esc(C.cardGuide.open)}</button>
        <a class="link" id="ev" href="${EVIDENCE_URL}">${esc(C.evidence.fromIntro)}</a>
        ${lastGame && lastGame.done ? `<button class="link" id="last">${esc(C.resume.lastResult)}</button>` : ''}</p>
      <section class="pick"><h2>${esc(C.setup.archetypeHeading)}</h2><div class="tiles">
        ${Object.keys(A).map(id => `<button class="tile" data-a="${id}" aria-pressed="${setup.archetype === id}"><b>${esc(A[id].name)}</b><span class="num">${esc(fill(C.setup.connections, { n: A[id].connections.toLocaleString('en-US') }))}</span><span>${esc(A[id].headline)}</span></button>`).join('')}
      </div><h2>${esc(C.setup.budgetHeading)}</h2><div class="tiles budget">
        ${E.CONFIG.budgets.map(b => `<button class="tile" data-b="${b}" aria-pressed="${setup.budget === b}"><b class="num">${esc(C.setup.budgets[b])}</b></button>`).join('')}
      </div></section>
      <div class="go" style="margin-top:20px"><button class="btn" id="start">${esc(C.setup.start)}</button></div>`);
    app.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { setup.archetype = b.dataset.a; renderSetup(); app.querySelector(`[data-a="${b.dataset.a}"]`).focus(); }; });
    app.querySelectorAll('[data-b]').forEach(b => { b.onclick = () => { setup.budget = +b.dataset.b; renderSetup(); app.querySelector(`[data-b="${b.dataset.b}"]`).focus(); }; });
    app.querySelector('#guide').onclick = cardGuide;
    app.querySelector('#ev').onclick = () => track('rc_evidence_opened', { from: 'intro' });
    if (lastGame && lastGame.done) app.querySelector('#last').onclick = () => { S = lastGame; renderEnd(true); };
    app.querySelector('#start').onclick = () => {
      S = E.newGame(setup);
      track('rc_setup_complete', { archetype: setup.archetype, budget: String(setup.budget) });
      save();
      next();
    };
  }

  function next() {
    if (S.done) return renderEnd(false);
    if (E.weekKind(S) === 'event') return renderEvent();
    sel = null; eng = 'none';
    renderWeek();
  }

  function renderWeek() {
    const hand = E.deal(S);
    const card = hand.find(k => k.id === sel);
    const engOK = e => (card ? E.canAfford(S, card, e) : e === 'none');
    show(titleBlock(S.week) + stripHTML(false) +
      `<div class="hand">${hand.map(k => cardHTML(k, { sel: k.id === sel, disabled: !E.canAfford(S, k, 'none') })).join('')}</div>
       <div class="handnote">${S.week === 1 ? `<button class="link" id="guide">${esc(C.cardGuide.open)}</button>` : ''}
         ${card ? `<button class="link define" id="define">${esc(C.week.defineTags)}</button>` : ''}</div>
       <p class="eng-h">${esc(C.week.engagementHeading)}</p>
       <div class="eng">${E.CONFIG.engagements.map(e => `<button data-e="${e}" aria-pressed="${eng === e}" ${engOK(e) ? '' : 'disabled'}>${esc(L.engagement[e])}</button>`).join('')}</div>
       <div class="go"><button class="btn" id="post" ${card ? '' : 'disabled'}>${esc(C.week.post)}</button><button class="link" id="skip">${esc(C.week.skip)}</button></div>`);
    app.querySelectorAll('.hand .card').forEach(b => {
      b.onclick = () => {
        sel = b.dataset.id;
        if (!E.canAfford(S, E.cardById(sel), eng)) eng = 'none';
        renderWeek();
        const again = app.querySelector(`.hand .card[data-id="${sel}"]`);
        if (again) again.focus();
      };
    });
    app.querySelectorAll('[data-e]').forEach(b => { b.onclick = () => { eng = b.dataset.e; renderWeek(); app.querySelector(`[data-e="${eng}"]`).focus(); }; });
    const guide = app.querySelector('#guide'); if (guide) guide.onclick = cardGuide;
    const define = app.querySelector('#define'); if (define) define.onclick = () => defineTags(card);
    app.querySelector('#post').onclick = () => play({ card: sel, engagement: eng });
    app.querySelector('#skip').onclick = () => play({ skip: true });
    bindCommon();
  }

  function play(choice) {
    const res = E.resolveWeek(S, choice);
    save();
    track('rc_turn_resolved', {
      week: String(res.row.week), card: res.row.card || 'skip',
      stamp: res.lever ? res.lever.stamp : 'none', engagement: choice.skip ? 'skip' : choice.engagement,
    });
    if (choice.skip) return next();
    renderResolve(res);
  }

  function renderResolve(res) {
    const r = res.row, lv = res.lever, k = E.cardById(r.card);
    const dwell = r.held / Math.max(1, r.impressions);
    show(titleBlock(r.week) + stripHTML(false) +
      `<div class="played">${cardHTML(k, { static: true })}</div>
       <div class="resolve">
         <div class="feed" aria-hidden="true"><i></i><i></i><i class="you"></i><i></i><i></i><i></i><div class="light"></div><div class="ticks"></div></div>
         <dl class="nums">
           <dt>${esc(L.metrics.impressions)}</dt><dd>${Math.round(r.impressions).toLocaleString('en-US')}</dd>
           <dt>${esc(L.metrics.held)}</dt><dd>${Math.round(r.held).toLocaleString('en-US')}</dd>
           <dt>${esc(L.metrics.contributions)}</dt><dd>${r.contributions.toFixed(1)}</dd>
           <dt>${esc(L.metrics.visits)}</dt><dd>${r.visits.toFixed(1)}</dd>
           <dt>${esc(L.metrics.dms)}</dt><dd>${r.dms.toFixed(2)}</dd>
         </dl>
       </div>
       <p class="why" hidden>${esc(C.why[lv.key] || '')}</p>
       <p class="src" hidden>${esc(L.stampMeaning[lv.stamp])} <button class="link" id="srcbtn">${esc(C.week.sourceLink)}</button></p>
       <div class="go" style="margin-top:14px"><button class="btn" id="nx">${esc(S.done ? C.week.toResults : C.week.next)}</button></div>`);
    const played = app.querySelector('.played .card'), light = app.querySelector('.light'), ticks = app.querySelector('.ticks');
    const reduce = reduceMotion();
    const land = () => {
      const st = document.createElement('button');
      st.type = 'button';
      st.className = 'stamp stamp-btn' + (reduce ? '' : ' land');
      st.style.setProperty('--r', tilt(k.id) + 'deg');
      st.setAttribute('aria-label', L.stamps[lv.stamp] + ': ' + short(lv.src) + '. ' + C.week.sourceLink);
      st.innerHTML = stampSVG(lv.stamp, lv.src);
      st.onclick = () => sourceSheet(lv);
      played.appendChild(st);
      app.querySelector('.why').hidden = false;
      app.querySelector('.src').hidden = false;
    };
    const nTicks = Math.min(12, Math.round((r.contributions / Math.max(1, r.impressions)) * 400));
    if (reduce) {
      for (let i = 0; i < nTicks; i++) ticks.appendChild(document.createElement('b'));
      land();
    } else {
      const hold = dwell > 0.33 ? 520 : 90;
      light.animate([{ top: '-80px' }, { top: '72px', offset: 0.35 }, { top: '72px', offset: 0.35 + hold / 1400 }, { top: '260px' }],
        { duration: 900 + hold, easing: 'ease-in-out', fill: 'forwards' });
      for (let i = 0; i < nTicks; i++) setTimeout(() => ticks.appendChild(document.createElement('b')), 380 + i * 45);
      setTimeout(land, 1000 + hold);
    }
    app.querySelector('#srcbtn').onclick = () => sourceSheet(lv);
    app.querySelector('#nx').onclick = next;
    bindCommon();
  }

  function renderEvent() {
    const res = E.resolveEvent(S);
    save();
    track('rc_event_shown', { event: res.event });
    const ev = C.events[res.event];
    const body = ev.body || ev.bodyByArchetype[S.setup.archetype];
    let conseq = ev.consequence.any;
    if (res.event === 'gravity') conseq = S.nextReachMult > 1 ? ev.consequence.clear : ev.consequence.blurred;
    if (res.event === 'audit') conseq = S.headlineFit >= 0.8 ? ev.consequence.up : ev.consequence.down;
    show(titleBlock(res.row.week) + stripHTML(false) +
      `<article class="memo"><h3>${esc(ev.name)}</h3><p>${esc(body)}</p><p class="conseq">${esc(conseq)}</p></article>
       <p class="why">${esc(C.why['event:' + res.event])}</p>
       <p class="src">${esc(L.stamps[res.lever.stamp])}. ${esc(L.stampMeaning[res.lever.stamp])} <button class="link" id="srcbtn">${esc(C.week.sourceLink)}</button></p>
       <div class="go" style="margin-top:14px"><button class="btn" id="nx">${esc(S.done ? C.week.toResults : C.week.next)}</button></div>`);
    app.querySelector('#srcbtn').onclick = () => sourceSheet(res.lever);
    app.querySelector('#nx').onclick = next;
    bindCommon();
  }

  function renderEnd(fromLast) {
    const F = E.finish(S), O = C.outcomes[F.archetype];
    if (!fromLast) {
      store.set('rc_last', E.serialize(S));
      store.del('rc_run');
      track('rc_completed', { archetype: F.archetype, band: F.band, tax: String(F.tax) });
    }
    const titleLever = { key: 'title', stamp: C.titleStamp.stamp, src: C.titleStamp.src, mag: null };
    const used = [...new Set(S.rows.filter(r => r.lever).map(r => r.lever.src).concat(C.titleStamp.src))];
    show(`<section class="end">
        <p class="gametitle">${esc(C.title)}<button type="button" class="stamp stamp-btn land titlestamp" style="--r:11deg" id="tstamp"
          aria-label="${esc(L.stamps[titleLever.stamp] + ': ' + short(titleLever.src) + '. ' + C.week.sourceLink)}">${stampSVG(titleLever.stamp, titleLever.src)}</button></p>
        <h1>${esc(O.name)}</h1><p class="tagline">${esc(O.tagline)}</p>
        <div class="score"><div><span class="big">${F.pipeline.toFixed(1)}</span>
          <small><button class="term" data-term="pipeline">${esc(C.end.pipelineLabel)}</button>: ${esc(C.end.pipelineUnit)}</small></div>
          <button class="term band" data-term="band">${esc(L.bands[F.band])}</button></div>
        ${stripHTML(true)}
        <div class="facts"><div><button class="term" data-term="clarity">${esc(C.end.clarityLabel)}</button><b>${esc(F.clarity)}</b></div>
          <div><button class="term" data-term="folkloreTax">${esc(C.end.taxLabel)}</button><b class="num">${F.tax}</b></div></div>
        <p class="disc">${esc(C.end.disclosure)}</p>
      </section>
      <section class="after">
        <p class="why">${esc(O.diagnosis)}</p>
        <p class="src">${esc(C.end.taxLabel)}: ${esc(C.end.taxLine)}${F.playedGated ? ' ' + esc(C.end.gatedNote) : ''}</p>
        <div class="actions"><button class="btn" id="share">${esc(C.end.share)}</button><button class="btn ghost" id="again">${esc(C.end.replay)}</button></div>
        <p><a class="link" id="ev" href="${EVIDENCE_URL}">${esc(C.evidence.fromEnd)}</a></p>
        <div id="notify"></div>
        <p class="podcast">${esc(C.end.podcast)} <a href="/building-value">${esc(C.end.podcastLink)}</a></p>
        <h2 class="srch">${esc(C.end.sourcesHeading)}</h2>
        <ol class="sources">${used.map(id => { const s = D.SOURCES[id]; return `<li>${esc(s.cite)}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(C.week.sourceLink)}</a>` : ''}</li>`; }).join('')}</ol>
      </section>`);
    app.querySelector('#tstamp').onclick = () => sourceSheet(titleLever, C.titleStamp.why);
    app.querySelector('#share').onclick = () => share(F);
    app.querySelector('#again').onclick = () => { track('rc_replay'); store.del('rc_last'); store.del('rc_run'); S = null; renderSetup(); };
    app.querySelector('#ev').onclick = () => track('rc_evidence_opened', { from: 'end' });
    bindCommon();
  }

  async function share(F) {
    const url = shareUrl(F.archetype);
    const text = fill(C.end.shareText, { archetype: C.outcomes[F.archetype].name, band: L.bands[F.band].toLowerCase(), tax: F.tax });
    track('rc_share');
    if (navigator.share) {
      try { await navigator.share({ title: C.title, text, url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text + ' ' + url); toast(C.end.copied); }
    catch (e) { window.prompt(C.end.share, text + ' ' + url); }
  }

  // ------------------------------------------------------------ boot
  function boot() {
    track('rc_start');
    const saved = store.get('rc_run');
    const game = saved ? E.replay(saved) : null;
    if (saved && !game) store.del('rc_run');
    if (game && !game.done && game.choices.length) return renderResume(game);
    renderSetup();
  }
  boot();
})();
```

- [ ] **Step 2a: Title-block labels in the copy file**

In `robot-comments-copy.js`, inside `week`, after `defineTags: 'What these mean',` add:

```js
      titleBlock: { project: 'Project', week: 'Week', hours: 'Hours' },
```

- [ ] **Step 3: Passthrough**

In `.eleventy.js`, directly after the line `  eleventyConfig.addPassthroughCopy("the-feed-engine.js");`, add:

```js
  eleventyConfig.addPassthroughCopy("robot-comments.html");
  eleventyConfig.addPassthroughCopy("robot-comments-ui.js");
  eleventyConfig.addPassthroughCopy("robot-comments-data.js");
  eleventyConfig.addPassthroughCopy("robot-comments-bands.js");
  eleventyConfig.addPassthroughCopy("robot-comments-engine.js");
  eleventyConfig.addPassthroughCopy("robot-comments-copy.js");
```

- [ ] **Step 4: Build and check the output**

Run: `npm run build && ls _site/robot-comments* && node -e "new Function(require('fs').readFileSync('robot-comments-ui.js','utf8'))" && npm run test:rc`
Expected: Eleventy completes; `_site/` lists `robot-comments.html` and the five `robot-comments-*.js` files; the syntax check prints nothing; `41/41 passed`.

- [ ] **Step 5: Spec row**

In `docs/superpowers/specs/2026-09-28-robot-comments-design.md` §3, replace the `robot-comments.html` row's description with: `Standalone page (does NOT load \`nav.js\`): head, game-only CSS tokens and styles, the SVG ink filter, script tags. Plan 4 adds the inline Plausible snippet and OG tags.` and add a row after it: `| \`robot-comments-ui.js\` | Browser-only controller: renders every screen from engine state, all text from RobotCopy/RobotData; saves \`rc_run\`/\`rc_last\`. |`

- [ ] **Step 6: Commit**

```bash
git add robot-comments.html robot-comments-ui.js robot-comments-copy.js .eleventy.js docs/superpowers/specs/2026-09-28-robot-comments-design.md docs/superpowers/plans/2026-09-29-robot-comments-ui.md
git commit -m "Robot Comments: playable page and UI controller (plan 3 task 1)"
```

**Checkpoint A.**

---

### Task 2: Browser verification: play, layout, motion (controller)

Run with `preview_start` name `site`, page `http://localhost:8080/robot-comments.html`. Fix anything that fails in `robot-comments.html` / `robot-comments-ui.js` (dispatch a fix subagent with the failing check and its output), then re-run the check.

- [ ] **Step 1: No console errors on load and through a full game**

Clear storage (`localStorage.clear()`), reload, then run this in the page:

```js
document.getElementById('start').click();
for (let i = 0; i < 80 && !document.querySelector('.end'); i++) {
  const post = document.getElementById('post');
  if (post) { document.querySelector('.hand .card:not([disabled])').click(); document.getElementById('post').click(); }
  else document.getElementById('nx').click();
}
[!!document.querySelector('.end'), document.querySelectorAll('.strip.big .c').length]
```

Expected: `[true, 72]`; `read_console_messages` with `onlyErrors: true` returns nothing.

- [ ] **Step 2: Every screen fits a phone with no scroll (except the end screen) and never scrolls sideways**

For each viewport (390x844 via `resize_window` width/height, and 360x780), check setup, a decision week with the longest-title card selected (`t04`/`d01` if dealt, else the card whose `h3` is tallest), a resolve screen, and an event memo. Measure with:

```js
[document.documentElement.scrollHeight <= innerHeight + 1, document.documentElement.scrollWidth <= innerWidth]
```

Expected: `[true, true]` on every one of those screens at both sizes; on the end screen only the second value must be true. If a screen overflows vertically, reduce in this order until it fits: `.hero h1` font-size (38px to 34px), `.card .in` min-height (104px to 92px), `.feed` height (196px to 176px), `.strip .c` height (11px to 9px). Never remove content.

- [ ] **Step 3: Screenshot the four key screens at 390x844** (setup, week with a selected card, resolve after the stamp lands, end) and look for: the red rule under every title, no text under the stamp, the stamp word inside its band, the memo's torn edge and tape.

- [ ] **Step 4: Reduced motion**

Check the CSS rule exists and that the stamp appears without animation when reduced motion is set: run `matchMedia('(prefers-reduced-motion: reduce)').matches` after emulating it if the pane supports it. If emulation is unavailable, confirm by reading the code path (`reduce` branch in `renderResolve`) and note that in the report.

- [ ] **Step 5: Commit any fixes**

```bash
git add robot-comments.html robot-comments-ui.js docs/superpowers/plans/2026-09-29-robot-comments-ui.md
git commit -m "Robot Comments UI: layout fixes from browser verification"
```

(Skip if nothing changed; still tick the boxes and commit the plan.)

---

### Task 3: Browser verification: resume, sheets, share (controller)

- [ ] **Step 1: Resume**

`localStorage.clear()`, reload, start a game as Series B, 3 hours, play 3 decision weeks, then reload. Expected: a resume card reading "Week 4 of 12 · Series B exec · 3 hours". Press Resume. Expected: the week-4 hand, with the strip chart showing 3 filled columns. Reload again and press Start over. Expected: the setup screen, and `localStorage.getItem('rc_run')` is `null`.

- [ ] **Step 2: Stale and corrupted saves are discarded**

Run `localStorage.setItem('rc_run', JSON.stringify({v: 1, setup: {archetype: 'seed', budget: 3}, choices: [{card: 't01', engagement: 'none'}]}))` then reload. Expected: the setup screen (no resume card) and `rc_run` removed. Repeat with `localStorage.setItem('rc_run', '{not json')`. Expected: the same.

- [ ] **Step 3: Last result**

Finish a game (Task 2 Step 1 script), reload. Expected: setup shows "See your last result"; pressing it renders the same archetype, pipeline and strip chart as before the reload.

- [ ] **Step 4: Sheets open, close and return focus**

On a week screen: select a card, press "What these mean" (expect a sheet with five definitions), press Escape (sheet gone, focus back on the button). Press a strip-chart label (expect its definition). Press "How to read a card" on week 1 (expect the annotated card, numbered markers 1 to 4, four stamps). After posting, press the landed stamp and "Read the source" (expect the source sheet with the stamp, why-line, meaning and citation link). On the end screen press Pipeline, the band word, Fingerprint clarity, Folklore tax and the title stamp (each opens a sheet). Clicking the dim backdrop closes a sheet.

- [ ] **Step 5: Share fallback**

On the end screen in the desktop pane (no `navigator.share`), press Share. Expected: a "Link copied" toast, or the prompt fallback if clipboard access is denied. Confirm the text matches `{Archetype} · pipeline: {band} · folklore tax: {n} http://localhost:8080/robot-comments/r/{slug}/`.

- [ ] **Step 6: Keyboard pass**

From a fresh setup screen, reach Start, pick a card, pick an engagement, Post and Next week using only Tab / Shift+Tab / Enter. Expected: every control reachable, focus ring visible, focus stays on the pressed tile or card after re-render.

- [ ] **Step 7: Commit fixes and tick boxes**

```bash
git add robot-comments.html robot-comments-ui.js docs/superpowers/plans/2026-09-29-robot-comments-ui.md
git commit -m "Robot Comments UI: resume, sheets and share verified"
```

**Checkpoint B.** Reset the viewport with `resize_window` preset `desktop`.

---

### Task 4: Review

- [ ] **Step 1: Dispatch a code reviewer** on `git diff <task-1 base>..HEAD -- robot-comments.html robot-comments-ui.js .eleventy.js` against spec §5, §5a, §10, §10a, §12 and this plan's scope. Ask specifically about: text that bypasses RobotCopy, analytics calls firing twice (for example on re-render or on "See your last result"), resume edge cases (reload during an event screen resumes after the event without re-showing the memo, by design; reload on the end screen), focus handling in sheets, XSS (every interpolation passes through `esc`), and anything that breaks the no-scroll rule.
- [ ] **Step 2: Fix Critical/Important findings** via a fix subagent, re-run the affected Task 2/3 checks, commit.
- [ ] **Step 3: Update memory and report.** Plan 3 complete; Plan 4 (integration) next.

---

## Spec coverage (Plan 3)

| Spec | Where |
|---|---|
| §2.4 phone-first, no scroll, tap only | CSS; Task 2 Step 2 |
| §4 setup, three taps | `renderSetup` |
| §5 turn loop, budget greying, resolve, stamp reveal | `renderWeek`, `play`, `renderResolve` |
| §5a resume, stale discard, last result | `boot`, `renderResume`, `store`, Task 3 |
| §8 event memo | `renderEvent` |
| §9/§10 end screen above the fold, share, replay, podcast line, sources | `renderEnd`, `share` |
| §10a definitions, card guide, evidence links | `defineOne`, `defineTags`, `cardGuide`, links |
| §12 visual system | `robot-comments.html` CSS |
| §14 analytics call sites | `track(...)` calls (snippet in Plan 4) |
