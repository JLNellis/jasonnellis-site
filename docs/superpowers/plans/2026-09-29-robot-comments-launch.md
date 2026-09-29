# 80% of Your Comments Are Robots: Launch Wiring Implementation Plan (Plan 4 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game launchable at `jasonnellis.com/robot-comments`: analytics, share images and share pages, the evidence page, the optional Building Value email box, clean URL, sitemap, `/experiments` card, privacy policy line and CLAUDE.md.

**Architecture:** One Eleventy global data file, `_data/robotComments.js`, `require`s the game's own data/engine/copy files and shapes them for two templates: the evidence page (`/robot-comments/evidence/`) and six share pages (`/robot-comments/r/<slug>/`). Nothing is hand-maintained, so neither page can drift from the game. The game page loads `nav.js` (it renders no header or footer because the page has no `<site-header>`/`<site-footer>` tags) to get Plausible and `SITE_CONFIG.newsletterPost` from their single existing source. Share images are rendered once from an HTML template by headless Chrome, the same way as Burn Rate's.

**Tech Stack:** Eleventy 3 (Nunjucks, CommonJS data file), vanilla JS, headless Chrome + Pillow for images. Spec: `docs/superpowers/specs/2026-09-28-robot-comments-design.md` §3, §10, §10a, §14. Branch `robot-comments`; do not push. Jason pushes.

**Checkpoints:** A after Task 3 (evidence + share pages build); B after Task 6 (all site wiring done, verified locally); C after Task 7 (Kit, needs Jason); D after Task 8 (final review, ready to merge).

**Needs Jason:** Task 7 (OK to create four Kit custom fields in his account; an email address for one test subscription). After launch: add the Plausible goals listed in Task 8.

---

## File map

| File | Change |
|---|---|
| Create `_data/robotComments.js` | Evidence rows (one per why-line) grouped by tier, the title stamp, the six outcomes. |
| Create `robot-comments-evidence.njk` | `/robot-comments/evidence/`, indexed, site chrome. |
| Create `robot-comments-share.njk` | Six `noindex` share pages with archetype OG tags, redirecting to the game. |
| Create `tools/robot-comments-og/og.html`, `render.sh`, `README.md` | Share-card template and renderer. |
| Create `og-robot-comments.jpg` + six `og-robot-comments-<slug>.jpg` | Rendered cards. |
| Create `tool-index/robot-comments.md` | `/experiments` card (and sitemap entry via the tools collection). |
| Modify `robot-comments.html` | `nav.js`, OG/Twitter tags, email-box styles. |
| Modify `robot-comments-ui.js` | Email box (`renderNotify`). |
| Modify `robot-comments-copy.js` | `evidence.suppressedLabel`. |
| Modify `tools/robot-comments-test.js` | Evidence-data test. |
| Modify `.eleventy.js`, `_redirects`, `sitemap.njk`, `privacy.html`, `CLAUDE.md`, spec | Wiring and docs. |

---

### Task 1: Evidence data

**Files:**
- Create: `_data/robotComments.js`
- Modify: `robot-comments-copy.js`, `tools/robot-comments-test.js`

- [x] **Step 1: Write the failing test**

Insert above the runner line in `tools/robot-comments-test.js`:

```js
// ---------------------------------------------------------------- evidence data (plan 4)
test('evidence data: one row per why-line, every row sourced, grouped into the four tiers', () => {
  const RC = require('../_data/robotComments.js')();
  assert.deepStrictEqual(RC.rows.map(r => r.key).sort(), Object.keys(C.why).sort());
  for (const r of RC.rows) {
    assert.ok(r.label && r.why && r.stampLabel, r.key);
    assert.ok(D.SOURCES[r.source.id], r.key);
    assert.ok(['proven', 'measured', 'disputed', 'invented'].includes(r.stamp), r.key);
  }
  assert.strictEqual(RC.tiers.reduce((n, g) => n + g.rows.length, 0), RC.rows.length);
  assert.deepStrictEqual(RC.outcomes.map(o => o.slug).sort(), Object.keys(D.OUTCOMES).sort());
  assert.strictEqual(RC.titleStamp.stamp, 'invented');
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npm run test:rc`
Expected: the new test FAILS with `Cannot find module '../_data/robotComments.js'`; 41 pass.

- [x] **Step 3: Add the copy line**

In `robot-comments-copy.js`, inside `evidence`, after `backToGame: 'Play the game',` add:

