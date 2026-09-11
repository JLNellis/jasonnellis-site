# The Feed — Event Deck Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow The Feed's event deck from 10 to ~30 cards with non-repeat + phase gating and threat cash-sinks, so runs stay fresh to week 52 and cash stops being a dead scoreboard — all without touching the UI.

**Architecture:** Three small additions to the pure engine (`the-feed-engine.js`): per-run `seenEvents` tracking + `grossEarned` accumulator in state, phase bands in `CONFIG`, and a widened `drawEvent` filter. Then ~20 new `EVENTS` entries (5 threat/sink + ~15 growth/variety) built on shared apply-helpers. Deterministic tests in `the-feed-test.js` lock the mechanics; the existing `the-feed-sim.js` balance harness (already exercises events and reports `medCash`) tunes the sinks and must keep its six targets green.

**Tech Stack:** Plain Node (no deps), UMD engine module, `assert`-based tests (`npm test`), headless balance sim (`npm run sim`).

---

## File structure

- **`the-feed-engine.js`** — all engine work. `CONFIG.phases` + `CONFIG.taxRate`; `S.seenEvents` / `S.grossEarned` / `S.taxedThrough` in `newState`; three `grossEarned +=` lines at the income sites; `drawEvent`/`rollEvent` filter + seen-recording; new apply-helpers; `id`/`repeatable` on the existing 10 cards; ~20 new `EVENTS` entries.
- **`tools/the-feed-test.js`** — new deterministic tests (state init, gross accumulation, non-repeat, phase gating, sink mechanics, structural invariants).
- **`tools/the-feed-sim.js`** — **re-run only.** Edited *only* if a new balance target is approved by Jason (spec §3).
- **`the-feed-BACKLOG.md`** — status + changelog update at the end.
- **`the-feed.html`** — **NOT touched.** No UI changes in B. (The browser already calls `rollEvent`/`applyEventChoice`; recording `seenEvents` inside `rollEvent` is transparent to it.)

**Conventions to match (from the existing deck):** every event is `{ id, kind, emoji, title, badge, cond?, minWeek?, maxWeek?, repeatable?, text, choices:[{ t, ci, label, desc, apply }] }`. `t ∈ repair | neutral | escalate` — the sim's `resolveEvent` picks a choice by the persona's preferred `t`, so **every card must offer a coherent spread of tags** or the sim falls back to random. `apply(S)` returns an effect-log via the `fed`/`hurt`/`L` helpers. Copy style: medias res, no morals, **no em dashes**.

**Copy note (not a placeholder):** Per spec §4, Claude drafts every new card's copy (`title`, `text`, `label`, `desc`, feed lines) during implementation, and Jason reviews the full batch before ship. This plan fixes each card's **mechanics** exactly (ids, gating, choice tags, numeric effects, helper calls); the prose strings are authored at implementation time and are the reviewable surface. Draft copy inline as you build each card — do not leave string literals empty.

---

## Task 1: State + config scaffolding

