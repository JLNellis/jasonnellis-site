# The Feed — Acts 2a (structure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give The Feed three legible acts with telegraphed transitions, a heavily expanded late-act event deck, and one platform-dependency seed→harvest arc — so the back half of a run stops playing like the front half — plus the clock-copy reposition.

**Architecture:** Content + structure on the existing engine, no economy/formula changes. Engine (`the-feed-engine.js`) gains a pure `act(S)` helper, ~11 new act-gated `EVENTS` cards, and one derived `concentrated` flag. Chrome (`the-feed.html`) gains a guaranteed act-transition beat (driven by `E.act(S)`, not the random event roll) and bumps `SAVE_VERSION` 1→2. The engine has real deterministic tests (`npm test`) and a balance sim (`npm run sim`), so engine work is TDD; chrome work is browser-verified (the game's inline IIFE has no unit harness — same testing model as the mid-run-save plan).

**Tech Stack:** Vanilla JS (engine is UMD, pure; game is one inline IIFE), Node for `npm test` / `npm run sim`, Eleventy for the copy files.

**Testing model (read first):**
- **Engine changes are TDD:** write a failing case in `tools/the-feed-test.js`, run `npm test`, implement, pass. Every deck/flag change also reruns `npm run sim` (seeds 7/42/123) and must keep **6/6 targets** green (baseline: 71/71 tests, 6/6 targets).
- **`npm test` does NOT cover `the-feed.html`.** After every task that edits the game file, load `http://localhost:8080/the-feed.html` and confirm the IIFE ran (`document.querySelectorAll('#nichegrid .pick').length === 6`) with no console errors. Game internals are IIFE-scoped — verify observable behavior, never `typeof` in the console (see the mid-run-save plan for the full gotcha).
- **Local preview:** served at `http://localhost:8080/the-feed.html` via the `site` launch config; use the `.html` URL (clean URLs are Netlify-only).

**Deck authoring is controller work.** The new cards' *copy* is the product's voice — draft and refine them directly with Jason's edits, do NOT delegate card text to a cheap implementer subagent. The mechanical shell of each card (id, gating, choice `t` tags, `apply` effects) is fully specified here and is what the tests and sim exercise; the strings are drafts for Jason.

---

## File structure

- **`the-feed-engine.js`** — `act(S)` + `ACTS` export; `concentrated` flag in `settleWeek`; ~11 new `EVENTS` cards (incl. the `platform-turns` arc card). No `CONFIG` economy knobs change.
- **`tools/the-feed-test.js`** — new deterministic cases (act boundaries; concentrated flag; platform-turns gating/effect; new-card phase gating + non-repeat).
- **`tools/the-feed-sim.js`** — no logic change expected; rerun to keep 6/6.
- **`the-feed.html`** — transition-beat overlay + `beatsSeen` UI state (saved); `SAVE_VERSION` 1→2; clock copy (4 surfaces).
- **`tools.njk`**, **`tool-index/the-feed.md`** — clock copy.
- **`the-feed-BACKLOG.md`** — "Acts 2a shipped" note.

---

### Task 0: Baseline

**Files:** none (checkpoint).

- [ ] **Step 1:** Run `npm test` → expect `71/71 passed`. Run `npm run sim` → expect `6/6 targets met`. Record both; every later engine task must keep them green (test count grows).
- [ ] **Step 2:** `preview_start {name:"site"}`, navigate `http://localhost:8080/the-feed.html`, confirm the start overlay renders and `read_console_messages {onlyErrors:true}` is clean.

---

### Task 1: `act(S)` helper + `ACTS` export (engine, TDD)

**Files:**
- Modify: `the-feed-engine.js` (add helper near `CONFIG.phases` usage; export in the return object)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write the failing test**

Add to `tools/the-feed-test.js` (follow the file's existing `test('name', () => {...})` style; use `E.newState` and set `S.week`):

```js
test('act(S): 1–17 → act 1, 18–35 → act 2, 36–52 → act 3', () => {
  const S = E.newState('gaming', 'longform');
  const at = w => { S.week = w; return E.act(S); };
  assert.equal(at(1), 1); assert.equal(at(17), 1);
  assert.equal(at(18), 2); assert.equal(at(35), 2);
  assert.equal(at(36), 3); assert.equal(at(52), 3);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test`
Expected: FAIL — `E.act is not a function`.

- [ ] **Step 3: Implement**

In `the-feed-engine.js`, after the `platTier` helpers (near line 282), add:

```js
  // Acts: the run's three chapters, cut on the phase boundaries that already exist.
  // 1 "Nobody's watching" (≤earlyEnd) · 2 "The business" (≤midEnd) · 3 "The ceiling".
  const ACTS = { 1: 'Nobody’s watching', 2: 'The business', 3: 'The ceiling' };
  function act(S) { const p = CONFIG.phases; return S.week <= p.earlyEnd ? 1 : S.week <= p.midEnd ? 2 : 3; }
```

Add `ACTS, act,` to the returned object (near `CONFIG, NICHES, ...` at the end).

- [ ] **Step 4: Run tests → PASS**

Run: `npm test` → expect the new test green, total `72/72`.

- [ ] **Step 5: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: add act(S) helper + ACTS labels

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `SAVE_VERSION` → 2 + `beatsSeen` in the save (chrome, browser-verified)

**Files:**
- Modify: `the-feed.html` (`SAVE_VERSION` const; a `beatsSeen` UI var; `saveRun`/`resumeGame`/`newGame`)

- [ ] **Step 1: Bump the version**

Find `const SAVE_KEY = 'thefeed_save', SAVE_VERSION = 1;` and change `1` to `2`.

- [ ] **Step 2: Add the `beatsSeen` UI var**

Near the other UI-state `let`s (~L786–793), add:

```js
  let beatsSeen = [];   // UI-only: acts whose transition beat has already shown this run (persisted)
```

- [ ] **Step 3: Persist and restore it**

In `saveRun()`, add `beatsSeen` to the `ui` object:

```js
      JSON.stringify({ v:SAVE_VERSION, ts:Date.now(), S, ui:{ hist, postLog, lastRecap, run, beatsSeen } })); }catch(e){} }
```

In `resumeGame(saved)`, restore it (after the `lastRecap` line):

```js
    beatsSeen = saved.ui.beatsSeen || [];
```

In `newGame(...)`, reset it where the other UI arrays reset (the `hist = []; ... postLog = {};` line):

```js
    hist = []; lastRecap = null; weekLog = []; queue = []; resolving = false; postLog = {}; beatsSeen = []; snapshot(); tab = 'home';
```

- [ ] **Step 4: Verify (browser)**

Reload `http://localhost:8080/the-feed.html`. In console:
```js
// a v1 save must now be rejected (version gate):
localStorage.setItem('thefeed_save', JSON.stringify({v:1, ts:Date.now(), S:{over:false,week:5,niche:'gaming',name:'old'}, ui:{run:{}}}));
```
Reload → expect: **no Continue button** (v1 discarded), IIFE ran (`#nichegrid .pick` length 6), no console errors. Then start a run, end a week, and confirm the save now carries the field:
```js
JSON.parse(localStorage.thefeed_save).ui.beatsSeen   // → []
JSON.parse(localStorage.thefeed_save).v               // → 2
```

- [ ] **Step 5: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: bump SAVE_VERSION to 2, persist act-transition beats

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Act-transition beat overlay (chrome, browser-verified)

**Files:**
- Modify: `the-feed.html` (overlay markup + CSS; `showBeat()`; hook in `advance()`)

- [ ] **Step 1: Add the beat overlay markup**

Near the other overlays (`#startOverlay`/`#endOverlay`), add a hidden overlay:

```html
<div class="overlay hidden" id="beatOverlay">
  <div class="card beat">
    <div class="kick" id="beatKick"></div>
    <h1 id="beatTitle"></h1>
    <p class="lede" id="beatText"></p>
    <button class="btn primary" id="beatBtn" style="width:100%">Keep going →</button>
  </div>
</div>
```

- [ ] **Step 2: Add the beat copy + show function**

In the script, add the authored beats and a `showBeat`:

```js
  // Act-transition beats: shown once when the run crosses into act 2 and act 3. Chrome, not an
  // engine event — driven by E.act(S) so it can't be missed by the random event roll.
  const BEATS = {
    2: { kick: 'Act II · The business', title: 'This is a job now.',
         text: 'Four months in. The hobby has overhead — a payroll, a tax bill, a landlord who doesn’t watch your videos. The numbers stopped being a scoreboard and started being a budget.' },
    3: { kick: 'Act III · The ceiling', title: 'The easy growth is behind you.',
         text: 'Eight months in. The audience knows exactly what it wants from you, the algorithm has opinions, and every choice from here costs something. This is where you find out what kind of creator you became.' },
  };
  function showBeat(a) {
    const b = BEATS[a]; if (!b) return;
    $('beatKick').textContent = b.kick; $('beatTitle').textContent = b.title; $('beatText').textContent = b.text;
    openClose($('beatOverlay'), true);
  }
  $('beatBtn').onclick = () => openClose($('beatOverlay'), false);
```

- [ ] **Step 3: Hook the act crossing in `advance()`**

`advance()` calls `E.advanceWeek(S)` early (the week ticks) then later renders. Capture the act before the tick and compare after. Change the head of `advance()`:

```js
  function advance(){ tab='home'; weekLog=[]; queue=[]; resolving=false; bizMoreOpen=false;
    const actBefore = E.act(S);
    E.advanceWeek(S);
```

and after the normal `snapshot(); computeRecap(); S.phase='play'; E.buildHand(S); render();` line, before the scroll-reset, add:

```js
    const actNow = E.act(S);
    if(actNow > actBefore && !beatsSeen.includes(actNow)){ beatsSeen.push(actNow); showBeat(actNow); }
```

(Placing it after `render()` means the beat overlays the freshly-rendered new week. `saveRun()` at the end of `advance()` then persists the updated `beatsSeen`.)

- [ ] **Step 4: Add minimal CSS**

Reuse existing overlay/card styling; add only what the beat needs (a `.card.beat{max-width:520px}` if the default is wider). Match the start/end overlays' look.

- [ ] **Step 5: Verify (browser)**

Play (or fast-forward) to the week 17→18 crossing → the **Act II** beat overlays once; dismiss; reload → it does **not** show again (`beatsSeen` persisted). Continue to 35→36 → the **Act III** beat shows once. IIFE clean, no console errors. Check mobile (375px) + desktop layout of the overlay.
_Tip for fast verification without playing 18 weeks: in console, drive `endWeekBtn` in a loop, or (engine internals aside) confirm the crossing logic by watching `JSON.parse(localStorage.thefeed_save).ui.beatsSeen` grow to `[2]` then `[2,3]`._

- [ ] **Step 6: Commit**

```bash
git add the-feed.html
git commit -m "The Feed: telegraphed act-transition beats (Act II / Act III)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Platform-dependency arc — `concentrated` flag + `platform-turns` card (engine, TDD)

**Files:**
- Modify: `the-feed-engine.js` (`settleWeek` sets the flag; new card in `EVENTS`)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Failing tests**

```js
test('concentrated flag: set in act 2+ when the top platform holds ≥65% of a real audience', () => {
  const S = E.newState('gaming', 'longform'); S.week = 20;
  S.plats.longform.followers = 9000; S.plats.shortform.active = true; S.plats.shortform.followers = 1000;
  E.settleWeek(S);
  assert.ok(S.flags.concentrated, 'concentrated should be set');
});
test('platform-turns: eligible only in act 3 with a real top channel', () => {
  const S = E.newState('gaming', 'longform'); S.plats.longform.followers = 9000; S.flags.concentrated = 10;
  const card = E.EVENTS.find(e => e.id === 'platform-turns');
  S.week = 20; assert.ok(!(card.minWeek == null || S.week >= card.minWeek), 'not before act 3');
  S.week = 40; assert.ok(card.cond(S) && S.week >= card.minWeek, 'eligible in act 3');
});
```

- [ ] **Step 2: Run → FAIL** (`concentrated` unset; card not found).

- [ ] **Step 3: Implement the flag**

In `settleWeek`, just before `return log;`, add:

```js
    // seed for the platform-dependency arc: a creator who bet on one channel by the business act
    if (act(S) >= 2 && !S.flags.concentrated) {
      const tot = totalFollowers(S), top = strongest(S);
      if (tot > 3000 && top && top.followers / tot >= 0.65) S.flags.concentrated = S.week;
    }
```

- [ ] **Step 4: Implement the card** (add to `EVENTS`)

```js
    { id: 'platform-turns', kind: 'hostile', emoji: '🪤', title: 'The platform you built on turned on you.', badge: 'Platform risk', minWeek: 36,
      cond: S => { const t = strongest(S); return t && t.followers > 5000; },
      priority: S => !!S.flags.concentrated,   // the concentrated creator is the one this comes for
      text: 'An algorithm change, a policy sweep, a reach collapse — take your pick. The channel you bet everything on just stopped putting your work in front of the people who follow you.',
      choices: [
        { t: 'repair', ci: '🌱', label: 'Lean on what you own', desc: 'The newsletter, the members — the audience they can’t take back.', stakes: 'an owned audience softens it; concentrated + rented → a big reach hit',
          apply: S => { const owned = S.members > 0 || S.plats.writing.active; const conc = !!S.flags.concentrated; addStress(S, 4);
            const lo = owned ? .01 : (conc ? .06 : .03), hi = owned ? .03 : (conc ? .12 : .06);
            return hurt(S, '🪤', owned ? 'The platform buried you, but the people on your own list still turned up. You had a floor.' : 'You had nowhere else to send them, and the reach just… left.', lo, hi); } },
        { t: 'escalate', ci: '📣', label: 'Fight the change publicly', desc: 'Make noise, demand answers.', stakes: 'a reach hit either way · 40%: sympathy followers · else rep −2–6',
          apply: S => { const conc = !!S.flags.concentrated; const lo = conc ? .05 : .03, hi = conc ? .10 : .05;
            const log = hurt(S, '📣', 'You posted the callout everywhere that still worked.', lo, hi);
            if (chance(.4)) { const p = strongest(S); const g = Math.round(rnd(800, 2600)); p.followers += g; S.newFollowers += g; log.feed.push({ emoji:'🫶', text:`+${fmt(g)} showed up on your side.`, kind:'good' }); log.floats.push({ anchor:'plat:'+p.key, text:'+'+fmt(g), tone:'gain' }); }
            else { const r = repHit(S, 2, 6); log.feed.push({ emoji:'🙄', text:`Some read it as sour grapes. Rep −${r}.`, kind:'bad' }); }
            return log; } },
      ] },
```

- [ ] **Step 5: Run tests → PASS**, then **`npm run sim`** (seeds 7/42/123) → **6/6**. The late follower hit can nudge the Optimizer/Diversifier ending mix — if any target fails, tune the `hurt` fractions (the `.06/.12` concentrated band first) down until green. Record the before/after ending mix.

- [ ] **Step 6: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: platform-dependency arc (concentrated flag + platform-turns)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Late-act deck expansion (engine data — CONTROLLER-AUTHORED, Jason-reviewed)

**Files:**
- Modify: `the-feed-engine.js` (`EVENTS`)
- Test: `tools/the-feed-test.js`

This is the writing task. Add ~9 new act-gated cards to `EVENTS`. Two are fully written below as the pattern; the rest are specified in the table and authored in the same shape and voice, drafted for Jason's edit. Every card uses only existing closure helpers (`fed`, `spend`, `gift`, `hurt`, `bite`, `repHit`, `addStress`, `clamp`, `rint`, `rnd`, `chance`, `strongest`, `activePlats`, `totalFollowers`, `fmt`, `money`) and follows the `EVENTS` shape (`id`, `kind`, `emoji`, `title`, `badge`, gating, `text`, `choices[]` with `t`/`ci`/`label`/`desc`/`stakes`/`apply`).

- [ ] **Step 1: Failing test (gating + non-repeat sanity for the new cards)**

```js
test('new act-gated cards: authored, act-3-weighted, phase-gated, unique ids', () => {
  const ids = ['audience-expectations','reinvent-or-coast','ceiling-plateau','format-fatigue',
    'scale-burnout','old-guard','growth-pressure','sponsor-control','legacy-question'];
  ids.forEach(id => {
    const c = E.EVENTS.find(e => e.id === id);
    assert.ok(c, `missing card ${id}`);
    assert.ok(c.choices.length >= 2 && c.choices.every(ch => ch.t && ch.stakes && typeof ch.apply === 'function'), `${id} malformed`);
  });
  // unique ids across the whole deck
  const all = E.EVENTS.map(e => e.id); assert.equal(all.length, new Set(all).size, 'duplicate event id');
});
```

- [ ] **Step 2: Run → FAIL** (cards missing).

- [ ] **Step 3: Add the two exemplar cards** (final-ish copy; Jason edits)

```js
    { id: 'audience-expectations', kind: 'neutral', emoji: '🪞', title: 'Your audience decided who you are.', badge: 'Expectations', minWeek: 36,
      text: 'Every time you try something new, the comments ask for the old thing. They love a version of you that you finished being months ago.',
      choices: [
        { t: 'neutral', ci: '🔁', label: 'Give them the version they subscribed for', desc: 'Serve the hits. Stay in the lane.', stakes: 'heat +8 on your top channel · rep −1–3 (you know it’s a cage)',
          apply: S => { const p = strongest(S); p.heat = clamp(p.heat + 8, 0, 100); const r = repHit(S, 1, 3); const log = fed('🪞', `You made the thing they wanted. It did fine. You felt like a tribute act to yourself. Rep −${r}.`, ''); log.bump.push(p.key); return log; } },
        { t: 'escalate', ci: '🎨', label: 'Make what you actually want', desc: 'Follow the work, not the room.', stakes: '50%: rep +6–12, they grow with you · else −2–5% of your biggest channel',
          apply: S => { if (chance(.5)) { S.rep = clamp(S.rep + rint(6, 12), 0, 100); return fed('🎨', 'You made the thing you wanted. Enough of them came with you; the rest were quietly replaced by better ones.', 'big'); } S.flags.pivoted = S.week; return hurt(S, '🥶', 'You made the thing you wanted and the room went cold. The regulars felt abandoned and said so.', .02, .05); } },
      ] },
    { id: 'reinvent-or-coast', kind: 'neutral', emoji: '🛞', title: 'You could coast from here.', badge: 'Fork', minWeek: 40,
      text: 'You have a formula that works. You could run it to the end of the year on autopilot — or bet the momentum on becoming something else while you still have momentum to bet.',
      choices: [
        { t: 'repair', ci: '😌', label: 'Coast the formula', desc: 'Bank the wins, take your foot off.', stakes: '−8 stress · heat −6 everywhere (the slow fade)',
          apply: S => { addStress(S, -8); activePlats(S).forEach(p => p.heat = clamp(p.heat - 6, 0, 100)); return fed('😌', 'You stopped pushing. The numbers held, then softened. Nobody could name the week you started phoning it in.', ''); } },
        { t: 'escalate', ci: '🎲', label: 'Bet on a reinvention', desc: 'Blow it up while it’s still your choice.', stakes: '45%: +3K–9K followers, heat +18 · else rep −3–7 and a stress spike',
          apply: S => { if (chance(.45)) { const p = strongest(S); const g = Math.round(rnd(3000, 9000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 18, 0, 100); const log = fed('🎲', `The reinvention landed. +${fmt(g)} came for the new thing, and you bought another year of being interesting.`, 'big'); log.floats.push({ anchor:'plat:'+p.key, text:'+'+fmt(g), tone:'hit' }); log.bump.push(p.key); return log; } const r = repHit(S, 3, 7); addStress(S, 10); return fed('🌫️', `The new direction confused everyone, you included. It didn’t take. Rep −${r}, and you’re tired.`, 'bad'); } },
      ] },
```

- [ ] **Step 4: Author the remaining cards from this table** (same shape/voice; draft, Jason edits). Keep effect magnitudes in the ranges shown so the sim stays balanceable:

| id | gating | theme / title seed | choice A (tag) | choice B (tag) | effect envelope |
|---|---|---|---|---|---|
| `ceiling-plateau` | minWeek 36 | growth flatlined — "The number stopped moving." | double down on what works (repair): heat +6 top, +2 stress | chase a new format (escalate): 50% +1.5–5K & heat, else −6 heat everywhere | followers ≤5K swing |
| `format-fatigue` | minWeek 36 | your signature format is tired | retire it (escalate): 45% rep+ / +followers, else −2–4% | keep milking (neutral): small heat, fatigue-flavored, no gain | ≤4% follower risk |
| `scale-burnout` | minWeek 36, cond stress≥50 | success is heavier than expected | delegate/rest (repair): −20 stress · −6 heat | push through (escalate): +12 stress · heat +5, `pushedThrough` flag (feeds existing `sleepless` echo) | stress only |
| `old-guard` | minWeek 40 | a younger creator is the hot thing now | collab/mentor (repair): +800–2.5K, rep +2–5 | compete hard (escalate): +5 stress, 50% heat / else rep −2–6 | ≤2.5K gain |
| `growth-pressure` | minWeek 18, maxWeek 35 | everyone expects you to keep growing | sustainable pace (repair): −6 stress, rep +1–3 | chase the number (escalate): +10 stress, heat +8 everywhere | stress/heat |
| `sponsor-control` | minWeek 18, maxWeek 35, cond deals≥1 | a sponsor wants creative control | hold the line (repair): smaller deal $300+1% foll, rep +1–3 | give them control (escalate): $600+2% foll, rep −4–9, `soldOut`-adjacent (do NOT set soldOut) | cash vs rep |
| `legacy-question` | minWeek 44 | "what is all this for?" | double down on meaning (repair): rep +3–8, −8 stress | cash-maximize the year (escalate): +$800+2% foll, rep −3–7 | cash vs rep |

(Cut to ~9 total if two feel redundant in playtest; the table is the ceiling, not a quota. `scale-burnout` deliberately reuses the existing `pushedThrough` flag so it feeds the shipped `sleepless` echo — a free seed→harvest link.)

- [ ] **Step 5: Run `npm test`** → the new gating test passes; total climbs. Then **`npm run sim`** (seeds 7/42/123) → **6/6**. New cards add net follower/rep/cash swings; tune the aggressive ones until targets hold (watch: Optimizer GOAT %, Sustainable Legend %, Grinder burnout week, the ≤85%-into-one-ending target). Record before/after ending mix in the commit body.

- [ ] **Step 6: Surface drafts to Jason** for a voice pass (send the card copy or point at the diff); fold edits back in; re-run `npm test` + `npm run sim` to confirm still green after copy edits (copy edits shouldn't move numbers, but confirm).

- [ ] **Step 7: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: late-act deck expansion (Act II/III cards)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Clock reposition (chrome/content, browser + build verified)

**Files:**
- Modify: `the-feed.html` (meta :13, og :17, twitter :25, kicker :688), `tools.njk` (:86), `tool-index/the-feed.md` (`time`)

- [ ] **Step 1: Edit the six surfaces**
- `the-feed.html:13` `content="A year as a content creator, in ten minutes. ...` → `in about twenty minutes.`
- `the-feed.html:17` and `:25` `in about ten minutes` → `in about twenty minutes`
- `the-feed.html:688` kicker `A year as a creator, in about ten minutes` → `...in about twenty minutes`
- `tools.njk:86` `makes that felt in ten minutes` → `makes that felt in about twenty minutes`
- `tool-index/the-feed.md` front matter `time: "About 10 min"` → `time: "About 20 min"`

- [ ] **Step 2: Verify**

`npm run build` → clean. Navigate `http://localhost:8080/the-feed.html`, confirm the kicker reads "about twenty minutes"; navigate `http://localhost:8080/experiments` (or `/tools.html`) and confirm the card time reads "About 20 min". No console errors.

- [ ] **Step 3: Commit**

```bash
git add the-feed.html tools.njk tool-index/the-feed.md
git commit -m "The Feed: reposition the clock copy to ~20 minutes (Acts adds the length)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Backlog note + final regression

**Files:**
- Modify: `the-feed-BACKLOG.md`

- [ ] **Step 1:** Add a "Shipped: Acts 2a (structure, transitions, late-act decks)" section summarizing: `act(S)`/`ACTS`, the two transition beats (chrome, `beatsSeen` saved, `SAVE_VERSION` 2), the ~11 new act-gated cards, the `concentrated`→`platform-turns` arc, the clock reposition; note 2b (the exit decision) is next.
- [ ] **Step 2: Final guards** — `npm test` all green (record the new total), `npm run sim` 6/6, and a browser load of `http://localhost:8080/the-feed.html` with no console errors + the two beats firing across a run.
- [ ] **Step 3:** `preview_stop` the `site` server. Commit the backlog note.

---

## Self-review notes (author checklist — done at write time)

- **Spec coverage:** act framework (T1) · transition beats + save-shape/version (T2, T3) · late-act deck expansion (T5) · platform-dependency arc (T4) · clock reposition (T6). The spec's SAVE_VERSION bump is T2; the "no economy flips" constraint holds (no `CONFIG` knob is edited in any task). 2b (exit) is correctly absent.
- **Name/type consistency:** `act`/`ACTS`, `SAVE_VERSION` (=2), `beatsSeen`, `showBeat`/`BEATS`, `concentrated`, `platform-turns` used identically across tasks; new-card ids in T4/T5 match the T5 gating test list.
- **No placeholders in mechanism:** T1–T4, T6 carry complete code. T5's card *copy* is a deliberate controller-authored draft (voice is the product); each card's mechanical shell and effect envelope is fully specified (2 exemplars in full + a per-card table), which is what the test and sim exercise.