```js
      suppressedLabel: 'Reach cut by an earlier pod or bait',
```

- [x] **Step 4: Create `_data/robotComments.js`**

```js
// Eleventy global data (robotComments): the evidence page and the share pages are
// built from the same files the game runs on, so they cannot drift (spec §10a).
const D = require('../robot-comments-data.js');
const E = require('../robot-comments-engine.js');
const C = require('../robot-comments-copy.js');

const L = C.labels;
const TIERS = ['proven', 'measured', 'disputed', 'invented'];

const source = id => ({ id, cite: D.SOURCES[id].cite, url: D.SOURCES[id].url });
const row = (key, label, entry) => ({
  key, label,
  stamp: entry.stamp, stampLabel: L.stamps[entry.stamp],
  ours: entry.mag === 'ours',
  why: C.why[key],
  source: source(entry.src),
});

// One row per lever the game can reveal, using the same stamped entries the engine's leverFor uses.
function levers() {
  const F = E.CONFIG.formats, H = E.CONFIG.hooks, SB = E.CONFIG.substance, CT = E.CONFIG.cta, EV = E.CONFIG.events;
  const rows = [];
  for (const f of Object.keys(F)) rows.push(row('format:' + f, L.formats[f], F[f].reach));
  for (const h of ['claim', 'scene']) rows.push(row('hook:' + h, L.hooks[h], H[h]));
  for (const s of ['named', 'personal', 'promo']) rows.push(row('sub:' + s, L.substance[s], SB[s].contrib));
  rows.push(row('cta:question', L.cta.question, CT.question.contrib));
  rows.push(row('cta:linkbody', L.cta.linkbody, CT.linkbody.dwell));
  rows.push(row('cta:linkcomment', L.cta.linkcomment, CT.linkcomment.dwell));
  rows.push(row('cta:bait', L.cta.bait, CT.bait.reach));
  rows.push(row('suppressed', C.evidence.suppressedLabel, { stamp: 'proven', src: 'jurka26', mag: 'ours' }));
  for (const k of D.CARDS.filter(k => k.bait)) rows.push(row(k.id, k.title, k));
  for (const e of D.EVENTS) rows.push(row('event:' + e.id, C.events[e.id].name, EV[e.id].lever));
  return rows;
}

module.exports = () => {
  const rows = levers();
  return {
    title: C.title,
    tagline: C.tagline,
    evidence: C.evidence,
    oursNote: C.week.oursNote,
    sourceLink: C.week.sourceLink,
    titleStamp: Object.assign({}, C.titleStamp, { stampLabel: L.stamps[C.titleStamp.stamp], source: source(C.titleStamp.src) }),
    tiers: TIERS.map(t => ({ tier: t, label: L.stamps[t], meaning: L.stampMeaning[t], rows: rows.filter(r => r.stamp === t) }))
      .filter(g => g.rows.length),
    rows,
    outcomes: Object.keys(D.OUTCOMES).map(slug => ({
      slug, name: C.outcomes[slug].name, tagline: C.outcomes[slug].tagline, image: '/og-robot-comments-' + slug + '.jpg',
    })),
  };
};
```

- [x] **Step 5: Run the tests**

Run: `npm run test:rc`
Expected: `42/42 passed`.

- [x] **Step 6: Commit**

```bash
git add _data/robotComments.js robot-comments-copy.js tools/robot-comments-test.js docs/superpowers/plans/2026-09-29-robot-comments-launch.md
git commit -m "Robot Comments: evidence data for Eleventy, built from the game's own files"
```

---

### Task 2: Evidence page

**Files:**
- Create: `robot-comments-evidence.njk`

- [x] **Step 1: Create the template**