**Files:**
- Modify: `the-feed-engine.js` — `CONFIG` (~line 67, near `eventChance`), `newState` (~line 168-177)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tools/the-feed-test.js` (after the `newState` block near line 37):

```js
// ---------------------------------------------------------------- event deck: state init
test('newState seeds event-deck tracking fields', () => {
  const S = mk();
  assert.deepStrictEqual(S.seenEvents, []);
  assert.strictEqual(S.grossEarned, 0);
  assert.strictEqual(S.taxedThrough, 0);
});
test('CONFIG exposes phase bands and tax rate', () => {
  assert.strictEqual(typeof E.CONFIG.phases.earlyEnd, 'number');
  assert.strictEqual(typeof E.CONFIG.phases.midEnd, 'number');
  assert.ok(E.CONFIG.phases.earlyEnd < E.CONFIG.phases.midEnd);
  assert.ok(E.CONFIG.taxRate > 0 && E.CONFIG.taxRate < 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `S.seenEvents` is `undefined` (deepStrictEqual mismatch) and `E.CONFIG.phases` is `undefined` (throws reading `.earlyEnd`).

- [ ] **Step 3: Add the CONFIG fields**

In `the-feed-engine.js`, inside the `CONFIG` object, replace the line:

```js
    eventChance: 0.55,
```

with:

```js
    eventChance: 0.55,
    // event deck: phase bands (weeks) + tax rate on gross earned since last tax event
    phases: { earlyEnd: 17, midEnd: 35 }, // early 2–17 · mid 18–35 · late 36–52
    taxRate: 0.22,
```

- [ ] **Step 4: Add the state fields**

In `newState`, in the `const S = { ... }` literal, change the line:

```js
      tails: [], usedTopics: [], totalViews: 0, peakOverhead: 0, newFollowers: 0,
```

to:

```js
      tails: [], usedTopics: [], totalViews: 0, peakOverhead: 0, newFollowers: 0,
      seenEvents: [], grossEarned: 0, taxedThrough: 0,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (both new tests green, all prior tests still green).

- [ ] **Step 6: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: event-deck state + phase/tax config scaffolding"
```

---

## Task 2: Accumulate gross earnings at the income sites

`grossEarned` must sum every dollar the player *earns* (ad revenue per post, passive tail/membership income, and brand-deal pay) so the tax sink scales to real income. Event windfalls are deliberately excluded (you don't get taxed on a fan gift).

**Files:**
- Modify: `the-feed-engine.js` — `doPost` (~line 315), `settleWeek` (~line 518), `biz.deal` (~line 370)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tools/the-feed-test.js`:

```js
// ---------------------------------------------------------------- event deck: gross earnings
test('doPost adds ad revenue to grossEarned', () => {
  E.setRng(seeded(3));
  const S = mk('beauty', 'longform'); S.plats.longform.followers = 5000;
  const before = S.grossEarned;
  E.doPost(S, 'longform', 'evergreen', 'x', 1);
  assert.ok(S.grossEarned > before, 'grossEarned should grow by ad revenue');
});
test('biz.deal adds pay to grossEarned', () => {
  E.setRng(seeded(3));
  const S = mk('beauty', 'longform'); S.plats.longform.followers = 5000;
  const before = S.grossEarned;
  E.biz.deal(S);
  assert.ok(S.grossEarned > before, 'grossEarned should grow by deal pay');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `grossEarned` stays 0 (no accumulation yet).

- [ ] **Step 3: Accumulate in `doPost`**

In `doPost`, find:

```js
    p.followers += gain; if (A.cohort) p.trendFollowers += gain;
    S.newFollowers += gain; S.totalViews += views; S.cash += rev;
```

Change the second line to also bank the revenue:

```js
    p.followers += gain; if (A.cohort) p.trendFollowers += gain;
    S.newFollowers += gain; S.totalViews += views; S.cash += rev; S.grossEarned += rev;
```

- [ ] **Step 4: Accumulate passive income in `settleWeek`**

In `settleWeek`, find:

```js
    const oh = overhead(S);
    S.cash += Math.round(passive); S.cash -= oh; S.peakOverhead = Math.max(S.peakOverhead, oh);
```

Change to:

```js
    const oh = overhead(S);
    const passiveR = Math.round(passive); S.cash += passiveR; S.grossEarned += passiveR;
    S.cash -= oh; S.peakOverhead = Math.max(S.peakOverhead, oh);
```

- [ ] **Step 5: Accumulate deal pay in `biz.deal`**

In `biz.deal`, find:

```js
      S.cash += pay; S.rep = clamp(S.rep - h, 0, 100); S.deals++;
```

Change to:

```js
      S.cash += pay; S.grossEarned += pay; S.rep = clamp(S.rep - h, 0, 100); S.deals++;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (both new tests green, all prior tests still green).

- [ ] **Step 7: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: accumulate gross earnings at the three income sites"
```

---

## Task 3: Non-repeat + phase gating in `drawEvent`; id/repeatable the existing 10

**Files:**
- Modify: `the-feed-engine.js` — the 10 existing `EVENTS` entries (~line 397-491), `drawEvent`/`rollEvent` (~line 541-542)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tools/the-feed-test.js`:

```js
// ---------------------------------------------------------------- event deck: draw filtering
test('every event has a unique id and valid choice tags', () => {
  const ids = new Set();
  E.EVENTS.forEach(ev => {
    assert.ok(ev.id, 'event missing id: ' + ev.title);
    assert.ok(!ids.has(ev.id), 'duplicate id: ' + ev.id); ids.add(ev.id);
    ev.choices.forEach(c => assert.ok(['repair','neutral','escalate'].includes(c.t), 'bad tag on ' + ev.id));
  });
});
test('drawEvent does not repeat a non-repeatable event within a run', () => {
  E.setRng(seeded(5));
  const S = mk(); S.week = 40; S.plats.longform.followers = 50000; S.rep = 60; S.deals = 3; S.gear = 2;
  const drawn = [];
  for (let i = 0; i < 200; i++) { const ev = E.drawEvent(S); if (!ev) break; drawn.push(ev.id); }
  const repeatableIds = new Set(E.EVENTS.filter(e => e.repeatable).map(e => e.id));
  const nonRepeat = drawn.filter(id => !repeatableIds.has(id));
  assert.strictEqual(nonRepeat.length, new Set(nonRepeat).size, 'a non-repeatable id repeated');
});
test('drawEvent respects minWeek/maxWeek phase gating', () => {
  E.setRng(seeded(6));
  for (const wk of [3, 20, 50]) {
    const S = mk(); S.week = wk; S.plats.longform.followers = 60000; S.rep = 60; S.deals = 4; S.gear = 3;
    for (let i = 0; i < 300; i++) {
      S.seenEvents = []; // allow re-draw to sample the deck at this week
      const ev = E.drawEvent(S); if (!ev) continue;
      if (ev.minWeek != null) assert.ok(wk >= ev.minWeek, `${ev.id} fired at wk ${wk} < minWeek ${ev.minWeek}`);
      if (ev.maxWeek != null) assert.ok(wk <= ev.maxWeek, `${ev.id} fired at wk ${wk} > maxWeek ${ev.maxWeek}`);
    }
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — existing events have no `id` (first test fails on `ev.id`).

- [ ] **Step 3: Add ids + repeatable tags to the existing 10 cards**

In `the-feed-engine.js`, add an `id` to each existing `EVENTS` entry, and `repeatable: true` to the four generic recurring beats. Edit each entry's opening line. The mapping (apply exactly these ids):

| current title (opening words) | add `id:` | add `repeatable: true`? |
|---|---|---|
| `A post is going viral right now.` | `'viral-moment'` | yes |
| `The platform changed its algorithm overnight.` | `'algo-shift'` | yes |
| `A fan sends $500 and a note.` | `'fan-gift'` | no |
| `A crypto brand slides into your DMs.` | `'crypto-dm'` | no |
| `A troll swarm hit your comments.` | `'troll-swarm'` | yes |
| `You're being cancelled over a misread clip.` | `'cancel-clip'` | no |
| `You're getting review-bombed.` | `'review-bomb'` | no |
| `A "receipts" account is digging...` | `'receipts'` | no |
| `A parasocial superfan turned on you.` | `'parasocial'` | no |
| `You haven't slept in days.` | `'sleepless'` | yes |

Example — the first entry's opening line changes from:

```js
    { kind: 'neutral', emoji: '🚀', title: 'A post is going viral right now.', badge: 'Momentum', cond: () => true,
```

to:

```js
    { id: 'viral-moment', repeatable: true, kind: 'neutral', emoji: '🚀', title: 'A post is going viral right now.', badge: 'Momentum', cond: () => true,
```

Do the equivalent for all ten (id always first; `repeatable: true` right after id for the four marked yes).

- [ ] **Step 4: Widen `drawEvent` and record seen ids in `rollEvent`**

Replace:

```js
  function drawEvent(S) { const deck = EVENTS.filter(e => !e.cond || e.cond(S)); return pick(deck); }
  function rollEvent(S) { return (S.week >= 2 && chance(CONFIG.eventChance)) ? drawEvent(S) : null; }
```

with:

```js
  function drawEvent(S) {
    const deck = EVENTS.filter(e =>
         (!e.cond || e.cond(S))
      && (e.minWeek == null || S.week >= e.minWeek)
      && (e.maxWeek == null || S.week <= e.maxWeek)
      && (e.repeatable || !S.seenEvents.includes(e.id)));
    return deck.length ? pick(deck) : null;
  }
  function rollEvent(S) {
    if (!(S.week >= 2 && chance(CONFIG.eventChance))) return null;
    const ev = drawEvent(S);
    if (ev && !ev.repeatable && !S.seenEvents.includes(ev.id)) S.seenEvents.push(ev.id);
    return ev;
  }
```

(`drawEvent` no longer assumes a non-empty deck; late in a run the non-repeatable pool can empty, leaving only repeatables or `null`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (three new tests green, all prior tests still green).

- [ ] **Step 6: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: non-repeat + phase gating in the event draw; id existing deck"
```

---

## Task 4: Apply-helpers + the 5 threat / cash-sink cards

**Files:**
- Modify: `the-feed-engine.js` — add helpers near the existing event helpers (~line 394-396), add 5 entries to `EVENTS`
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tools/the-feed-test.js`:

```js
// ---------------------------------------------------------------- event deck: cash sinks
const evById = id => E.EVENTS.find(e => e.id === id);
test('tax-bill exists, is phase-gated mid, and scales to gross earned', () => {
  E.setRng(seeded(7));
  const ev = evById('tax-bill');
  assert.ok(ev && ev.minWeek >= 18 && !ev.repeatable);
  const S = mk(); S.cash = 20000; S.grossEarned = 40000; S.taxedThrough = 0;
  const payChoice = ev.choices.find(c => c.t === 'repair');
  payChoice.apply(S);
  assert.ok(S.cash < 20000, 'tax should reduce cash');
  assert.strictEqual(S.taxedThrough, 40000, 'taxedThrough advances to grossEarned');
});
test('tax bills only the gross earned since the last tax event', () => {
  E.setRng(seeded(7));
  const ev = evById('tax-bill');
  const S = mk(); S.cash = 20000; S.grossEarned = 40000; S.taxedThrough = 30000;
  const pay = ev.choices.find(c => c.t === 'repair');
  const before = S.cash; pay.apply(S);
  // taxable = 40000 - 30000 = 10000; bill ≈ 10000 * taxRate
  const bill = before - S.cash;
  assert.ok(bill > 0 && bill < 10000 * E.CONFIG.taxRate + 5 && bill > 10000 * E.CONFIG.taxRate - 5);
});
test('the four other sink cards each reduce cash on their paying choice', () => {
  for (const id of ['demonetization', 'gear-dies', 'sponsor-clawback', 'surprise-expense']) {
    E.setRng(seeded(8));
    const ev = evById(id); assert.ok(ev, 'missing ' + id);
    const S = mk(); S.cash = 30000; S.gear = 2; S.deals = 3; S.plats.longform.followers = 20000;
    const c = ev.choices.find(x => x.t === 'repair') || ev.choices[0];
    const before = S.cash; c.apply(S);
    assert.ok(S.cash < before, id + ' should cost cash');
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `evById('tax-bill')` is `undefined`.

- [ ] **Step 3: Add the sink helpers**

In `the-feed-engine.js`, just after the existing `hurt` helper (line ~396, before `const EVENTS = [`), add:

```js
    // event apply-helpers for cash effects (float on the cash meter + a feed line)
    const spend = (S, e, t, amount, kind) => { const n = Math.max(0, Math.round(amount)); S.cash -= n; const log = fed(e, t, kind || 'bad'); log.floats.push({ anchor: 'cash', text: '-' + money(n), tone: 'loss' }); return log; };
    const gift  = (S, e, t, amount, kind) => { const n = Math.max(0, Math.round(amount)); S.cash += n; const log = fed(e, t, kind || 'good'); log.floats.push({ anchor: 'cash', text: '+' + money(n), tone: 'cash' }); return log; };
    const taxBill = S => { const taxable = Math.max(0, S.grossEarned - S.taxedThrough); S.taxedThrough = S.grossEarned; return Math.round(taxable * CONFIG.taxRate); };
```

- [ ] **Step 4: Add the 5 sink cards to `EVENTS`**

Insert these 5 entries into the `EVENTS` array (anywhere before the closing `];` at ~line 491). Mechanics are fixed; the copy below is the draft for Jason's review pass.

```js
    // ---- cash-sink sub-deck (the balance fix) ----
    { id: 'tax-bill', kind: 'neutral', emoji: '🧾', title: 'The tax bill came due.', badge: 'Taxes', minWeek: 18, maxWeek: 36,
      text: 'Quarterly estimate. The number at the bottom is bigger than you told yourself it would be.',
      choices: [
        { t: 'repair', ci: '💳', label: 'Pay it clean', desc: 'Settle in full. Done is done.',
          apply: S => { const bill = taxBill(S); addStress(S, 4); return spend(S, '🧾', `Paid the estimate: −${money(bill)}. No letters coming.`, bill); } },
        { t: 'escalate', ci: '🧮', label: 'Get creative with it', desc: 'Write off everything. Coin flip.',
          apply: S => { const bill = taxBill(S); if (chance(.5)) { const paid = Math.round(bill * 0.5); return spend(S, '🧮', `The deductions held. Only −${money(paid)} this quarter.`, paid, ''); } const owed = Math.round(bill * 1.5); const r = repHit(S, 3, 8); addStress(S, 8); return spend(S, '📛', `Flagged for review. Back taxes and penalties: −${money(owed)}. Rep −${r}.`, owed); } },
      ] },
    { id: 'tax-year-end', kind: 'neutral', emoji: '🧾', title: 'Year-end taxes hit.', badge: 'Taxes', minWeek: 45,
      text: 'Everything you made since the last reckoning, all on one line.',
      choices: [
        { t: 'repair', ci: '💳', label: 'Pay it and move on', desc: 'Close the year clean.',
          apply: S => { const bill = taxBill(S); addStress(S, 4); return spend(S, '🧾', `Squared up for the year: −${money(bill)}.`, bill); } },
        { t: 'escalate', ci: '⏳', label: 'Set up a payment plan', desc: 'Spread it, eat the interest.',
          apply: S => { const bill = Math.round(taxBill(S) * 1.2); addStress(S, 6); return spend(S, '⏳', `On a plan now, with interest: −${money(bill)} this pass.`, bill); } },
      ] },
    { id: 'demonetization', kind: 'hostile', emoji: '🚫', title: 'Your account got demonetized.', badge: 'Strike', minWeek: 10,
      text: 'A blanket policy sweep caught you in it. The revenue dashboard just flatlined.',
      choices: [
        { t: 'repair', ci: '📩', label: 'Appeal and wait', desc: 'File it, lose the month either way.',
          apply: S => { const gap = Math.round(1200 + totalFollowers(S) * 0.04); addStress(S, 6); return spend(S, '🚫', `Ad money frozen while you appeal: −${money(gap)} this month.`, gap); } },
        { t: 'escalate', ci: '📢', label: 'Make it public and loud', desc: 'Post about it. Sympathy or noise.',
          apply: S => { const gap = Math.round(1200 + totalFollowers(S) * 0.04); if (chance(.5)) { const p = strongest(S); const ggn = Math.round(rnd(800, 2600)); p.followers += ggn; S.newFollowers += ggn; const log = spend(S, '📢', `The callout landed. Still down ${money(gap)}, but +${fmt(ggn)} showed up angry on your behalf.`, gap, ''); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(ggn), tone: 'gain' }); log.bump.push(p.key); return log; } const r = repHit(S, 2, 6); return spend(S, '📉', `Read as whining. Down ${money(gap)} and Rep −${r}.`, gap); } },
      ] },
    { id: 'gear-dies', kind: 'neutral', emoji: '🎥', title: 'Your main rig just died.', badge: 'Equipment', cond: S => S.gear >= 1 && S.gear <= 3,
      text: 'Mid-shoot, the whole setup gave up. You are not making anything good on a phone.',
      choices: [
        { t: 'repair', ci: '🛒', label: 'Replace it now', desc: 'Buy back the tier you were on.',
          apply: S => { const cost = CONFIG.gearCost[S.gear]; return spend(S, '🎥', `Bought the replacement: −${money(cost)}. Back in business.`, cost); } },
        { t: 'escalate', ci: '📵', label: 'Limp along without it', desc: 'Save the cash, lose the quality.',
          apply: S => { S.gear = Math.max(0, S.gear - 1); activePlats(S).forEach(p => p.heat = clamp(p.heat - 8, 0, 100)); return fed('📵', 'Downgraded to whatever still works. Everything looks cheaper now.', 'bad'); } },
      ] },
    { id: 'sponsor-clawback', kind: 'hostile', emoji: '💼', title: 'A past sponsor wants their money back.', badge: 'Clawback', cond: S => S.deals >= 2, minWeek: 12,
      text: 'The brand you ran got caught in its own scandal, and the contract had a morality clause pointed the wrong way.',
      choices: [
        { t: 'repair', ci: '✍️', label: 'Honor the clause', desc: 'Pay it back, keep your name clean.',
          apply: S => { const amt = Math.round(900 + totalFollowers(S) * 0.02); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return spend(S, '💼', `Refunded the fee: −${money(amt)}. The lawyers went quiet.`, amt); } },
        { t: 'escalate', ci: '⚖️', label: 'Fight it', desc: 'Refuse. Legal fees either way.',
          apply: S => { const fees = Math.round(700 + totalFollowers(S) * 0.03); const r = repHit(S, 2, 6); return spend(S, '⚖️', `Dragged it out. Legal fees anyway: −${money(fees)}. Rep −${r}.`, fees); } },
      ] },
    { id: 'surprise-expense', kind: 'neutral', emoji: '💥', title: 'Something expensive just broke.', badge: 'Life', minWeek: 6,
      text: 'Not the content. Life. The kind of bill that does not care about your posting schedule.',
      choices: [
        { t: 'repair', ci: '💸', label: 'Just handle it', desc: 'Pay and keep moving.',
          apply: S => { const amt = Math.round(600 + totalFollowers(S) * 0.015); addStress(S, 3); return spend(S, '💥', `Handled it: −${money(amt)}. Onward.`, amt); } },
        { t: 'escalate', ci: '🩹', label: 'Put it off', desc: 'Ignore it. It gets worse.',
          apply: S => { const amt = Math.round((600 + totalFollowers(S) * 0.015) * 1.6); addStress(S, 9); return spend(S, '🩹', `Let it fester. Now it is −${money(amt)} and a worse week.`, amt); } },
      ] },
  ];
```

Note: this block ends with `];` — it **replaces** the existing `];` that currently closes `EVENTS`. Delete the old closing `];` and paste the 5 cards + the closing `];` in its place, or insert the 5 cards just above the existing `];` and leave that `];` alone. Do not create two `];`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (sink tests green, structural test from Task 3 still green — all new cards have ids + valid tags, prior tests still green).

- [ ] **Step 6: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: cash-sink event cards (tax, demonetization, gear, clawback, expense)"
```

