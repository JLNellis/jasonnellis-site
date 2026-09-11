# The Feed — Social-App Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `the-feed.html` into a phone-width "Sticker Feed" social app with four tabs (Home / Alerts / Inbox / Stats) and a bespoke solid icon set, without touching the engine, sim, or tests.

**Architecture:** One file changes — `the-feed.html`. We replace its `<style>` block (Sticker Feed tokens + components), rebuild its `<body>` into a single centered app column with a persistent header and bottom tab bar, add an inline SVG icon sprite, and adapt the render functions to route into tab panels. Every engine call and the effect-log/float-anchor contract are preserved verbatim. Verification is browser-based (the engine's own `npm test` must stay green because `the-feed-engine.js` is untouched).

**Tech Stack:** Standalone HTML/CSS/vanilla JS, inline SVG icons, Google Fonts (Space Grotesk) + existing DM Sans/DM Mono, Web Audio (unchanged), Plausible (unchanged).

---

## How this plan handles CSS

The logic, DOM structure, id contracts, icon mechanism, and render-function rewrites are given as **complete code** — they are load-bearing and precise. The **component CSS** (the visual craft) is authored at build time against the committed Sticker Feed token block in Task 1, following the per-component styling notes in each task. That styling is design work delivered to spec §1 — *not* a plan placeholder. Author real CSS for every class the tasks introduce; do not ship unstyled markup. Take the "look once" browser pass at the end of each UI task.

## Contracts that MUST survive (verify after every task)

- **Float-anchor ids:** `v-cash`, `v-rep`, `v-stress`, and `cc-<platformKey>` must exist on live elements — `floatDelta`/`anchorId` target them. `setMeter(k,v)` writes `#b-<k>.style.width` and `#v-<k>.textContent`, so keep `b-stress`/`v-stress`/`b-rep`/`v-rep`. Keep `v-cash`, `v-rent`, `v-band`.
- **Engine API only:** `newState, buildHand, applyMove, biz[id], settleWeek, rollEvent, applyEventChoice, advanceWeek, checkEndings, endingText` + read helpers. No new engine exports.
- **Sound + storage:** `SFX` layer and `thefeed_muted` localStorage key unchanged.
- **`noindex`, Plausible, standalone (no `nav.js`)** unchanged.

---

## Task 1: Sticker Feed foundation + app shell + Home tab (playable)

The big one. After it, the game is fully playable in the new skin; Alerts/Inbox/Stats/overlays are layered on next.

**Files:** Modify `the-feed.html` (head `<link>`, whole `<style>`, whole `<body>` shell, icon sprite, `render`, `renderChannels`, `renderMoves`, `channelSVG`, add tab state).

- [ ] **Step 1: Add the Space Grotesk font link**

In `<head>`, after the `colors_and_type.css` link (~line 18), add:

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap">
```

- [ ] **Step 2: Replace the `<style>` block with the Sticker Feed system**

Replace the entire `<style>…</style>` (lines ~19–224). Start it with the committed token block, then author components (notes below). Keep `colors_and_type.css` loaded for the DM font-faces; these tokens are the game's own layer.

```css
:root{
  --sf-bg:#0B1E38; --sf-bg-2:#0a1830; --sf-card:#12264a; --sf-card-2:#16305c;
  --sf-edge:#00E676; --sf-red:#FF0033; --sf-gold:#FFCA4B; --sf-blue:#5AA9FF;
  --sf-fg:#FFFFFF; --sf-fg-2:#9FB3D0; --sf-fg-3:#6F86A8;
  --sf-line:rgba(255,255,255,.14);
  --sf-sans:'Space Grotesk',system-ui,sans-serif;
  --sf-body:var(--font-sans,'DM Sans',sans-serif);
  --sf-mono:var(--font-mono,'DM Mono',monospace);
  --sf-shadow:3px 3px 0 rgba(0,0,0,.35);
  --sf-col-w:440px;
}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:
    radial-gradient(900px 520px at 84% -12%,rgba(255,0,51,.05),transparent 60%),var(--sf-bg-2);
  color:var(--sf-fg);font-family:var(--sf-body);line-height:1.5;-webkit-font-smoothing:antialiased}