```njk
---
permalink: /robot-comments/evidence/
eleventyExcludeFromCollections: true
---
{%- set rc = robotComments -%}
{%- set ev = rc.evidence -%}
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ ev.title | e }}</title>
<meta name="description" content="{{ ev.description | e }}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Jason Nellis">
<meta property="og:url" content="https://jasonnellis.com/robot-comments/evidence/">
<meta property="og:title" content="{{ ev.title | e }}">
<meta property="og:description" content="{{ ev.description | e }}">
<meta property="og:image" content="https://jasonnellis.com/og-robot-comments.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ ev.title | e }}">
<meta name="twitter:description" content="{{ ev.description | e }}">
<meta name="twitter:image" content="https://jasonnellis.com/og-robot-comments.jpg">
<link rel="canonical" href="https://jasonnellis.com/robot-comments/evidence/">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/site.css">
<script src="/nav.js"></script>
<style>
  /* The game's paper and stamp inks, scoped to this page (spec §12 game-only tokens). */
  .ev{--paper:#E3E9DF;--grid:rgba(52,104,74,.12);--ink:#1B2630;--ink2:#46535C;--ink3:#5C6870;--margin:#C8423A;
      --proven:#1F6B45;--measured:#99620E;--disputed:#6E3A6B;--invented:#B3261E}
  .ev{max-width:820px;margin:0 auto;padding:56px 16px 72px}
  .ev-hero h1{font-size:clamp(34px,5vw,54px);line-height:1.05;letter-spacing:-.025em;font-weight:700;margin:0 0 18px;max-width:18ch}
  .ev-hero .lede{font-size:18px;line-height:1.6;color:var(--fg-2);margin:0 0 24px;max-width:40em}
  .ev-paper{margin-top:40px;background-color:var(--paper);color:var(--ink);border-radius:6px;padding:28px 22px;
    background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:18px 18px}
  .ev-tier+.ev-tier{margin-top:36px}
  .ev-tier h2{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:17px;font-weight:500;color:var(--ink2);margin:0 0 14px;
    padding-bottom:10px;border-bottom:1.5px solid var(--margin)}
  .ev-stamp{display:inline-block;font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;
    border:2.5px solid currentColor;border-radius:4px;transform:rotate(-3deg)}
  .ev-proven{color:var(--proven)} .ev-measured{color:var(--measured)} .ev-disputed{color:var(--disputed)} .ev-invented{color:var(--invented)}
  .ev-row{padding:14px 0;border-bottom:1px solid rgba(27,38,48,.12)}
  .ev-row:last-child{border-bottom:0}
  .ev-row h3{font-size:18px;font-weight:500;margin:0 0 6px;color:var(--ink)}
  .ev-row p{margin:0 0 6px;font-size:15.5px;line-height:1.55;color:var(--ink)}
  .ev-row .ev-src{font-size:13px;color:var(--ink3)}
  .ev-row .ev-src a{color:inherit}
</style>
</head>
<body>
<site-header></site-header>
<main class="ev">
  <section class="ev-hero">
    <h1>{{ ev.title | e }}</h1>
    <p class="lede">{{ ev.intro | e }}</p>
    <a class="btn primary" href="/robot-comments">{{ ev.backToGame | e }}</a>
  </section>

  <div class="ev-paper">
    <section class="ev-tier" id="title">
      <h2><span class="ev-stamp ev-{{ rc.titleStamp.stamp }}">{{ rc.titleStamp.stampLabel | e }}</span> {{ ev.titleStampHeading | e }}</h2>
      <article class="ev-row">
        <h3>{{ rc.title | e }}</h3>
        <p>{{ rc.titleStamp.why | e }}</p>
        <p class="ev-src">{{ rc.titleStamp.source.cite | e }}{% if rc.titleStamp.source.url %} <a href="{{ rc.titleStamp.source.url }}" target="_blank" rel="noopener">{{ rc.sourceLink | e }}</a>{% endif %}</p>
      </article>
    </section>
    {%- for g in rc.tiers %}
    <section class="ev-tier" id="{{ g.tier }}">
      <h2><span class="ev-stamp ev-{{ g.tier }}">{{ g.label | e }}</span> {{ g.meaning | e }}</h2>
      {%- for r in g.rows %}
      <article class="ev-row">
        <h3>{{ r.label | e }}</h3>
        <p>{{ r.why | e }}{% if r.ours %} {{ rc.oursNote | e }}{% endif %}</p>
        <p class="ev-src">{{ r.source.cite | e }}{% if r.source.url %} <a href="{{ r.source.url }}" target="_blank" rel="noopener">{{ rc.sourceLink | e }}</a>{% endif %}</p>
      </article>
      {%- endfor %}
    </section>
    {%- endfor %}
  </div>
</main>
<site-footer></site-footer>
</body>
</html>
```

- [x] **Step 2: Build and check**

