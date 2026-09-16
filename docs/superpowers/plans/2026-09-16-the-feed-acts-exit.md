# The Feed — Acts 2b (the Act III exit decision) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guaranteed, single Act III exit decision (sell / go independent / keep climbing) that ends the run early with a *steered existing ending*, via a one-line `checkEndings` guard — completing Pillar 1 (Acts).

**Architecture:** Almost entirely engine (`the-feed-engine.js`), which has real `npm test` + `npm run sim` coverage, so this is TDD. A forced event pre-empt in `rollEvent` guarantees the exit at `CONFIG.exitWeek`; the exit's choices set `S.over`/`S.endKey`; a one-line guard at the top of `checkEndings` honors them. The sim's personas decline the exit (a `resolveEvent` special-case), so the 6 balance targets are untouched — no re-tuning. One small chrome line acknowledges the exit on the existing end screen.

**Tech Stack:** Vanilla JS (engine UMD, game inline IIFE), Node for `npm test` / `npm run sim`.

**Depends on:** Acts 2a (PR #2). **Build this branch off `main` after 2a has merged**, so the engine already has `act(S)` and the 2a deck. 2b touches neither of those, but its tests/sim run against the merged engine.

**Testing model:**
- Engine/sim are TDD: failing test → implement → pass; every change reruns `npm run sim` on seeds 7/42/123 (must stay 6/6 — and here it will, trivially, since personas decline the exit).
- `npm test` does NOT cover `the-feed.html`. The one chrome change (end-screen line) is browser-verified: load `http://localhost:8080/the-feed.html`, confirm the IIFE ran (`#nichegrid .pick` length 6) with no console errors.
- No `SAVE_VERSION` bump (the only new state, `S.flags.exitOffered`/`exitChoice`, is absent-means-default).

---

## File structure

- **`the-feed-engine.js`** — `CONFIG.exitWeek`; the `the-exit` event (3 choices); the `rollEvent` pre-empt; the one-line `checkEndings` guard.
- **`tools/the-feed-test.js`** — forced-at-`exitWeek`; each choice's steering; keep-climbing leaves the run alive; the `checkEndings` guard.
- **`tools/the-feed-sim.js`** — `resolveEvent` decline special-case.
- **`the-feed.html`** — one clause on the end-screen "how you got here" path line.
- **`the-feed-BACKLOG.md`** — shipped note.

---

### Task 0: Baseline

- [ ] **Step 1:** `npm test` → record the pass count (post-2a it will be ~79). `npm run sim` on seeds 7/42/123 → each `6/6 targets met`. Record.
- [ ] **Step 2:** `preview_start {name:"site"}`, load `http://localhost:8080/the-feed.html`, confirm start overlay renders, console clean.

---

### Task 1: `CONFIG.exitWeek` + the `checkEndings` guard (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing test**

```js
test('checkEndings honors an ending an event already set (the exit mechanism)', () => {
  const S = E.newState('gaming', 'longform'); S.week = 46;
  S.over = true; S.endKey = 'sellout';
  assert.equal(E.checkEndings(S), 'sellout');
});
test('CONFIG.exitWeek is a late-Act-III week', () => {
  assert.ok(E.CONFIG.exitWeek > E.CONFIG.phases.midEnd && E.CONFIG.exitWeek < E.CONFIG.years);
});
```

- [ ] **Step 2: Run → FAIL** (`exitWeek` undefined; and without the guard, `checkEndings` at week 46 returns `null` because no threshold is met, not `'sellout'`).

- [ ] **Step 3: Implement.** In `CONFIG`, add `exitWeek: 46,` (near `years: 52,`). At the very top of `checkEndings(S)`:

```js
  function checkEndings(S) {
    if (S.over && S.endKey) return S.endKey;   // honor an ending an event already decided (the Act III exit)
    const tot = totalFollowers(S); let key = null;
    ... // unchanged
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit** (`the-feed-engine.js`, `tools/the-feed-test.js`): `git commit -m "The Feed: checkEndings honors an event-set ending + CONFIG.exitWeek` + blank + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`.

---

### Task 2: The exit event + its three steered choices (engine, TDD)

**Files:** `the-feed-engine.js` (add to `EVENTS`), `tools/the-feed-test.js`

The copy is a draft in the game's voice (Jason voice-passes). The `apply` logic and steering are the spec.

- [ ] **Step 1: Failing tests**

```js
test('the-exit: Sell ends the run as sellout with a buyout banked', () => {
  const S = E.newState('gaming', 'longform'); S.week = 46; S.plats.longform.followers = 40000; S.cash = 1000;
  const ev = E.EVENTS.find(e => e.id === 'the-exit'); const sell = ev.choices.findIndex(c => c.label === 'Sell the channel');
  E.applyEventChoice(S, ev, sell);
  assert.equal(S.over, true); assert.equal(S.endKey, 'sellout'); assert.ok(S.cash > 1000, 'buyout banked'); assert.equal(S.flags.exitChoice, 'sold');
});
test('the-exit: Go independent → legend with an owned audience + rep, else faded', () => {
  const ev = E.EVENTS.find(e => e.id === 'the-exit'); const indie = ev.choices.findIndex(c => c.label === 'Go independent');
  const A = E.newState('gaming', 'longform'); A.week = 46; A.rep = 60; A.plats.writing.active = true;   // owns a newsletter
  E.applyEventChoice(A, ev, indie); assert.equal(A.endKey, 'legend'); assert.equal(A.over, true);
  const B = E.newState('gaming', 'longform'); B.week = 46; B.rep = 60;   // owns nothing
  E.applyEventChoice(B, ev, indie); assert.equal(B.endKey, 'faded');
  const C = E.newState('gaming', 'longform'); C.week = 46; C.rep = 30; C.members = 500;   // owns, but low rep
  E.applyEventChoice(C, ev, indie); assert.equal(C.endKey, 'faded');
});
test('the-exit is never surfaced by the random draw (forced-only)', () => {
  E.setRng(seeded(9));
  for (let wk = 2; wk <= 52; wk++) for (let i = 0; i < 40; i++) {
    const S = E.newState('gaming', 'longform'); S.week = wk; S.plats.longform.followers = 40000; S.rep = 55; S.deals = 3;
    const ev = E.drawEvent(S); if (ev && ev.id === 'the-exit') assert.fail('the-exit must not appear in the random deck');
  }
});
test('the-exit: Keep climbing leaves the run alive and changes no state', () => {
  const S = E.newState('gaming', 'longform'); S.week = 46; const snap = JSON.stringify(S);
  const ev = E.EVENTS.find(e => e.id === 'the-exit'); const keep = ev.choices.findIndex(c => c.label === 'Keep climbing');
  E.applyEventChoice(S, ev, keep);
  assert.equal(S.over, false); assert.equal(S.endKey, null);
  // no economy mutation (feed line only): the sim relies on this
  const after = JSON.parse(JSON.stringify(S)); delete after.feed; const b = JSON.parse(snap); delete b.feed;
  assert.deepEqual(after, b);
});
```

- [ ] **Step 2: Run → FAIL** (event missing).

- [ ] **Step 3: Implement.** Add to the `EVENTS` array:

```js
    { id: 'the-exit', kind: 'neutral', emoji: '🚪', title: 'Someone wants to buy the whole thing.', badge: 'The offer',
      cond: () => false,   // never in the RANDOM deck — surfaced ONLY by the forced pre-empt in rollEvent (which bypasses cond)
      text: 'A media company slid a number across the table for the channel — the name, the audience, the back catalogue, all of it. A year in, this is the fork: take the money and walk, keep it and see how far it goes, or hand the reins to nobody and go independent.',
      choices: [
        { t: 'escalate', ci: '💰', label: 'Sell the channel', desc: 'Take the buyout. Walk away rich.', stakes: 'a buyout hits the bank, then the run ends — Sold out',
          apply: S => { const buyout = Math.round(totalFollowers(S) * 3); S.cash += buyout; S.grossEarned += buyout; S.flags.exitChoice = 'sold'; S.over = true; S.endKey = 'sellout';
            const log = fed('💰', `You sold. ${money(buyout)} cleared, and the channel is someone else's problem now. Your name is still on it — that was the expensive part.`, 'big'); log.floats.push({ anchor: 'cash', text: '+' + money(buyout), tone: 'cash' }); return log; } },
        { t: 'neutral', ci: '🕊️', label: 'Go independent', desc: 'Walk away on your own terms, with what you own.', stakes: 'run ends — Niche legend if you own an audience (newsletter/members) with rep ≥ 50, else Faded out',
          apply: S => { const owned = S.members > 0 || S.plats.writing.active; S.flags.exitChoice = 'independent'; S.over = true; S.endKey = (owned && S.rep >= 50) ? 'legend' : 'faded';
            return fed('🕊️', S.endKey === 'legend'
              ? 'You walked, and the audience that was actually yours walked with you. No buyer, no boss, no ceiling but your own.'
              : 'You walked, and found out how much of it you never owned. The reach was rented; it stayed with the landlord.', S.endKey === 'legend' ? 'big' : 'bad'); } },
        { t: 'repair', ci: '🧗', label: 'Keep climbing', desc: 'Turn it down. The work isn\'t finished.', stakes: 'no change — play the year out and see where it lands',
          apply: S => fed('🧗', 'You turned it down. The number was real and you said no anyway. The work isn\'t finished, and neither are you.', '') },
      ] },