```

Component styling notes (author full CSS to these; use the tokens, 2px borders, `--sf-shadow`, radii 12–20px):
- `.app` — the centered column: `max-width:var(--sf-col-w);margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--sf-bg);border-inline:2px solid var(--sf-line)` (the column edges). Sticky header on top, `.tabbody` flex-grows and scrolls, `.tabbar` sticks to the bottom.
- `.hdr` — avatar + `#channame` + `#weekchip`; then `.meterrow` with the meters.
- `.meter` — thin sticker bar; `.fill-stress`/`.fill-rep` fills; band classes `.hot/.fumes/.redline` shift stress fill amber→`--sf-red`.
- `.card` / `.move` — sticker cards: `background:var(--sf-card);border:2px solid var(--sf-line);border-radius:12px;box-shadow:var(--sf-shadow)`. `.move[disabled]` dimmed.
- `.pill`, `.abadge` (angle), `.flag` — sticker pills; angle colors: trend `--sf-blue`, evergreen `--sf-edge`, personal `--sf-gold`.
- `.btn.primary` — the End-week button: filled `--sf-red`, dark text, hard shadow, chunky.
- `.tabbar` + `.tab` — bottom bar; active tab `color:var(--sf-red)`; `.badge` red dot.
- `.ic{width:1em;height:1em;fill:currentColor}` for `<use>` icons; `.ic.big` for platform badges.
- Keep the `@media (prefers-reduced-motion:reduce)` rule. Keep `.flt` float style and `#floats` fixed layer. Keep overlay `.hidden{display:none}` (overlays reskinned in Task 5).
- Single committed dark look (the game is dark-only by design) — paint every color from tokens; no theme media query needed.

- [ ] **Step 3: Add the icon sprite + `icon()` helper**

At the very top of `<body>` (before `.app`), add an inline sprite (author all ~19 solid glyphs; core six shown, add the rest in the same style — solid fills, `viewBox="0 0 24 24"`):

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M12 3.5L21.5 12H18v8h-4v-5h-4v5H6v-8H2.5z"/></symbol>
  <symbol id="i-alerts" viewBox="0 0 24 24"><path d="M12 3a6 6 0 016 6c0 4 1.5 5 2 6H4c.5-1 2-2 2-6a6 6 0 016-6z"/><path d="M9.5 18.5a2.6 2.6 0 005 0z"/></symbol>
  <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M3 5h18v11h-9l-4 3.5V16H3z"/></symbol>
  <symbol id="i-stats" viewBox="0 0 24 24"><rect x="4" y="12" width="3.4" height="8" rx="1.2"/><rect x="10.3" y="5" width="3.4" height="15" rx="1.2"/><rect x="16.6" y="15" width="3.4" height="5" rx="1.2"/></symbol>
  <symbol id="i-live" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 7a7 7 0 000 10M17 7a7 7 0 010 10"/></symbol>
  <symbol id="i-longform" viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="12" rx="3.5"/><path fill="var(--sf-card)" d="M10.5 10l5 2.5-5 2.5z"/></symbol>
  <!-- add: i-short, i-micro, i-newsletter, i-trend, i-evergreen, i-personal,
       i-engage, i-deal, i-upgrade, i-membership, i-team, i-stress, i-rep,
       i-sound-on, i-sound-off, i-expand, i-crosspost -->