Run: `npm run build && grep -c 'class="ev-row"' _site/robot-comments/evidence/index.html && grep -c "&amp;amp;" _site/robot-comments/evidence/index.html`
Expected: build succeeds; `30` rows (29 levers + the title); `0` double-escaped ampersands (if non-zero, Eleventy autoescape is on: drop the `| e` filters and rebuild).

- [x] **Step 3: Commit**

```bash
git add robot-comments-evidence.njk docs/superpowers/plans/2026-09-29-robot-comments-launch.md
git commit -m "Robot Comments: evidence page at /robot-comments/evidence/"
```

---

### Task 3: Share pages

**Files:**
- Create: `robot-comments-share.njk`

- [x] **Step 1: Create the template**

```njk
---
pagination:
  data: robotComments.outcomes
  size: 1
  alias: o
permalink: "/robot-comments/r/{{ o.slug }}/"
eleventyExcludeFromCollections: true
---
{%- set rc = robotComments -%}
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ o.name | e }} · {{ rc.title | e }}</title>
<meta name="robots" content="noindex">
<meta name="description" content="{{ o.tagline | e }}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Jason Nellis">
<meta property="og:url" content="https://jasonnellis.com/robot-comments/r/{{ o.slug }}/">
<meta property="og:title" content="{{ o.name | e }} · {{ rc.title | e }}">
<meta property="og:description" content="{{ o.tagline | e }}">
<meta property="og:image" content="https://jasonnellis.com{{ o.image }}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ o.name | e }} · {{ rc.title | e }}">
<meta name="twitter:description" content="{{ o.tagline | e }}">
<meta name="twitter:image" content="https://jasonnellis.com{{ o.image }}">
<link rel="canonical" href="https://jasonnellis.com/robot-comments">
<meta http-equiv="refresh" content="0; url=/robot-comments">
</head>
<body>
<p><a href="/robot-comments">{{ rc.evidence.backToGame | e }}</a></p>
</body>
</html>
```

- [x] **Step 2: Build and check**

Run: `npm run build && ls _site/robot-comments/r/ && grep -o 'og:image" content="[^"]*' _site/robot-comments/r/ghost/index.html`
Expected: six directories (`broadcaster control-group fingerprinted-founder generalist ghost pod-casualty`); `og:image" content="https://jasonnellis.com/og-robot-comments-ghost.jpg`.

- [x] **Step 3: Commit**

```bash
git add robot-comments-share.njk docs/superpowers/plans/2026-09-29-robot-comments-launch.md
git commit -m "Robot Comments: six noindex share pages with archetype cards"
```

**Checkpoint A.**

---

### Task 4: Share images

**Files:**
- Create: `tools/robot-comments-og/og.html`, `tools/robot-comments-og/render.sh`, `tools/robot-comments-og/README.md`
- Create: seven `og-robot-comments*.jpg` at the repo root
- Modify: `.eleventy.js`

- [x] **Step 1: Create `tools/robot-comments-og/og.html`**