---

## Task 5: The growth / variety cards (reach ~30)

Add ~14 more cards for variety across phases and kinds, using the same structure and the existing/new helpers. Mechanics are fixed in the table; copy is drafted at implementation for Jason's review.

**Files:**
- Modify: `the-feed-engine.js` — more `EVENTS` entries
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write the failing test (deck size + phase spread)**

Add to `tools/the-feed-test.js`:

```js
// ---------------------------------------------------------------- event deck: size + coverage
test('deck has ~30 cards with early/mid/late coverage', () => {
  assert.ok(E.EVENTS.length >= 28, 'expected >= 28 events, got ' + E.EVENTS.length);
  const hasLate = E.EVENTS.some(e => e.minWeek && e.minWeek >= 36);
  const hasMid  = E.EVENTS.some(e => (e.minWeek && e.minWeek >= 18 && e.minWeek < 36));
  assert.ok(hasLate, 'need at least one late-phase card');
  assert.ok(hasMid, 'need at least one mid-phase card');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — after Task 4 the deck is 16 cards (`10 + 6`), below the `>= 28` threshold.

- [ ] **Step 3: Add the growth/variety cards**

Insert these entries into `EVENTS` (before the closing `];`). Each `apply` uses only existing helpers (`fed`, `hurt`, `gift`, `spend`, `repHit`, `loseFollowers`, `strongest`, `activePlats`, `addStress`, `clamp`, `rnd`, `rint`, `chance`, `fmt`, `money`, `totalFollowers`). Build every card with a coherent `t` spread. Committed spine (author copy inline):

| id | kind | gating | choices (t → mechanical effect) |
|---|---|---|---|
| `collab-offer` | neutral | `maxWeek: 35` | repair "Do the collab": `g = round(rnd(1500,4000) * (1 + 30000/(totalFollowers+8000)))` → strongest.followers += g, newFollowers += g, +heat, addStress 6 · neutral "Pass, stay focused": rep +rint(1,3) |
| `collab-big` | neutral | `cond: totalFollowers>15000, minWeek:20` | repair "Team up with the bigger creator": `g = round(rnd(4000,9000))` followers to strongest, +heat, addStress 8 · escalate "Try to upstage them": chance(.5) double g else repHit(4,9) + small g |
| `platform-beta` | neutral | `maxWeek: 20` | repair "Jump on the beta": pick one active plat, heat += 22, addStress 3 · neutral "Wait and see": heat += 6 on strongest |
| `press-feature` | neutral | `minWeek: 8` | repair "Do the interview": rep += rint(3,7), strongest.followers += round(rnd(800,2500)) (+newFollowers) · neutral "Decline politely": rep += rint(1,3) |
| `copycat` | hostile | none | repair "Out-create them": addStress 5, strongest.heat += 10, rep += rint(1,4) · neutral "Ignore, keep making": chance(.6) fed neutral else hurt(.005,.015) small · escalate "Call them out": chance(.45) growth via strongest else repHit(6,12) |
| `editor-quits` | neutral | `cond: S.hires.editor` | repair "Re-hire fast": set `S.hires.editor` stays true, spend HIRES.editor.sign (rehire cost), addStress 4 · escalate "Do it all yourself": `S.hires.editor=false`, addStress 12 |
| `sponsor-pullout` | hostile | `cond: S.deals>=1, minWeek:14` | repair "Find a replacement deal": gift(S, round(400+totalFollowers*0.01)) but addStress 4 (hustle) · neutral "Eat the loss": spend small opportunity note (round(300)), rep +rint(0,2) |
| `cpm-q4` | neutral | `minWeek: 45` | repair "Push hard through Q4": gift(S, round(1500 + totalFollowers*0.03)), addStress 6 · neutral "Coast the holidays": gift(S, round(700 + totalFollowers*0.015)) |
| `cpm-summer` | neutral | `minWeek: 22, maxWeek: 35` | repair "Ride out the slump": spend(S, round(500 + totalFollowers*0.01)) income dip, small · neutral "Bank content for fall": spend smaller (round(300)), strongest.heat += 6 |
| `awards-nod` | neutral | `minWeek: 45` | repair "Campaign for it": addStress 5, rep += rint(3,8), chance(.5) gift(S, 500) · neutral "Let the work speak": rep += rint(2,5) |
| `annual-reckoning` | neutral | `minWeek: 47` | repair "Take stock honestly": addStress(-10), rep += rint(1,4) · escalate "Ignore it, keep grinding": addStress 6, heat += 4 across active |
| `algo-boost` | neutral | none, `repeatable: true` | repair "Lean into the wave": activePlats heat += 12, addStress 4 · neutral "Stay steady": strongest.heat += 6 |
| `brand-inbound` | neutral | `cond: totalFollowers>3000, maxWeek:40` | repair "Take the clean deal": gift(S, round(400+totalFollowers*0.02)), grossEarned += that amount (it's income — add `S.grossEarned += n` after gift, so it's taxable) · escalate "Push for more money": chance(.5) gift bigger else deal falls through (fed neutral) |
| `community-milestone` | neutral | `cond: totalFollowers>10000` | repair "Celebrate with them": rep += rint(2,5), addStress(-4) · neutral "Mark it quietly": rep += rint(1,3) |

Author each as a full `{ id, kind, emoji, title, badge, cond?, minWeek?, maxWeek?, repeatable?, text, choices:[...] }` object in Jason's voice. Keep effect magnitudes as specified — they are the balance surface Task 6 tunes.

For `brand-inbound`, since its payout is taxable income, add `S.grossEarned += n;` inside that choice's apply after the cash is credited (mirrors the real income sites).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — `E.EVENTS.length >= 28` (10 + 6 + 14 = 30), mid + late coverage present, structural/unique-id test still green.

- [ ] **Step 5: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: growth & variety event cards (deck to ~30)"
```

