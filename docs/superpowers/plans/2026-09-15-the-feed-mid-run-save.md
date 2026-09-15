# The Feed — mid-run save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an in-progress run of The Feed to `localStorage` at every week boundary, offer **Continue** on the start screen, and clear the save when the run ends.

**Architecture:** All changes are inline JS in `the-feed.html` (the game is a standalone page; its UI logic is inline, styled from the site's Bolt OS tokens), plus one clause in `privacy.html`. A single `localStorage.thefeed_save` blob holds the engine state `S` (flat JSON, already carries `feed`/`hand`/`flags`/`phase`/`event`) plus the four UI-only arrays that can't be recomputed (`hist`, `postLog`, `lastRecap`, `run`). A `SAVE_VERSION` integer gates the blob so later sub-projects (Acts, Team) that change `S`'s shape can retire old saves cleanly. The engine (`the-feed-engine.js`), the sim, and the tests are **not** touched.

**Tech Stack:** Vanilla ES5/ES6 in an inline `<script>`, `localStorage`, no build step for the game file (Eleventy passthrough). Node for the regression guard (`npm test`).

**Testing model (read this first):** This repo has **no automated UI-test harness** for `the-feed.html` — every prior chrome-only change was verified in the browser preview, with `npm test` (the engine tests, currently 71/71) as the regression guard proving the engine was untouched. This plan follows that established pattern: each task states the exact browser check and expected result, and the final task confirms `npm test` is unchanged. Do **not** add a jsdom/Jest harness — it is out of scope and against the project's minimal-maintenance preference.

**⚠️ `npm test` does NOT cover `the-feed.html`.** The game's inline script is never parsed by the tests, so a syntax error there (a stray brace, an unclosed function) passes `npm test` and still breaks the whole game. After **every** task that edits `the-feed.html`, you MUST load `http://localhost:8080/the-feed.html` in the browser and confirm the game initializes with **no console errors** (a quick proxy: `document.querySelectorAll('#nichegrid .pick').length === 6`, which is only true if the IIFE ran to completion). Never rely on `npm test` alone to prove a `the-feed.html` change is safe.

**The IIFE scope gotcha for verification:** everything in the game is inside one IIFE, so its functions/consts (`saveRun`, `SAVE_VERSION`, `newGame`, …) are **not** reachable from the console — only `FeedEngine` and `localStorage` are. Verify **observable behavior** (a `localStorage.thefeed_save` blob appears; the Continue button renders; the game starts), never `typeof saveRun` in the console.

**Local preview:** `the-feed.html` is served at `http://localhost:8080/the-feed.html` by the `site` launch config (`npm run serve`). Clean URLs (`/the-feed`) are Netlify-only and do **not** work on the dev server — always use the `.html` URL locally. Start it with `preview_start {name:"site"}`, then `navigate` to that URL.

---

## File structure

- **`the-feed.html`** — all save/restore logic (helpers, `advance()`/`newGame()`/`endGame()` hooks, the Continue button, `resumeGame()`, the New-run guard). Inline `<script>`, ~L678–1510.
- **`privacy.html`** — one added clause in the "Storage in your browser" section (~L140). Passthrough copy; no build change.

No new files. No new `<script src>`. No engine/sim/test changes.

---

### Task 0: Baseline regression guard

**Files:** none (checkpoint only).

- [ ] **Step 1: Confirm the engine tests pass before any change**

Run: `npm test`
Expected: ends with a passing summary, `71/71` (or the repo's current count). Record the number — the final task must match it, proving the engine was never touched.

- [ ] **Step 2: Confirm the dev server serves the game**

Start the preview server (`preview_start {name:"site"}`), then `navigate` to `http://localhost:8080/the-feed.html`.
Expected: the start overlay renders (title "Your first video is up…"), and `read_console_messages` shows no errors.

---

### Task 1: Save/load/clear helpers + version constant

**Files:**
- Modify: `the-feed.html` (add helpers after the engine-bound convenience wrappers at ~L838–842, immediately before `function newGame`)

- [ ] **Step 1: Add the save helpers**

Insert this block on its own lines directly **before** `function newGame(name, niche, home){` (~L844):

```js
  // ---------- mid-run save (on-device only; see /privacy) ----------
  // Persist the run at each week boundary so a closed tab never loses it. S is flat
  // JSON (the engine builds no functions into it) and already carries feed / hand /
  // flags / phase / event; the four UI arrays below can't be recomputed from S.
  // SAVE_VERSION gates the blob: a later build that changes S's shape bumps it, and
  // an older save then fails validSave() and is discarded — no migration code.
  const SAVE_KEY = 'thefeed_save', SAVE_VERSION = 1;
  function saveRun(){ if(!S) return; try{ localStorage.setItem(SAVE_KEY,
    JSON.stringify({ v:SAVE_VERSION, ts:Date.now(), S, ui:{ hist, postLog, lastRecap, run } })); }catch(e){} }
  function validSave(d){ return !!(d && d.v===SAVE_VERSION && d.S && d.S.over===false
    && typeof d.S.week==='number' && d.S.week>=1 && d.S.week<=E.CONFIG.years && d.ui); }
  function loadRun(){ try{ const raw=localStorage.getItem(SAVE_KEY); if(!raw) return null;
    const d=JSON.parse(raw); return validSave(d)?d:null; }catch(e){ return null; } }
  function clearRun(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }
```

- [ ] **Step 2: Verify the new code parses and the game still initializes**

The helpers are inside the IIFE, so you CANNOT check `typeof saveRun` from the console (see the header note). Instead, prove the inline script still parses and runs end to end. Reload `http://localhost:8080/the-feed.html`, then in the console:

```js
({ noSaveYet: localStorage.getItem('thefeed_save'), nicheTiles: document.querySelectorAll('#nichegrid .pick').length, startBtn: !!document.getElementById('startBtn') })
```

Expected: `{ noSaveYet: null, nicheTiles: 6, startBtn: true }`. Six niche tiles means `buildStart()` (near the end of the IIFE) ran, i.e. no syntax error. `read_console_messages {onlyErrors:true}` shows **no** errors — a stray brace would surface here as an "Unexpected token" SyntaxError even though `npm test` passed.

- [ ] **Step 3: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: add mid-run save helpers + SAVE_VERSION

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Write the save at each week boundary

**Files:**
- Modify: `the-feed.html` — `advance()` (~L947–952)

- [ ] **Step 1: Call saveRun() at the end of advance()**

`advance()` currently ends with the scroll-reset `try/catch`. On the ending path it `return`s early (after `endGame`), so adding the save at the very end persists **only** non-ending weeks. Change:

```js
    try{ window.scrollTo(0,0); document.querySelectorAll('.tabbody, #tab-home, #tab-alerts, #stagebody').forEach(e=>{ if(e) e.scrollTop=0; }); }catch(e){} }
```

to:

```js
    try{ window.scrollTo(0,0); document.querySelectorAll('.tabbody, #tab-home, #tab-alerts, #stagebody').forEach(e=>{ if(e) e.scrollTop=0; }); }catch(e){}
    saveRun();   // persist the clean start of this week (the ending path returned earlier)
  }
```

**Critical:** the closing `}` of `advance()` must be on its **own line**, NOT at the end of the `//` comment — a `}` after `//` is commented out and breaks the whole inline script. (`npm test` will NOT catch this; only a browser load will — see Step 2.)

- [ ] **Step 2: Verify a run is saved with the right week**

Reload the page, start a run (any niche/platform, "Go live"), and end two weeks (queue a card or two, click "End the week", answer any event). In the console:

```js
(()=>{const d=JSON.parse(localStorage.thefeed_save); return [d.v, d.S.week, d.S.over, !!d.ui.run, !!d.ui.hist];})()
```

Expected: `[1, 3, false, true, true]` (after ending weeks 1 and 2, the saved clean-start week is 3; `over` false; `ui.run` and `ui.hist` present).

- [ ] **Step 3: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: save the run on every advance()

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Clear the save on ending and on a fresh run

**Files:**
- Modify: `the-feed.html` — `endGame()` (~L1409) and `newGame()` (~L844)

- [ ] **Step 1: Clear on ending**

Change the start of `endGame` (L1409) from:

```js
  function endGame(key){ S.phase='end'; SFX.play(['goat','star','legend'].indexOf(key)>=0?'win':'lose'); const e=E.endingText(S,key);
```

to (add `clearRun();` first — the run is over, its resume blob goes; the endings gallery persists under its own key):

```js
  function endGame(key){ clearRun(); S.phase='end'; SFX.play(['goat','star','legend'].indexOf(key)>=0?'win':'lose'); const e=E.endingText(S,key);
```

- [ ] **Step 2: Clear on a new run (belt-and-braces)**

Change the start of `newGame` (L844–846) from:

```js
  function newGame(name, niche, home){
    SFX.unlock(); SFX.play('level');
    S = E.newState(niche, home); S.name = name || 'untitled'; evtThisWeek = false; closeTeam(); closeChanPicker();
```

to:

```js
  function newGame(name, niche, home){
    SFX.unlock(); SFX.play('level'); clearRun();
    S = E.newState(niche, home); S.name = name || 'untitled'; evtThisWeek = false; closeTeam(); closeChanPicker();
```

- [ ] **Step 3: Verify both clear paths (via the UI — internals aren't console-reachable)**

`newGame`/`endGame` are inside the IIFE, so drive them through the UI, not the console.
- **fresh-run clears:** reload, start a run, end one week so `localStorage.thefeed_save` is present (confirm in console). Then reload, and on the start screen click a niche + **Go live** to start another run. Immediately check the console: `localStorage.getItem('thefeed_save')` is `null` (newGame's `clearRun()` fired; a new save won't be written until the first week ends).
- **ending clears:** the cleanest way to reach an ending on demand is to burn out — but that's slow. Instead confirm the code path by reading `endGame` in `the-feed.html` and checking `clearRun();` is its first statement; then, opportunistically, when any real playthrough reaches an ending, confirm `localStorage.thefeed_save` is `null` on the end screen. `read_console_messages {onlyErrors:true}` shows no errors throughout.

- [ ] **Step 4: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: clear the save on ending and on a fresh run

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Continue button + resumeGame()

**Files:**
- Modify: `the-feed.html` — add `resumeGame()` near `newGame` (~L853), add `renderContinue()` and call it inside `buildStart()` (~L1472), and call it again in the `againBtn` handler (~L1509)

- [ ] **Step 1: Add resumeGame()**

Insert this function directly **after** `newGame`'s closing `}` (i.e. after L853, before the `paintBackdrop` block at L855):

```js
  // Resume a saved run: rehydrate S + the four UI arrays, restore derived UI, close the overlay.
  // Does NOT re-fire the Plausible 'start' event (a resume is not a new run) and does NOT re-deal
  // the hand (S.hand was saved). Transient per-week UI (weekLog/queue/…) resets to a clean week.
  function resumeGame(saved){
    SFX.unlock();
    S = saved.S;
    hist = saved.ui.hist || []; postLog = saved.ui.postLog || {};
    lastRecap = saved.ui.lastRecap || null;
    run = saved.ui.run || { restWeeks:0, peakStress:Math.round(S.stress), events:0 };
    evtThisWeek = false; weekLog = []; queue = []; resolving = false; bizMoreOpen = false; tab = 'home';
    closeTeam(); closeChanPicker(); paintBackdrop(); render();
    openClose($('startOverlay'), false);
  }
```

- [ ] **Step 2: Add renderContinue() and call it from buildStart()**

Inside `buildStart()`, the last statements are the two `wireGroup(...)` calls (~L1470–1471). Add a `renderContinue();` call as the new last line of `buildStart()`, then define `renderContinue()` immediately after `buildStart`'s closing `}` (before the `buildStart();` invocation at L1473). Result:

```js
    wireGroup($('nichegrid'), k=>{ selNiche=k; });
    wireGroup($('homegrid'), k=>{ selHome=k; });
    renderContinue();
  }
  // If a valid in-progress run exists, prepend a Continue button to the start form as the
  // primary action. Removes any prior button first, so it stays correct across reopens.
  function renderContinue(){
    const form = document.querySelector('#startOverlay .intro-form'); if(!form) return;
    const prev = $('continueBtn'); if(prev) prev.remove();
    const saved = loadRun(); if(!saved) return;
    const b = document.createElement('button');
    b.id = 'continueBtn'; b.type = 'button'; b.className = 'btn primary';
    b.style.width = '100%'; b.style.marginBottom = '14px';
    b.textContent = `Continue — ${saved.S.name} · ${NICHES[saved.S.niche].label} · week ${saved.S.week}`;
    b.onclick = ()=>resumeGame(saved);
    form.insertBefore(b, form.firstChild);
  }
  buildStart();
```

(The existing `buildStart();` call stays; it now also renders Continue on load.)

- [ ] **Step 3: Re-evaluate Continue when the start overlay reopens after an ending**

The `againBtn` handler (L1509) reopens the start overlay. Add `renderContinue();` so a just-cleared save removes the stale button. Change:

```js
  $('againBtn').onclick=()=>{ openClose($('endOverlay'),false); openClose($('startOverlay'),true); $('nameInput').value=''; };
```

to:

```js
  $('againBtn').onclick=()=>{ openClose($('endOverlay'),false); openClose($('startOverlay'),true); $('nameInput').value=''; renderContinue(); };
```

- [ ] **Step 4: Verify Continue restores a run faithfully**

Reload, start a run, play ~4 weeks (take a brand deal, ride at least one hit so followers, cash, rep and the trend charts have moved), note the week number and follower count on screen. Reload the page. Expected: the start overlay now shows a **Continue — {name} · {niche} · week N** button above the form. Click it. Expected: the game opens on week N with the same followers, cash, stress, rep; the trend sparklines, channel-card art, and the activity feed scrollback are all present; `read_console_messages` shows no errors.

- [ ] **Step 5: Verify corrupt and version-mismatched saves are ignored (no crash)**

In the console, then reload after each:

```js
localStorage.thefeed_save = 'garbage{{';        // corrupt
```
Reload → expected: no Continue button, no console error, fresh start overlay.

```js
localStorage.thefeed_save = JSON.stringify({v:999, S:{over:false,week:5}, ui:{}});  // future version
```
Reload → expected: no Continue button (rejected by the `v===SAVE_VERSION` check), no console error.

- [ ] **Step 6: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: Continue a saved run from the start screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Guard a new run against overwriting a save

**Files:**
- Modify: `the-feed.html` — `startBtn` click handler (~L1506–1507)

- [ ] **Step 1: Confirm before starting a new run over a save**

Change:

```js
  $('startBtn').onclick=()=>{ const nm=$('nameInput').value.trim()||pick(['midnight uploads','the daily grind','no filter','raw takes','after hours','main character']);
    newGame(nm, selNiche, selHome); };
```

to:

```js
  $('startBtn').onclick=()=>{
    const saved=loadRun();
    if(saved && !confirm(`Start a new run? Your saved run (week ${saved.S.week}) will be erased.`)) return;
    const nm=$('nameInput').value.trim()||pick(['midnight uploads','the daily grind','no filter','raw takes','after hours','main character']);
    newGame(nm, selNiche, selHome); };
```

(`newGame` already calls `clearRun()` from Task 3, so confirming erases the save.)

- [ ] **Step 2: Verify the guard both ways**

Reload, start a run, play a week so a save exists, reload (Continue now shows). Click a niche and **Go live** (not Continue). Expected: a confirm dialog "Start a new run? Your saved run (week N) will be erased." **Cancel** → still on the start overlay, and `localStorage.thefeed_save` still present (check in console). Click **Go live** again → **OK** → a fresh run starts and `localStorage.thefeed_save` is gone (a new one will be written after the first week).

- [ ] **Step 3: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: confirm before a new run overwrites a saved one

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Privacy clause

**Files:**
- Modify: `privacy.html` — "Storage in your browser" paragraph (~L140); check the date (~L78)

- [ ] **Step 1: Add the in-progress-game clause**

Change the paragraph at L140 from:

```html
        <p>The Feed and Burn Rate remember a few things between visits, such as the endings you have found, whether sound is muted and whether a result was unlocked. This lives in your browser's local storage, never leaves your device and is never sent to me. It is strictly necessary for the feature you chose to use, so it needs no consent. Clearing your browser's site data removes it.</p>
```

to:

```html
        <p>The Feed and Burn Rate remember a few things between visits, such as the endings you have found, an in-progress game so you can pick it up where you left off (cleared when the run ends), whether sound is muted and whether a result was unlocked. This lives in your browser's local storage, never leaves your device and is never sent to me. It is strictly necessary for the feature you chose to use, so it needs no consent. Clearing your browser's site data removes it.</p>
```

- [ ] **Step 2: Confirm the "Last updated" date**

Check L78. It reads `Last updated 15 September 2026`. If the code is shipping on that date (today), leave it. If it ships later, update the date to the ship date. No other date bump is needed.

- [ ] **Step 3: Verify the privacy page renders**

Run: `npm run build`
Expected: build succeeds (no Eleventy error). Then `navigate` to `http://localhost:8080/privacy.html` and confirm the "Storage in your browser" paragraph now mentions the in-progress game; `read_console_messages` shows no errors.

- [ ] **Step 4: Commit**

```bash
git add privacy.html
git commit -m "Privacy: note The Feed saves an in-progress run on-device

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Responsive check + final regression guard

**Files:** none (verification only).

- [ ] **Step 1: Start-overlay layout at phone and desktop width**

With a saved run present (play a week if needed), reload `http://localhost:8080/the-feed.html`. Use `resize_window {preset:"mobile"}` (375px) then `{preset:"desktop"}` (≥980px). Expected at both: the **Continue** button and the **Go live →** button sit full-width and legibly in the start form, nothing clipped or overlapping. Take a `screenshot` at each width as proof.

- [ ] **Step 2: Full manual pass of the spec's acceptance scenarios**

Confirm, in the browser, all of: (1) play → reload → Continue → correct week and stats; (2) reach an ending → reload → no Continue (endings gallery still shows the found ending); (3) New run over a save → confirm prompt → fresh; cancel → intact; (4) corrupt blob → reload → fresh, no crash; (5) future-version blob → reload → fresh, no crash. (These were each verified in earlier tasks; this is the consolidated pass.)

- [ ] **Step 3: Engine regression guard unchanged**

Run: `npm test`
Expected: the same pass count recorded in Task 0 (e.g. `71/71`). If it changed, the engine was touched by mistake — revert that and re-run.

- [ ] **Step 4: Stop the preview server**

`preview_stop` the `site` server.

---

## Self-review notes (author checklist — done at write time)

- **Spec coverage:** save blob shape (Task 1) · save-on-advance (Task 2) · clear-on-ending + fresh-run (Task 3) · Continue / resumeGame / version+corrupt robustness (Task 4) · New-run guard (Task 5) · privacy clause + date (Task 6) · responsive + regression (Task 7). The spec's "clock reposition deferred to Acts" is out of scope by design — no task, correctly.
- **Type/name consistency:** `SAVE_KEY`, `SAVE_VERSION`, `saveRun`, `loadRun`, `validSave`, `clearRun`, `resumeGame`, `renderContinue` are used with the same names across all tasks. The saved shape `{v, ts, S, ui:{hist, postLog, lastRecap, run}}` is written in Task 1 and read identically in Tasks 4/5.
- **No placeholders:** every code step shows the exact before/after; every verify step shows the exact console expression and expected value.