```html
<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap">
<style>
:root{--paper:#E3E9DF;--grid:rgba(52,104,74,.14);--ink:#1B2630;--ink2:#46535C;--card:#FBFAF5;--margin:#C8423A;--invented:#B3261E}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased;
  background-color:var(--paper);background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:30px 30px}
.card{position:absolute;left:70px;top:64px;width:1060px;height:500px;background:var(--card);border-radius:6px;
  box-shadow:0 22px 44px -26px rgba(20,40,30,.6);transform:rotate(-.6deg);padding:54px 64px}
.kicker{font-size:28px;color:var(--ink2);padding-bottom:18px;border-bottom:3px solid var(--margin);margin-bottom:30px;max-width:720px}
.kicker:empty{display:none}
h1{font-size:92px;line-height:.98;letter-spacing:-.035em;font-weight:700;max-width:800px}
.tag{font-size:36px;font-style:italic;color:var(--ink2);margin-top:22px;max-width:800px}
.url{position:absolute;left:64px;bottom:42px;font-size:24px;color:var(--ink2)}
.stamp{position:absolute;right:50px;top:34px;width:230px;height:230px;transform:rotate(11deg);opacity:.92;mix-blend-mode:multiply}
.stamp svg{width:100%;height:100%;overflow:visible}
</style></head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="ink" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="1" seed="3" result="m"/>
    <feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.55" result="mask"/>
    <feComposite in="d" in2="mask" operator="in"/>
  </filter>
  <path id="ring" d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0"/>
</defs></svg>
<div class="card"><p class="kicker" id="k"></p><h1 id="h"></h1><p class="tag" id="t"></p><p class="url">jasonnellis.com/robot-comments</p><div class="stamp" id="s"></div></div>
<script src="../../robot-comments-data.js"></script>
<script src="../../robot-comments-copy.js"></script>
<script>
  const D = RobotData, C = RobotCopy;
  const a = new URLSearchParams(location.search).get('a') || 'default';
  const o = C.outcomes[a];
  document.getElementById('k').textContent = o ? C.title : '';
  document.getElementById('h').textContent = o ? o.name : C.title;
  document.getElementById('t').textContent = o ? o.tagline : C.tagline;
  const src = C.titleStamp.src, name = D.SOURCES[src].cite.split(',')[0].split(':')[0].toUpperCase();
  const ring = (name + ' · ' + name).slice(0, 44), word = C.labels.stamps[C.titleStamp.stamp].toUpperCase();
  document.getElementById('s').innerHTML = `<svg viewBox="0 0 100 100"><g filter="url(#ink)" fill="none" stroke="var(--invented)" style="color:var(--invented)">
    <circle cx="50" cy="50" r="46" stroke-width="3.6"/><circle cx="50" cy="50" r="41" stroke-width="1.2"/>
    <text font-family="DM Sans" font-weight="700" font-size="7.2" letter-spacing="1.1" fill="currentColor" stroke="none"><textPath href="#ring" startOffset="2%">${ring}</textPath></text>
    <rect x="6" y="40" width="88" height="20" fill="var(--card)" stroke-width="2.2"/>
    <text x="50" y="55" text-anchor="middle" font-family="DM Sans" font-weight="700" font-size="11.5" letter-spacing="0.8" fill="currentColor" stroke="none">${word}</text></g></svg>`;
</script>
</body></html>
```

- [x] **Step 2: Create `tools/robot-comments-og/render.sh`** and make it executable (`chmod +x`)

```sh
#!/bin/sh
# Renders the default card and the six archetype cards to the repo root.
# Needs Google Chrome and python3 with Pillow. Rerun after any copy change.
set -e
cd "$(dirname "$0")/../.."
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="${TMPDIR:-/tmp}"
for a in default pod-casualty ghost generalist broadcaster fingerprinted-founder control-group; do
  out="og-robot-comments-$a.jpg"
  [ "$a" = default ] && out="og-robot-comments.jpg"
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 \
    --virtual-time-budget=10000 --screenshot="$TMP/rc-og.png" "file://$PWD/tools/robot-comments-og/og.html?a=$a" >/dev/null 2>&1
  python3 -c "from PIL import Image; Image.open('$TMP/rc-og.png').convert('RGB').resize((1200,630), Image.LANCZOS).save('$out','JPEG',quality=88,progressive=True,optimize=True)"
  echo "wrote $out"
done
```

- [x] **Step 3: Create `tools/robot-comments-og/README.md`**

```markdown
# 80% of Your Comments Are Robots: share cards

`og.html` renders one 1200x630 card: `?a=default` (game title + tagline) or `?a=<archetype slug>`
(game title, archetype name, tagline). Every card carries the title's Invented stamp. Text comes from
`robot-comments-copy.js`, so rerun after any copy change:

    tools/robot-comments-og/render.sh

Writes `og-robot-comments.jpg` (the game page, the evidence page) and `og-robot-comments-<slug>.jpg`
(the share pages at `/robot-comments/r/<slug>/`) at the repo root. They are passthrough-copied by
the `og-robot-comments*.jpg` glob in `.eleventy.js`.
```

- [x] **Step 4: Render and check**

Run: `tools/robot-comments-og/render.sh && python3 -c "from PIL import Image; import glob; print(sorted((f, Image.open(f).size) for f in glob.glob('og-robot-comments*.jpg')))"`
Expected: seven `wrote ...` lines, then seven files each `(1200, 630)`. Open `og-robot-comments.jpg` and `og-robot-comments-control-group.jpg` with the Read tool and confirm: the title/archetype is legible, the stamp reads INVENTED, nothing is clipped. If the archetype name wraps past three lines, lower `h1` font-size in `og.html` to 80px and rerender.

- [x] **Step 5: Passthrough**

In `.eleventy.js`, after `  eleventyConfig.addPassthroughCopy("robot-comments-copy.js");` add:

```js
  eleventyConfig.addPassthroughCopy("og-robot-comments*.jpg");
```