---

## Task 6: Balance pass — tune sinks, keep the six targets green

**Files:**
- Modify: `the-feed-engine.js` — `CONFIG.taxRate` and sink magnitudes only, as needed
- Run: `tools/the-feed-sim.js` (no edits unless a new target is approved)

- [ ] **Step 1: Baseline the balance report**

Run: `npm run sim`
Expected: prints per-persona medians (incl. `$medCash`) and the `⚑ BALANCE TARGETS` block. Record the six targets' pass/fail and the `medCash` for **The Optimizer**, **The Sustainable**, and **The Optimizer**'s Studio vs non-Studio split.

- [ ] **Step 2: Read the outcome against the goal**

The spec's balance goal: non-Studio winners should no longer end hoarding a dead ~$60–85K. Compare current non-Studio winner `medCash` to that band.
- If the six targets **fail**, the sinks are too harsh (pushing strategic personas into Broke) — reduce `CONFIG.taxRate` (e.g. 0.22 → 0.18) and/or the `+ totalFollowers * k` coefficients on the sink cards, re-run.
- If the six targets **pass** but non-Studio `medCash` is still >~$50K, the sinks are too soft — raise `taxRate` (e.g. 0.22 → 0.26) and/or sink coefficients, re-run.
- Iterate until: **all six targets pass** AND non-Studio winner `medCash` sits meaningfully below the old $60–85K band.