</defs></svg>
```

Add the helper in the script (near the other helpers, ~line 311):

```js
function icon(name, cls, color){ return `<svg class="ic ${cls||''}"${color?` style="color:${color}"`:''} aria-hidden="true"><use href="#i-${name}"/></svg>`; }
// map an engine platform key / angle / business id to a glyph name
const PLAT_ICON={longform:'longform',shortform:'short',micro:'micro',writing:'newsletter',live:'live'};
const ANGLE_ICON={trend:'trend',evergreen:'evergreen',personal:'personal'};
const BIZ_ICON={engage:'engage',deal:'deal',upgrade:'upgrade',paid:'membership',team:'team'};
```

- [ ] **Step 4: Replace the `<body>` shell markup**

Replace the board markup (the `.wrap` block, lines ~228–274) with the app column. Keep the float layer and both overlays (overlays restyled in Task 5). **Preserve every id the render code and float anchors use.**

```html
<div class="app">
  <header class="hdr">
    <div class="hrow">
      <div class="who"><span class="avatar" id="avatar"></span>
        <div><h1 id="channame">Your Channel</h1><span class="nichebadge" id="nichebadge">—</span></div></div>
      <div class="hright">
        <button class="soundbtn" id="soundBtn" type="button" aria-label="Toggle sound"></button>
        <span class="weekchip" id="weekchip">WK 01 / 52</span>
      </div>
    </div>
    <div class="meterrow">
      <div class="meter"><span class="mname">Stress <span class="mband" id="v-band"></span></span>
        <div class="bar"><i class="fill-stress" id="b-stress"></i></div><span class="mval mono" id="v-stress">20</span></div>
      <div class="meter"><span class="mname">Reputation</span>
        <div class="bar"><i class="fill-rep" id="b-rep"></i></div><span class="mval mono" id="v-rep">60</span></div>
      <div class="metric"><span class="k">Bank</span><span class="v mono" id="v-cash">$900</span></div>
      <div class="metric"><span class="k">Overhead</span><span class="v mono" id="v-rent">-$70</span></div>
    </div>
    <div class="helpline" id="helpline"></div>
  </header>

  <main class="tabbody">
    <section class="tabpane" id="tab-home">
      <div class="chanhead"><h3>Your Channels</h3><span class="hint" id="chanhint"></span></div>
      <div class="chanrow" id="chanrow"></div>
      <div class="stagehead"><h2 id="stagetitle">This Week</h2><span class="slotpill" id="slotpill"></span></div>
      <div id="stagebody"></div>
    </section>
    <section class="tabpane" id="tab-alerts" hidden><div class="feedlist" id="feedlist"></div></section>
    <section class="tabpane" id="tab-inbox" hidden><div id="inboxbody"></div></section>
    <section class="tabpane" id="tab-stats" hidden><div id="statsbody"></div></section>
  </main>

  <nav class="tabbar" id="tabbar">
    <button class="tab" data-tab="home">${/* icons injected by JS */''}Home</button>
    <button class="tab" data-tab="alerts">Alerts<span class="badge" id="badge-alerts" hidden></span></button>
    <button class="tab" data-tab="inbox">Inbox<span class="badge" id="badge-inbox" hidden></span></button>
    <button class="tab" data-tab="stats">Stats</button>
  </nav>