Run: `npm run build && ls _site/og-robot-comments*.jpg | wc -l`
Expected: `7`.

- [x] **Step 6: Commit**

```bash
git add tools/robot-comments-og og-robot-comments*.jpg .eleventy.js docs/superpowers/plans/2026-09-29-robot-comments-launch.md
git commit -m "Robot Comments: share cards (default + six archetypes) and renderer"
```

---

### Task 5: Game page head and the email box

**Files:**
- Modify: `robot-comments.html`, `robot-comments-ui.js`

- [ ] **Step 1: Head**

In `robot-comments.html`, replace the line `<!-- Plan 4 adds: Plausible snippet, Open Graph / Twitter tags -->` with:

```html
<meta property="og:type" content="website">
<meta property="og:site_name" content="Jason Nellis">
<meta property="og:url" content="https://jasonnellis.com/robot-comments">
<meta property="og:title" content="80% of Your Comments Are Robots">
<meta property="og:description" content="And they love you. Twelve weeks of LinkedIn posting decisions, every mechanic stamped Proven, Measured, Disputed or Invented.">
<meta property="og:image" content="https://jasonnellis.com/og-robot-comments.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="80% of Your Comments Are Robots">
<meta name="twitter:description" content="And they love you. Twelve weeks of LinkedIn posting decisions, every mechanic stamped Proven, Measured, Disputed or Invented.">
<meta name="twitter:image" content="https://jasonnellis.com/og-robot-comments.jpg">
<!-- nav.js supplies Plausible and SITE_CONFIG (Kit endpoint). No header or footer renders: this page has no site-header/site-footer tags. -->
<script src="/nav.js"></script>
```

- [ ] **Step 2: Email-box styles**

In `robot-comments.html`, after the `.srct{...}` rule, add:

```css
.notify{margin:18px 0 6px}
.notify label{display:block;font-size:15px;margin:0 0 8px}
.notify-row{display:flex;gap:8px}
.notify input{flex:1;min-width:0;font:inherit;font-size:16px;padding:12px;border:1.5px solid var(--rc-ink);border-radius:3px;background:var(--rc-card);color:var(--rc-ink)}
.notify .btn{flex:0 0 auto}
.notify [role=status]{margin-top:8px}
```

- [ ] **Step 3: `renderNotify` in `robot-comments-ui.js`**

Add this function directly above `async function share(F) {`:

```js
  // Optional Building Value notify box (spec §10.3, §14). Posts straight to Kit, no Kit script, no cookie.
  // The four fields are Kit custom fields; Kit ignores them if they do not exist.
  function renderNotify(F) {
    const box = app.querySelector('#notify');
    if (!box || typeof SITE_CONFIG === 'undefined') return;
    box.innerHTML = `<form class="notify" novalidate>
        <label for="rc-email">${esc(C.end.emailLine)}</label>
        <div class="notify-row"><input id="rc-email" type="email" name="email_address" required autocomplete="email" placeholder="${esc(C.end.emailPlaceholder)}">
          <button class="btn" type="submit">${esc(C.end.emailButton)}</button></div>
        <p class="src" role="status" aria-live="polite"></p>
      </form>`;
    const form = box.querySelector('form'), input = form.querySelector('input'), btn = form.querySelector('button'), status = form.querySelector('[role=status]');
    form.onsubmit = async e => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      btn.disabled = true;
      const body = new URLSearchParams({
        email_address: input.value.trim(),
        'fields[rc_archetype]': F.archetype,
        'fields[rc_budget]': String(S.setup.budget),
        'fields[rc_tax]': String(F.tax),
        'fields[rc_headline]': S.setup.archetype,
      });
      try {
        await fetch(SITE_CONFIG.newsletterPost, { method: 'POST', mode: 'no-cors', body });
        status.textContent = C.end.emailDone;
        input.disabled = true;
        track('rc_email');
      } catch (err) {
        status.textContent = C.end.emailError;
        btn.disabled = false;
      }
    };
  }
```

In `renderEnd`, directly after the line `app.querySelector('#ev').onclick = () => track('rc_evidence_opened', { from: 'end' });` add:

```js
    renderNotify(F);
```

- [ ] **Step 4: Check (no submission)**