Run each iteration: `SEED=7 npm run sim` (reproducible) then a plain `npm run sim` to confirm it's not seed-luck.

- [ ] **Step 3: Decide on a cash target (only if needed)**

If confirming "cash is now consumed" needs a codified check, do NOT silently edit the six targets. Surface to Jason:
> "Sim shows non-Studio winners now end at ~$X. Want me to add a 7th balance target (non-Studio winner median end-cash ≤ $Y) so this doesn't regress?"
Only add the target after a yes.

- [ ] **Step 4: Confirm tests still pass with final numbers**

Run: `npm test`
Expected: PASS (tax/sink tests are threshold-based, not exact-value, so tuning within range keeps them green).

- [ ] **Step 5: Commit**

```bash
git add the-feed-engine.js tools/the-feed-sim.js
git commit -m "The Feed: balance pass — tune cash sinks, six targets green"
```

---

## Task 7: Docs update

**Files:**
- Modify: `the-feed-BACKLOG.md`

- [ ] **Step 1: Update the backlog**

In `the-feed-BACKLOG.md`:
- Move sub-project **B** from the "Next" section to a shipped summary paragraph (mirror the A entry's tone): deck grown to ~30, non-repeat + phase gating, threat cash-sinks, six balance targets held.
- Under the shipped note, record the resolved open item: "Cash sink — solved by B's threat events (tax, demonetization, gear failure, clawback, surprise expense)."
- Leave intact: sub-project **C** (now the next item), the **essay-CTA** priority note, the **leaderboard** defer, OpenMoji drop, and the remaining open balance items (Star→GOAT gap, Optimizer 4-platform, Grinder floor).
- Update the opening line that says A is shipped and B/C are next, to reflect B shipped.

- [ ] **Step 2: Commit**

```bash
git add the-feed-BACKLOG.md
git commit -m "The Feed: mark sub-project B shipped in backlog"
```

---

## Self-review notes (addressed)

- **Spec coverage:** §1a non-repeat → Task 3; §1b phase gating → Task 3; §1c gross accumulator → Tasks 1–2; §2 threat cards → Task 4; §2 growth cards → Task 5; §3 tests → Tasks 1–5, sim → Task 6; §4 copy (draft + review gate) → noted in header + Tasks 4–5; §5 docs → Task 7. No gaps.
- **Type/name consistency:** `seenEvents`/`grossEarned`/`taxedThrough`, `CONFIG.phases.{earlyEnd,midEnd}`, `CONFIG.taxRate`, helpers `spend`/`gift`/`taxBill`, and card ids are used identically across every task.
- **Placeholder scan:** card *copy* is authored at implementation by explicit spec §4 decision (with Jason's review gate) — not a hand-wave; every card's *mechanics* are fully specified. No "TODO/handle edge cases" steps.
- **The one seam to watch:** the `EVENTS` closing `];` — Tasks 4 and 5 both insert before it. Insert above the existing `];`; never duplicate it.