```

- [ ] **Step 4: Run → PASS.** Then `npm run sim` seeds 7/42/123 — still 6/6 (the exit isn't forced yet and personas will decline once it is; no economy change). Confirm.

- [ ] **Step 5: Commit** (`the-feed-engine.js`, `tools/the-feed-test.js`): `"The Feed: the Act III exit event (sell / go independent / keep climbing)"` + the co-author trailer.

---

### Task 3: Force the exit once at `exitWeek` (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing tests**

```js
test('rollEvent forces the exit exactly once at exitWeek, pre-empting the roll', () => {
  E.setRng(seeded(11));
  const S = E.newState('gaming', 'longform'); S.week = E.CONFIG.exitWeek; S.plats.longform.followers = 40000;
  const ev = E.rollEvent(S);
  assert.ok(ev && ev.id === 'the-exit', 'exit forced at exitWeek');
  assert.equal(S.flags.exitOffered, E.CONFIG.exitWeek);
  // not again next call at the same week
  assert.ok(!(E.rollEvent(S) || {}).id || (E.rollEvent(S) || {}).id !== 'the-exit');
});
test('rollEvent does not force the exit before exitWeek', () => {
  E.setRng(seeded(11));
  const S = E.newState('gaming', 'longform'); S.week = E.CONFIG.exitWeek - 1;
  for (let i = 0; i < 50; i++) { const ev = E.rollEvent(S); if (ev && ev.id === 'the-exit') assert.fail('exit fired early'); }
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement.** Change the head of `rollEvent(S)`:

```js
  function rollEvent(S) {
    // The Act III exit is guaranteed once, late in the run — it pre-empts the random roll.
    if (S.week === CONFIG.exitWeek && !S.flags.exitOffered) {
      S.flags.exitOffered = S.week;
      const ev = EVENTS.find(e => e.id === 'the-exit'); S.seenEvents.push(ev.id);
      return ev;
    }
    if (!(S.week >= 2 && chance(CONFIG.eventChance))) return null;
    const ev = drawEvent(S);
    if (ev && !ev.repeatable && !S.seenEvents.includes(ev.id)) S.seenEvents.push(ev.id);
    return ev;
  }
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit** (`the-feed-engine.js`, `tools/the-feed-test.js`): `"The Feed: force the exit decision once in late Act III"` + trailer.

---

### Task 4: Sim personas decline the exit (sim)

**Files:** `tools/the-feed-sim.js`

- [ ] **Step 1: Add the special-case.** In `resolveEvent(S, ev, persona)`, at the very top:

```js
function resolveEvent(S, ev, persona) {
  if (ev.id === 'the-exit') {   // a player-authored narrative choice, not a balance lever — personas keep climbing
    const keep = ev.choices.findIndex(c => c.label === 'Keep climbing');
    E.applyEventChoice(S, ev, keep >= 0 ? keep : ev.choices.length - 1);
    return;
  }
  ... // unchanged
}
```

- [ ] **Step 2: Verify balance untouched.** `npm run sim` on seeds 7/42/123 → **6/6 each**, and the per-persona ending mix matches the 2a baseline (the exit is declined every time, so nothing moves). Record the three "6/6 targets met" lines.

- [ ] **Step 3: Commit** (`tools/the-feed-sim.js`): `"The Feed: sim declines the Act III exit (keeps the 6 targets about the core loop)"` + trailer.

---

### Task 5: End-screen acknowledgment (chrome, browser-verified)

**Files:** `the-feed.html`

- [ ] **Step 1: Add the clause.** In `endGame(key)`, the "how you got here" path line builds an array assigned to `$('endPath').innerHTML` (search for `endPath`). Append one item when the player took an exit:

```js
    const pathBits = [
      `Built on <b>${top?PLATFORMS[top.key].name:'—'}</b>`,
      `<b>${S.deals}</b> brand deal${S.deals===1?'':'s'}`,
      `rested <b>${run.restWeeks}</b> week${run.restWeeks===1?'':'s'}`,
      `peak stress <b>${run.peakStress}</b>`,
      `<b>${run.events}</b> event${run.events===1?'':'s'} faced`,
    ];
    if(S.flags.exitChoice==='sold') pathBits.push('took the <b>buyout</b> in week ' + E.CONFIG.exitWeek);
    else if(S.flags.exitChoice==='independent') pathBits.push('went <b>independent</b> in week ' + E.CONFIG.exitWeek);
    $('endPath').innerHTML = pathBits.join(' · ');
```

(Match the exact existing array — the five base items are already there; just capture them into `pathBits`, push the conditional item, and join. Do not change the five base items.)

- [ ] **Step 2: Verify (browser).** Reload; IIFE clean (`#nichegrid .pick` = 6), no console errors. Then exercise an exit end-to-end (see Task 6's play-through) and confirm the end-screen path line shows "took the buyout in week 46" / "went independent in week 46". Base runs (no exit) show the unchanged five-item line.

- [ ] **Step 3: Commit** (`the-feed.html`): `"The Feed: note the exit choice on the end-screen path line"` + trailer.

---

### Task 6: Backlog note + final regression + end-to-end browser check

**Files:** `the-feed-BACKLOG.md`

- [ ] **Step 1:** Add a "Shipped: Acts 2b — the Act III exit decision" note to the backlog (under the Step-1 section from 2a): `the-exit` forced once at `CONFIG.exitWeek` (46); sell → sellout + buyout, go independent → legend/faded on owned-audience+rep, keep climbing → plays out; the one-line `checkEndings` guard; personas decline it (sim 6/6 unchanged); no `SAVE_VERSION` bump; **Pillar 1 (Acts) complete.** Copy is a draft pending Jason's voice pass.

- [ ] **Step 2: Final guards.** `npm test` all green (record total); `npm run sim` 7/42/123 → 6/6.

- [ ] **Step 3: End-to-end browser check.** Fast-forward a run into Act III to week 46 (drive `endWeekBtn`, answering events; gate the loop on the inbox badge, and cap each `javascript_tool` eval to a few weeks to avoid the tab-timeout seen in 2a). At week 46 the exit appears once as the week's event. Verify three runs: **Keep climbing** → game continues to week 47+; **Sell** → ends on the Sold-out screen with the buyout in the Bank stat + the path clause; **Go independent** (from a run that launched a newsletter/membership with rep ≥ 50) → ends on Niche legend, else Faded. No console errors.

- [ ] **Step 4:** `preview_stop` the `site` server. Commit the backlog note.

---

## Self-review notes (author checklist)

- **Spec coverage:** `exitWeek` + `checkEndings` guard (T1) · the event + steering (T2) · the forced pre-empt (T3) · personas decline / sim untouched (T4) · end-screen acknowledgment (T5). Save compatibility: no bump (only new flags). Out of scope (Team, hall, Pillar 4 sketch) correctly absent.
- **Name/type consistency:** `exitWeek`, `the-exit`, `exitOffered`, `exitChoice` (`'sold'`/`'independent'`), choice labels ('Sell the channel'/'Go independent'/'Keep climbing') used identically in engine, tests, sim, and chrome. `endKey` values are all existing ones (`sellout`/`legend`/`faded`).
- **No placeholders in mechanism:** T1–T5 carry complete code. The exit event *copy* is a labeled draft for Jason's voice pass; its `apply`/steering (the tested, balance-relevant part) is complete.