Run: `node -e "new Function(require('fs').readFileSync('robot-comments-ui.js','utf8'))" && npm run test:rc && npm run build`
Expected: no syntax output, `42/42 passed`, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add robot-comments.html robot-comments-ui.js docs/superpowers/plans/2026-09-29-robot-comments-launch.md
git commit -m "Robot Comments: OG tags, nav.js for Plausible + Kit endpoint, Building Value notify box"
```

---

### Task 6: Site wiring, privacy, docs

**Files:**
- Modify: `_redirects`, `sitemap.njk`, `privacy.html`, `CLAUDE.md`, spec
- Create: `tool-index/robot-comments.md`

- [ ] **Step 1: `_redirects`**

After the line `/burn-rate.html  /burn-rate 301!` add `/robot-comments.html /robot-comments 301!`. After the line `/burn-rate  /burn-rate.html  200` add `/robot-comments  /robot-comments.html  200`.

- [ ] **Step 2: `/experiments` card** (the tools collection also puts `/robot-comments` in the sitemap)

Create `tool-index/robot-comments.md`:

```markdown
---
title: "80% of Your Comments Are Robots"
kind: "Game"
tagline: "And they love you."
url: "/robot-comments"
cta: "Play twelve weeks"
time: "7 min"
released: "Sep 2026"
order: 4
---
Twelve weeks of LinkedIn posting decisions for a founder with a headline and a pipeline to fill. Every result is stamped Proven, Measured, Disputed or Invented, with the source one tap away. No login, and your progress stays in your browser.
```

- [ ] **Step 3: Sitemap**

In `sitemap.njk`, after the `{%- endfor %}` that closes the `collections.tools` loop, add:

```njk
  <url><loc>https://jasonnellis.com/robot-comments/evidence/</loc></url>