</div>
<div class="floats" id="floats"></div>
<!-- keep #startOverlay and #endOverlay here, restyled in Task 5 -->
```

Note: the `${…}` above is illustrative — write the tab buttons as static HTML and inject icons in Step 6, or hand-write each `<button class="tab" data-tab="home"><svg class="ic">…</svg>Home</button>`.

- [ ] **Step 5: Add tab state + routing; wire the tab bar and sound button**

In the script, add tab state near `let S=null,…` (~line 313):

```js
let tab='home'; let seenFeedLen=0;   // seenFeedLen: for the Alerts badge
function switchTab(t){ tab=t; SFX.play('click'); render(); }
```

Wire the bar once (near `buildStart()` at the end, ~line 526):

```js
document.querySelectorAll('#tabbar .tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
```

The sound button currently uses emoji glyphs (🔊/🔇). Replace those with `icon('sound-on')`/`icon('sound-off')`:

```js
function paintSound(){ const m=SFX.isMuted(); soundBtn.innerHTML=icon(m?'sound-off':'sound-on'); soundBtn.classList.toggle('muted',m); }
```
Call `paintSound()` where the old code set `soundBtn.textContent` (init ~line 528 and inside the onclick ~line 529).

- [ ] **Step 6: Adapt `render()` to route tabs; keep all header updates**

Rewrite `render()` so the header block stays as-is (it updates `#channame,#avatar,#nichebadge,#totfollow*,#weekchip,#v-band,#b-stress,#v-stress,#b-rep,#v-rep,#v-cash,#v-rent,#helpline,#slotpill`), then it shows only the active pane and fills it. (`#totfollow` no longer exists as a separate element — fold total-following into the header or drop it; if dropped, remove its line from render.)

```js
function render(){ if(!S)return;
  // ----- header (unchanged bindings; keep ids) -----
  $('channame').textContent=S.name; $('avatar').textContent=N().emoji; // avatar stays niche emoji for now
  $('nichebadge').textContent=N().label+' · '+N().blurb;
  $('weekchip').textContent='WK '+String(Math.min(S.week,52)).padStart(2,'0')+' / 52';
  const band=E.stressBand(S);
  setMeter('stress',S.stress); $('b-stress').className='fill-stress '+band; $('v-band').className='mband '+band; $('v-band').textContent=BAND_LABEL[band];
  setMeter('rep',S.rep);
  const c=$('v-cash'); c.textContent=money(S.cash); c.className='v mono '+(S.cash<0?'neg':'pos');
  const ob=E.overheadBreakdown(S); $('v-rent').textContent='-'+money(ob.total);
  $('helpline').textContent=`Overhead ${money(ob.base)} living + ${money(ob.platforms)} platforms`+(ob.payroll?` + ${money(ob.payroll)} payroll`:'')+(ob.lease?` + ${money(ob.lease)} studio`:'')+'.';
  $('slotpill').innerHTML=`<b>${S.slots.content}</b> content · <b>${S.slots.business}</b> business`;
  // ----- event forces the Inbox tab (Task 3 fills renderInbox) -----
  if(S.phase==='event'&&S.event){ tab='inbox'; }
  // ----- tab visibility + active-tab styling -----
  ['home','alerts','inbox','stats'].forEach(t=>{ $('tab-'+t).hidden = (t!==tab); });
  document.querySelectorAll('#tabbar .tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  // ----- badges -----
  const unseen=(S.feed||[]).length>seenFeedLen; $('badge-alerts').hidden=!(unseen&&tab!=='alerts');
  $('badge-inbox').hidden=!(S.phase==='event');
  if(tab==='alerts') seenFeedLen=(S.feed||[]).length;
  // ----- fill the active pane -----
  if(tab==='home'){ renderChannels(); if(S.phase==='event') renderHomeWaiting(); else renderMoves(); }
  else if(tab==='alerts') renderFeed();
  else if(tab==='inbox') renderInbox();
  else if(tab==='stats') renderStats();
}
```

Add small stubs so Task 1 stands alone (filled in later tasks):

```js
function renderInbox(){ $('inboxbody').innerHTML = S.phase==='event'&&S.event ? '' : '<p class="empty">No messages.</p>'; if(S.phase==='event') renderEventDM(); }
function renderStats(){ $('statsbody').innerHTML='<p class="empty">Stats coming.</p>'; }
function renderHomeWaiting(){ $('stagebody').innerHTML='<div class="waiting">Something\'s in your inbox. Open it to keep going.</div>'; $('stagetitle').textContent='Hold on.'; }
function renderEventDM(){ renderEvent(); /* Task 3 replaces with the DM styling */ }
```

For Task 1, `renderEvent` can keep rendering into a container inside `#tab-inbox` — simplest: in the stub `renderEventDM`, temporarily set `$('inboxbody').innerHTML` using the existing event markup so events are playable now; Task 3 restyles it. Wire its `.choice` clicks to `chooseEvent`.

- [ ] **Step 7: Restyle `renderChannels`, `renderMoves`, `channelSVG` to the new classes + icons**

- `channelSVG(p)`: keep `id="cc-<key>"` (float anchor!) and the tier visuals, but swap the emoji title glyph and avatar for the bespoke platform icon. Minimum change: keep the SVG card, replace `${pf.emoji}` in the title with nothing (the platform icon can be drawn as an inline `<use href="#i-${PLAT_ICON[p.key]}">` in the card, colored `pf.color`). Keep the follower count + tier thumbs.
- `renderMoves`: swap `moveView().ico` emoji for `icon(...)` — content cards use the platform icon (`icon(PLAT_ICON[m.pkey],'',PLATFORMS[m.pkey].color)`), business rows use `icon(BIZ_ICON[b.id])`, angle badges get `icon(ANGLE_ICON[m.angle])`. Update `moveView` to return an `iconName`+`color` instead of an emoji `ico`, and the two `movelabel` headers ("📣 Content", "🧰 Business") lose their emoji or gain a glyph. Keep all `data-i`/`data-biz`/`data-hire`/`data-fire`/`#endWeekBtn` wiring **unchanged**.
- `renderChannels`: restyle the `.chancard` container; keep `data-k` and the `cc-<key>` id inside.

- [ ] **Step 8: Verify in the browser**

Build and open the game:
```bash
npm run build && ls _site/the-feed.html
```
Start the eleventy preview, open `/the-feed`, then: start a game, take content + business moves, end several weeks (force an event by setting `window.FeedEngine.CONFIG.eventChance=1` in the console), confirm:
- Header meters + Bank/Overhead update; **floating deltas still appear over cash/rep/stress and the channel cards** (float-anchor contract).
- Tabs switch; active tab is red; no console errors.
- An event still resolves and the week advances.

Expected: fully playable in the new skin, `read_console_messages` clean.

- [ ] **Step 9: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: Sticker Feed shell — app column, tabs, icon sprite, Home tab"
```

---

## Task 2: Alerts tab — feed as notifications

**Files:** Modify `the-feed.html` (`renderFeed`, add a handle pool + CSS).

- [ ] **Step 1: Add a fake-handle pool + notification render**

Replace `renderFeed` (~line 506):

```js
const HANDLES=['@lurkr','@no_context','@fyp_ghost','@ratioed','@doomscroll','@chronically_on','@subtweet','@main_char','@rentfree','@touch_grass','@algorithm','@replyguy','@stan_acct','@notif_gremlin'];
function handleFor(i,txt){ // stable-ish per feed slot
  return HANDLES[(txt.length+i*7)%HANDLES.length]; }
function renderFeed(){
  const items=(S.feed||[]);
  $('feedlist').innerHTML = items.length ? items.map((f,i)=>{
    const cls=f.k||'', kindTag = cls==='big'?'hype':cls==='good'?'like':cls==='bad'?'warn':'note';
    return `<div class="notif ${kindTag}">
      <span class="nglyph">${f.e}</span>
      <div class="nbody"><span class="nhandle">${handleFor(i,f.t)}</span>
        <span class="ntext">${f.t}</span></div></div>`;
  }).join('') : '<p class="empty">Quiet feed. Post something.</p>';
}
```

Notes: `f.e` is the engine's narrative emoji — **kept verbatim** as the row glyph (spec §4). `f.t` is the engine text, unchanged. Style `.notif` as a notification row (avatar chip, handle in `--sf-fg-2`, text in `--sf-fg`); `.hype` gold left-edge, `.like` green, `.warn` red. Some rows may render as "comments" (indent + reply glyph) — optional texture, keep light.

- [ ] **Step 2: Verify**

Reload, play a few weeks, open **Alerts**: feed lines show as notifications with handles; the Alerts badge clears on open; kinds are color-coded; engine text intact. No console errors.

- [ ] **Step 3: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: Alerts tab — feed rendered as notifications with fake handles"
```

---

## Task 3: Inbox tab — events as DMs

**Files:** Modify `the-feed.html` (`renderEventDM`/`renderInbox`, `endWeek`, event CSS).

- [ ] **Step 1: Render the pending event as a DM thread**

Replace the Task-1 stub with a real DM view. The choices keep the same `chooseEvent(i)` wiring.

```js
function renderInbox(){
  if(S.phase==='event'&&S.event){ renderEventDM(); return; }
  $('inboxbody').innerHTML='<p class="empty">No messages. Events land here.</p>';
}
function renderEventDM(){
  const ev=S.event, sender = ev.kind==='hostile' ? 'the pile-on' : (ev.badge||'a DM');
  $('inboxbody').innerHTML=`<div class="dm ${ev.kind==='hostile'?'hostile':'neutral'}">
    <div class="dmhead"><span class="dmfrom">${ev.emoji} ${sender}</span><span class="dmbadge">${ev.badge}</span></div>
    <div class="dmbubble"><b>${ev.title}</b><p>${ev.text}</p></div>
    <div class="dmreplies">${ev.choices.map((c,i)=>
      `<button class="reply ${c.t}" data-i="${i}"><span class="ci">${c.ci}</span><span class="rl"><b>${c.label}</b><span>${c.desc}</span></span></button>`).join('')}</div>
  </div>`;
  $('inboxbody').querySelectorAll('.reply').forEach(b=>b.onclick=()=>chooseEvent(+b.dataset.i));
}
```

Style `.dm` as a chat thread: `.dmbubble` is an incoming message bubble (left, `--sf-card`); `.reply` buttons are outgoing-reply chips colored by `t` (repair `--sf-edge`, neutral `--sf-fg-2`, escalate `--sf-red`). Keep the old `renderEvent`/`.event` CSS removed or unused.

- [ ] **Step 2: Auto-switch to Inbox on a new event**

`endWeek` already sets `S.phase='event'` and calls `render()`, and Step-6 `render()` forces `tab='inbox'` when an event is pending — so the switch + `#badge-inbox` happen automatically. Confirm `endWeek` still plays the `event` sound. After `chooseEvent`→`advance`, `S.phase='play'`; add `tab='home'` at the top of `advance()` so it returns Home:

```js
function advance(){ tab='home'; E.advanceWeek(S); if(E.checkEndings(S)){ endGame(S.endKey); return; } S.phase='play'; E.buildHand(S); render(); }
```

- [ ] **Step 3: Verify**

Force `eventChance=1`, end a week: the app jumps to **Inbox**, the Inbox badge shows, the event reads as a DM with reply chips, Home shows the "something's in your inbox" waiting state and cannot end the week, choosing a reply resolves it and returns to Home for the next week. Float deltas from the event still fire. No console errors.

- [ ] **Step 4: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: Inbox tab — events arrive as DMs, forced decision preserved"
```

---

## Task 4: Stats tab — UI-side history + sparklines

**Files:** Modify `the-feed.html` (add `hist`, snapshot in `newGame`/`advance`, `renderStats`).

- [ ] **Step 1: Record a weekly snapshot (UI-side only)**

Add near `let tab=…`:

```js
let hist=[]; // UI-only; never enters S / engine / sim / tests
function snapshot(){ hist.push({ week:Math.min(S.week,52), followers:totalFollowers(), cash:S.cash, stress:Math.round(S.stress), rep:Math.round(S.rep) }); }
```

In `newGame` after `E.buildHand(S)` (~line 354) call `hist=[]; snapshot();`. In `advance()` after `E.advanceWeek(S)` and the endings check (so a completed week is recorded even on the final week), call `snapshot();` — place it before `E.buildHand(S)`:

```js
function advance(){ tab='home'; E.advanceWeek(S); if(E.checkEndings(S)){ snapshot(); endGame(S.endKey); return; } snapshot(); S.phase='play'; E.buildHand(S); render(); }
```

- [ ] **Step 2: Draw sparklines**

```js
function spark(vals,color){ if(vals.length<2) return '<span class="nodata">—</span>';
  const w=180,h=40,pad=3,mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;
  const x=i=>pad+i*(w-2*pad)/(vals.length-1), y=v=>h-pad-((v-mn)/rng)*(h-2*pad);
  const pts=vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lx=x(vals.length-1).toFixed(1), ly=y(vals[vals.length-1]).toFixed(1);
  return `<svg viewBox="0 0 ${w} ${h}" class="spark"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/><circle cx="${lx}" cy="${ly}" r="2.6" fill="${color}"/></svg>`;
}
function renderStats(){
  if(hist.length<2){ $('statsbody').innerHTML='<p class="empty">Play a few weeks to see your trend.</p>'; return; }
  const rows=[
    ['Followers', hist.map(h=>h.followers), 'var(--sf-edge)', fmt(totalFollowers())],
    ['Bank', hist.map(h=>h.cash), 'var(--sf-gold)', money(S.cash)],
    ['Stress', hist.map(h=>h.stress), 'var(--sf-red)', Math.round(S.stress)],
    ['Reputation', hist.map(h=>h.rep), 'var(--sf-blue)', Math.round(S.rep)],
  ];
  $('statsbody').innerHTML=rows.map(([k,vals,col,now])=>
    `<div class="statrow"><div class="statk"><span>${k}</span><b class="mono">${now}</b></div>${spark(vals,col)}</div>`).join('');
}
```

Style `.statrow` (label + current value + sparkline), `.spark{width:100%;height:40px}`.

- [ ] **Step 3: Verify**

Play ~4 weeks, open **Stats**: four sparklines with emphasized endpoints and current values; they extend each week. `npm test` still green (no engine touch). No console errors.

- [ ] **Step 4: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: Stats tab — UI-side weekly history sparklines"
```

---

## Task 5: Start + end overlays reskin

**Files:** Modify `the-feed.html` (overlay markup + `buildStart`, `endGame` styling, CSS).

- [ ] **Step 1: Restyle the start overlay as a "create account" sheet**

Keep ids `#startOverlay,#nameInput,#nichegrid,#homegrid,#startBtn` and the `buildStart` wiring. Restyle to Sticker Feed (sheet card, sticker pickers). In `buildStart`, swap the niche/platform `${n.emoji}`/`${p.emoji}` for bespoke icons where a glyph exists (platforms → `icon(PLAT_ICON[k],'big',PLATFORMS[k].color)`; niches keep their emoji — niche icons are out of the ~19-glyph scope). Keep `.pick.sel` selection behavior.

- [ ] **Step 2: Restyle the end overlay as a "year in review" card**

Keep ids `#endOverlay,#endEmoji,#endKicker,#endTitle,#endBlurb,#endLesson,#endStats,#againBtn` and `endGame`'s bindings. Restyle to a wrapped/recap card. The Substack CTA target is unchanged (ending→essay link stays a separate, essay-blocked item).

- [ ] **Step 3: Verify**

Reload: the start sheet is in-skin and starts a game; drive a quick loss (e.g. force endings or play to bankruptcy) to see the end card; "Run it back" returns to start. No console errors.

- [ ] **Step 4: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: reskin start + end overlays into the Sticker Feed world"
```

---

## Task 6: Full-playthrough verification, mobile, docs

**Files:** Modify `the-feed-BACKLOG.md`.

- [ ] **Step 1: Engine untouched — tests still green**

```bash
node tools/the-feed-test.js; echo "exit=$?"
```
Expected: 58/58, exit 0 (we never touched `the-feed-engine.js`). If anything fails, a stray engine edit slipped in — revert it.

- [ ] **Step 2: Full playthrough + contract audit in the browser**

Open `/the-feed`. Play a full run (or several quick ones): start → many weeks with content/business moves, at least two events, a membership launch, a gear upgrade, reach an ending. Confirm across all four tabs:
- Float deltas fire over Bank/Rep/Stress and channel cards (anchor contract intact).
- Sound plays; mute persists across reload (`thefeed_muted`).
- No console errors at any point (`read_console_messages`).

- [ ] **Step 3: Mobile check**

`resize_window` to mobile (375×812): the column fills the width, the bottom tab bar is reachable and safe-area-aware, nothing overflows horizontally, and the header/meters sit above the content (the old stacking bug is gone). Screenshot for the record.

- [ ] **Step 4: Update the backlog**

In `the-feed-BACKLOG.md`, move sub-project **C** from "Next" to a shipped summary (Sticker Feed skin, four-tab app column, bespoke solid icon set, mobile fixed). Note the OpenMoji `CREDITS.md` line can now be deleted (per the backlog's own note). Leave the ending→essay item and the leaderboard defer intact. Update the opening three-sub-project line to reflect all of A/B/C shipped.

- [ ] **Step 5: Commit**

```bash
git add the-feed.html the-feed-BACKLOG.md
git commit -m "The Feed: sub-project C shipped — verified playthrough, mobile, backlog"
```

---

## Self-review notes (addressed)

- **Spec coverage:** §1 structure/skin/icons → Task 1; §2 tabs → Tasks 1–4; §3 event-as-DM → Task 3; §4 feed-as-notifications → Task 2; §5 contracts → called out + verified every task; §6 stats/sparklines (UI-side) → Task 4; §7 overlays → Task 5; §8 responsive → Task 6 Step 3; §9 scope guardrails honored (no engine edit — Task 6 Step 1 guards it); §10 files → only `the-feed.html` + backlog. No gaps.
- **Contract consistency:** `v-cash/v-rep/v-stress/b-stress/b-rep/v-band/v-rent/cc-<key>` preserved through the shell rewrite (Task 1 Step 4) and re-verified each task; engine API unchanged; `hist` is UI-only and never enters `S`.
- **Placeholder scan:** component CSS is authored-to-spec (§1 tokens), explicitly not a placeholder; all logic/DOM/icon/render code is given complete. No "TODO/handle later" steps.
- **Naming consistency:** `icon()`, `PLAT_ICON/ANGLE_ICON/BIZ_ICON`, `tab`, `switchTab`, `hist`, `snapshot`, `renderInbox/renderEventDM/renderStats/renderHomeWaiting` used identically across tasks; tab ids `tab-home/alerts/inbox/stats` and badge ids `badge-alerts/badge-inbox` consistent.