```

- [ ] **Step 4: Privacy**

In `privacy.html`, in the "Podcast updates" paragraph, replace `on the writing pages, the homepage, the experiments index and the podcast page` with `on the writing pages, the homepage, the experiments index, the podcast page and the end of the <a href="/robot-comments">80% of Your Comments Are Robots</a> game`. Then, directly after the sentence ending `send the occasional update.`, add: ` The box at the end of the game also sends four details about the game you just played (the result you got, the weekly hours you picked, how many bait cards you played and your headline type) so I can see which results people sign up from. Your game itself never leaves your browser.` Update the hero eyebrow date `Last updated 22 September 2026` to today's date in the same format.

- [ ] **Step 5: CLAUDE.md**

1. In the "Pages" table, add a row after the `burn-rate.html` row:

```markdown
| `robot-comments.html` + `robot-comments-*.js` | `/robot-comments`, `/robot-comments/evidence/`, `/robot-comments/r/<slug>/` | "80% of Your Comments Are Robots", LinkedIn posting game | Deterministic engine (`robot-comments-engine.js`), data, copy and UI files; spec `docs/superpowers/specs/2026-09-28-robot-comments-design.md`. Every mechanic carries an evidence stamp that must resolve to a source (tests enforce it: `npm run test:rc`; balance: `npm run sim:rc`, which only tunes values stamped `ours`). Copy lives in `robot-comments-copy.js` and follows the house rules the tests lint. The evidence page and six share pages are generated by Eleventy from `_data/robotComments.js`, which reads the game's own files; nothing to hand-maintain. Loads `nav.js` for Plausible and the Kit endpoint but renders no header. Share cards: `tools/robot-comments-og/render.sh`. Progress saves in `localStorage` (`rc_run`, `rc_last`); saves invalidate automatically when the model changes. |
```

2. In "Analytics & privacy", in the Forms bullet, after the sentence about the Building Value notify form, add: `The Robot Comments end screen posts the same Kit form in the background with four custom fields (\`rc_archetype\`, \`rc_budget\`, \`rc_tax\`, \`rc_headline\`); /privacy lists them.`

- [ ] **Step 6: Spec**

In §3, replace the `robot-comments.html` row's description with: `Standalone page: head, game-only CSS tokens and styles, the SVG ink filter, script tags. Loads \`nav.js\` for Plausible and \`SITE_CONFIG\` (it renders no header or footer).` In §15 add a row: `| Standalone page carries Plausible inline | Loads nav.js (no header rendered) | Single source for Plausible and the Kit endpoint |`. In §18, mark the Kit and Plausible items with the outcome of Tasks 7 and 8 when they are done.

- [ ] **Step 7: Build and check locally**

Run: `npm run build && grep -c "robot-comments" _site/sitemap.xml && grep -n "robot-comments" _redirects && ls _site/experiments/index.html`
Expected: build succeeds; sitemap count `2` (`/robot-comments` and `/robot-comments/evidence/`); the two redirect lines; experiments page exists.

Then with `preview_start` name `site`: open `http://localhost:8080/experiments/` (the new card is there and links to `/robot-comments`), `http://localhost:8080/robot-comments/evidence/` (site header and footer, 30 rows on the paper panel, stamps coloured by tier, no console errors), `http://localhost:8080/robot-comments/r/ghost/` (redirects to `/robot-comments`, which 404s locally because the dev server ignores `_redirects`; that is expected), and finish a game at `http://localhost:8080/robot-comments.html` (the email box renders under "See all the evidence"; do not submit it). Confirm `typeof SITE_CONFIG` is `'object'` on the game page and no `<site-header>` renders.

- [ ] **Step 8: Commit**

```bash
git add _redirects tool-index/robot-comments.md sitemap.njk privacy.html CLAUDE.md docs/superpowers/specs/2026-09-28-robot-comments-design.md docs/superpowers/plans/2026-09-29-robot-comments-launch.md
git commit -m "Robot Comments: clean URL, experiments card, sitemap, privacy line, CLAUDE.md"
```

**Checkpoint B.**

---

### Task 7: Kit custom fields and one test subscription (controller, needs Jason)

- [ ] **Step 1:** Ask Jason for OK to create four custom fields in his Kit account: `rc_archetype`, `rc_budget`, `rc_tax`, `rc_headline`. On a yes, create them with the Kit connector (`list_custom_fields` first; skip any that exist; then `create_custom_field` for each missing one, label exactly as named). Report the keys Kit returns: if a key differs from the label, update the four `fields[...]` names in `renderNotify` to match and commit.
- [ ] **Step 2:** Ask Jason for an address to use for one test subscription (his own or a `+test` alias). On the local game page, finish a game, enter it, press Notify me. Then look the subscriber up with the Kit connector and confirm the four fields are set. Report the result. If Kit ignored the fields, follow spec §14's fallback: remove the four `fields[...]` entries from `renderNotify`, remove the extra sentence from `/privacy`, and commit.
- [ ] **Step 3:** Commit any changes: `git commit -am "Robot Comments: Kit custom fields confirmed"` (or the fallback message).

**Checkpoint C.**

---

### Task 8: Final review and handoff

- [ ] **Step 1:** Dispatch a final code reviewer over `git diff main..robot-comments` limited to the Plan 4 files (listed in the file map), checking: nothing in the evidence page or share pages is hand-written that should come from the data; escaping in the templates; OG URLs absolute; `noindex` on share pages only; the evidence page indexed; privacy text matches what the code sends; no cookie or third-party script added beyond Plausible (via nav.js) and the Google Fonts link inside the build-only OG template.
- [ ] **Step 2:** Fix Critical/Important findings, rebuild, recheck, commit.
- [ ] **Step 3:** Run everything once more: `npm run test:rc && npm run sim:rc && npm test && npm run build`. Expected: all pass, sim exits 0.
- [ ] **Step 4:** Hand off to Jason with: the branch is ready to merge into `main` (he merges and pushes); after the Netlify deploy, check `https://jasonnellis.com/robot-comments`, `/robot-comments/evidence/` and one share link in a link-preview tool; add these Plausible custom-event goals with custom properties enabled: `rc_start`, `rc_setup_complete`, `rc_turn_resolved`, `rc_event_shown`, `rc_completed`, `rc_share`, `rc_replay`, `rc_email`, `rc_resume`, `rc_evidence_opened`, `rc_card_guide_opened`.
- [ ] **Step 5:** Use superpowers:finishing-a-development-branch.

**Checkpoint D. Plan 4 complete; the game is ready to ship.**

---

## Spec coverage (Plan 4)

| Spec | Where |
|---|---|
| §3 evidence and share templates, OG renderer | Tasks 2, 3, 4 |
| §10 share with archetype images, email box (Building Value), podcast link | Tasks 3, 4, 5 |
| §10a evidence page, indexed, linked | Tasks 1, 2, 6 |
| §14 Plausible (via nav.js), Kit fields + test, privacy, experiments, redirects, sitemap, CLAUDE.md | Tasks 5, 6, 7, 8 |
