# The Feed — Core Loop Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace The Feed's energy/skill economy with slots + stress, content cards with angles and authored topics, a views→followers→revenue model with churn, weekly membership recompute, a hire/fire roster, and a Studio tier — balanced against the simulator and playable in the current UI.

**Architecture:** All mechanics stay in `the-feed-engine.js` (UMD, pure, DOM-free), consumed by the browser game (`the-feed.html`), the balance simulator (`tools/the-feed-sim.js`) and a new deterministic test file (`tools/the-feed-test.js`). The engine gains an injectable RNG so tests are reproducible. State-mutating functions keep returning effect logs `{floats, feed, bump}`; `settleWeek` now returns a log too (churn / stress-band / tail lines).

**Tech Stack:** Vanilla JS (CommonJS in Node, global `FeedEngine` in browser), Node ≥18 for tools, Eleventy passthrough for deployment. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-11-the-feed-core-loop-rework-design.md`

---

## Before you start — read these

- `the-feed-BACKLOG.md` — project state.
- `the-feed-engine.js` — the whole file (≈350 lines). You are rewriting most of it.
- `the-feed.html` lines 287–512 — the game script that consumes the engine.
- `tools/the-feed-sim.js` — personas + runner you are rewriting.

**Deployment warning:** pushing to `main` triggers a Netlify deploy. The engine and the HTML will be out of sync between Task 2 and Task 11, so **all work happens on a branch** and only merges at the end.

## File structure

| File | Responsibility | Action |
|---|---|---|
| `the-feed-engine.js` | Single source of truth: CONFIG, data (niches, platforms, angles, topics, hires, events, endings), state, hand dealing, post resolution, weekly settlement, business actions, endings. | Rewrite in place, task by task. Stays one file — it's loaded by one `<script>` tag and one `require`. |
| `tools/the-feed-test.js` | Deterministic engine tests (seeded RNG, plain `assert`). | Create |
| `tools/the-feed-sim.js` | Personas, runner, balance report, target flags. | Rewrite personas/runner/report |
| `the-feed.html` | Browser presentation of the engine. | Modify the script + a few markup/CSS bits |
| `package.json` | `npm test` script. | Modify |
| `the-feed-BACKLOG.md`, `CLAUDE.md` | Docs. | Modify |

## Engine API after this plan (reference — every task below builds toward this)

```
CONFIG, NICHES, PLATFORMS, PORDER, TIERS, TIERCUT, ANGLES, TOPICS, HIRES, ENDINGS, EVENTS
setRng(fn), rnd, rint, clamp, chance, pick, fmt, money
newState(niche, home), activePlats, totalFollowers, strongest, platTier
stressBand(S), addStress(S, n), useSlot(S, kind)
hireCount(S), hireCap(S), hasStudio(S), payroll(S), overhead(S), overheadBreakdown(S)
viewsMult(S, pkey), stressCost(S, pkey, angleKey)
upgradeInfo(S), hireInfo(S, role)
pickTopic(S, angleKey), buildHand(S), applyMove(S, card), doPost, startPlatform, crosspost
biz.engage(S) biz.deal(S) biz.upgrade(S) biz.paid(S) biz.hire(S, role) biz.fire(S, role)
settleWeek(S) -> log, drawEvent, rollEvent, applyEventChoice, advanceWeek, checkEndings
```

---

### Task 1: Branch, test harness, injectable RNG

**Files:**
- Modify: `package.json`
- Modify: `the-feed-engine.js:48-53` (RNG helpers)
- Create: `tools/the-feed-test.js`

- [ ] **Step 1: Create the working branch**

```bash
git checkout -b feed-core-loop
```

- [ ] **Step 2: Add the test script to package.json**

Change the `scripts` block to:

```json
  "scripts": {
    "build": "eleventy",
    "serve": "eleventy --serve",
    "test": "node tools/the-feed-test.js",
    "sim": "node tools/the-feed-sim.js"
  },
```

- [ ] **Step 3: Write the test harness with a first (failing) test for `setRng`**

Create `tools/the-feed-test.js`:

```js
#!/usr/bin/env node
/*
 * THE FEED — engine tests. Plain Node asserts, seeded RNG, no deps.
 * Run: npm test
 */
const assert = require('assert');
const E = require('../the-feed-engine.js');

// Deterministic LCG so every test sees the same "random" sequence.
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
// Fresh state helper. Default: education niche on longform (least volatile).
const mk = (niche = 'edu', home = 'longform') => E.newState(niche, home);

// ---------------------------------------------------------------- rng
test('setRng makes the engine deterministic', () => {
  E.setRng(seeded(1)); const a = [E.rnd(0, 1), E.rint(1, 100), E.pick([1, 2, 3, 4, 5])];
  E.setRng(seeded(1)); const b = [E.rnd(0, 1), E.rint(1, 100), E.pick([1, 2, 3, 4, 5])];
  assert.deepStrictEqual(a, b);
  E.setRng(seeded(2)); const c = E.rnd(0, 1);
  assert.notStrictEqual(a[0], c);
});

// ---------------------------------------------------------------- runner
let failed = 0;
for (const [name, fn] of tests) {
  try { E.setRng(seeded(42)); fn(); console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message.split('\n')[0]); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 4: Run it — expect failure**

Run: `npm test`
Expected: `✗ setRng makes the engine deterministic` with `E.setRng is not a function`, exit code 1.

- [ ] **Step 5: Make the engine's RNG injectable**

In `the-feed-engine.js`, replace the RNG helpers block (currently lines 48–53):

```js
  // ======================= RNG helpers =======================
  // Injectable so the tests and the sim can be reproducible. Defaults to Math.random.
  let rng = Math.random;
  const setRng = fn => { rng = fn || Math.random; };
  const rnd = (a, b) => a + rng() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chance = p => rng() < p;
  const pick = a => a[Math.floor(rng() * a.length)];
```

And add `setRng` to the export object at the bottom (the `return { ... }` block): put `setRng,` right before `rnd,`.

- [ ] **Step 6: Run tests — expect pass**

Run: `npm test`
Expected: `✓ setRng makes the engine deterministic`, `1/1 passed`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json tools/the-feed-test.js the-feed-engine.js
git commit -m "The Feed: test harness + injectable RNG

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Slots + stress replace energy; skill removed

This task changes state shape. The browser game will be broken from here until Task 11 — that's expected on the branch.

**Files:**
- Modify: `the-feed-engine.js` (CONFIG, PLATFORMS, newState, helpers, advanceWeek, checkEndings, exports)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write failing tests**

Add to `tools/the-feed-test.js` above the runner:

```js
// ---------------------------------------------------------------- slots + stress
test('newState has slots, stress, no energy/skill', () => {
  const S = mk();
  assert.deepStrictEqual(S.slots, { content: 2, business: 1 });
  assert.strictEqual(S.stress, E.CONFIG.startStress);
  assert.strictEqual(S.energy, undefined);
  assert.strictEqual(S.skill, undefined);
  assert.strictEqual(S.redlineStreak, 0);
  assert.strictEqual(S.band, 'normal');
});
test('useSlot decrements and refuses at zero', () => {
  const S = mk();
  assert.strictEqual(E.useSlot(S, 'content'), true);
  assert.strictEqual(E.useSlot(S, 'content'), true);
  assert.strictEqual(E.useSlot(S, 'content'), false);
  assert.strictEqual(S.slots.content, 0);
  assert.strictEqual(E.useSlot(S, 'business'), true);
  assert.strictEqual(E.useSlot(S, 'business'), false);
});
test('advanceWeek resets slots', () => {
  const S = mk(); E.useSlot(S, 'content'); E.useSlot(S, 'business');
  E.advanceWeek(S);
  assert.deepStrictEqual(S.slots, { content: 2, business: 1 });
  assert.strictEqual(S.week, 2);
});
test('addStress clamps 0..100', () => {
  const S = mk(); E.addStress(S, 500); assert.strictEqual(S.stress, 100);
  E.addStress(S, -500); assert.strictEqual(S.stress, 0);
});
test('stressBand thresholds', () => {
  const S = mk();
  S.stress = 49; assert.strictEqual(E.stressBand(S), 'normal');
  S.stress = 50; assert.strictEqual(E.stressBand(S), 'hot');
  S.stress = 70; assert.strictEqual(E.stressBand(S), 'fumes');
  S.stress = 90; assert.strictEqual(E.stressBand(S), 'redline');
});
test('burnout ending after 3 redline weeks', () => {
  const S = mk(); S.redlineStreak = 2; assert.strictEqual(E.checkEndings(S), null);
  S.redlineStreak = 3; assert.strictEqual(E.checkEndings(S), 'burnout');
});
```

- [ ] **Step 2: Run — expect the 6 new tests to fail**

Run: `npm test`
Expected: failures mentioning `useSlot is not a function` / `slots` undefined etc. Exit 1.

- [ ] **Step 3: Rewrite CONFIG**

Replace the whole `CONFIG` block in `the-feed-engine.js` with:

```js
  // ======================= TUNING KNOBS =======================
  // To rebalance: edit here, run `npm run sim`. Both game and sim read this block.
  const CONFIG = {
    startCash: 900, startStress: 20,
    slotsContent: 2, slotsBusiness: 1,
    // stress: recovery per week, extra per empty content slot, band thresholds
    stressRecover: 12, stressRecoverPerEmptySlot: 8,
    bandHot: 50, bandFumes: 70, bandRedline: 90, fumesViewsMult: 0.85,
    burnoutStreak: 3,
    // overhead (replaces rent): flat + per platform + payroll + studio lease
    overheadBase: 140, overheadPerPlatform: 10, studioLease: 350,
    // post math
    viewsK: 160, baseConv: 0.02, sizeSat: 55000, sizeMax: 4.5,
    // churn
    churnBase: 0.006, churnTrend: 0.012, churnIdle: 0.02, idleWeeks: 3,
    // evergreen tail
    tailWeeks: 4, tailRate: 0.15,
    topicCooldown: 8,
    // money
    bankruptFloor: -1500,
    dealBase: 90, dealScale: 0.018,
    paidUnlock: 1500, memberRate: 6, memberConvMin: 0.02, memberConvMax: 0.045,
    memberNewConv: 0.025, memberChurn: 0.03, memberChurnIdle: 0.06,
    // gear: tiers 1-3 are kit, tier 4 is the Studio
    gearCost: [0, 350, 800, 1700, 12000], gearViewsMult: 1.10,
    studioUnlockFollowers: 25000, studioViewsMult: 1.3, studioStressRelief: 6,
    hireCapBase: 2, hireCapStudio: 4,
    // endings
    goatAt: 1200000, starAt: 300000, legendAt: 40000, legendRep: 55,
    sellDeals: 6, sellRepUnder: 45, sellCashOver: 1800,
    eventChance: 0.55,
    years: 52,
  };
```

- [ ] **Step 4: Replace `energy` with `stress` in PLATFORMS and retune rpm to per-view**

Replace the `PLATFORMS` block with:

```js
  // Platform accent colors map onto the site's Bolt OS status palette:
  // green (hero), blue (info), slate (muted), amber (warning), red (live).
  // `stress` = stress cost per post. `rpm` = ad revenue per VIEW.
  const PLATFORMS = {
    longform:  { name: 'Longform Video', tag: 'YT-style',       emoji: '🎬', color: '#00E676', stress: 18, rpm: .0045, viral: 1.0,  loyal: 1.25, unlock: 0,    fmt: 'a deep-dive video' },
    shortform: { name: 'Short Video',    tag: 'vertical clips',  emoji: '📱', color: '#3B82F6', stress: 10, rpm: .0006, viral: 1.6,  loyal: .6,   unlock: 0,    fmt: 'a batch of shorts' },
    micro:     { name: 'Microblog',      tag: 'text posts',      emoji: '💬', color: '#94A3B8', stress: 6,  rpm: .0003, viral: 1.25, loyal: .8,   unlock: 0,    fmt: 'a hot take' },
    writing:   { name: 'Newsletter',     tag: 'long writing',    emoji: '📰', color: '#F59E0B', stress: 14, rpm: .006,  viral: .75,  loyal: 1.5,  unlock: 1200, fmt: 'a longform essay' },
    live:      { name: 'Live Stream',    tag: 'live',            emoji: '🔴', color: '#EF4444', stress: 20, rpm: .003,  viral: .9,   loyal: 1.6,  unlock: 2500, fmt: 'a live stream' },
  };
```

- [ ] **Step 5: Rewrite `newState` and the state helpers**

Replace the `// ======================= state =======================` section (from `function newState` through `const L = ...`) with:

```js
  // ======================= state =======================
  function newState(niche, home) {
    const n = NICHES[niche];
    const S = {
      name: '', niche, week: 1, phase: 'play',
      cash: CONFIG.startCash, stress: CONFIG.startStress, rep: n.rep0,
      gear: 0, deals: 0, members: 0,
      band: 'normal', redlineStreak: 0,
      slots: { content: CONFIG.slotsContent, business: CONFIG.slotsBusiness },
      hires: { editor: false, manager: false, mod: false, designer: false },
      tails: [], usedTopics: [], totalViews: 0, peakOverhead: 0, newFollowers: 0,
      lastHit: null, over: false, endKey: null, plats: {}, hand: [],
    };
    PORDER.forEach(k => { S.plats[k] = { key: k, followers: 0, trendFollowers: 0, heat: 0, fatigue: 0, posts: 0, active: false, proven: false, lastPost: -9 }; });
    S.plats[home].active = true;
    S.plats[home].followers = 40;
    return S;
  }
  const activePlats = S => PORDER.map(k => S.plats[k]).filter(p => p.active);
  const totalFollowers = S => PORDER.reduce((s, k) => s + S.plats[k].followers, 0);
  const strongest = S => activePlats(S).sort((a, b) => b.followers - a.followers)[0];
  // Tier is cosmetic polish on the channel card: posts + gear.
  function platTier(S, p) { const pol = p.posts * 3 + S.gear * 9; let t = 0; for (let i = 0; i < TIERCUT.length; i++) if (pol >= TIERCUT[i]) t = i; return t; }

  // --- slots & stress ---
  function useSlot(S, kind) { if (S.slots[kind] <= 0) return false; S.slots[kind]--; return true; }
  function addStress(S, n) { S.stress = clamp(S.stress + n, 0, 100); }
  function stressBand(S) {
    if (S.stress >= CONFIG.bandRedline) return 'redline';
    if (S.stress >= CONFIG.bandFumes) return 'fumes';
    if (S.stress >= CONFIG.bandHot) return 'hot';
    return 'normal';
  }

  const L = () => ({ floats: [], feed: [], bump: [] });
```

(Delete the old `skillCap` and `rent` lines — they're replaced in Task 3.)

- [ ] **Step 6: Update `advanceWeek` and `checkEndings`**

Replace `advanceWeek`:

```js
  function advanceWeek(S) { S.week++; S.slots = { content: CONFIG.slotsContent, business: CONFIG.slotsBusiness }; }
```

In `checkEndings`, change the burnout line to:

```js
    else if (S.redlineStreak >= CONFIG.burnoutStreak) key = 'burnout';
```

- [ ] **Step 7: Update exports**

Replace the `return { ... }` export block with (this is the final shape; later tasks add the functions it names, so the engine will throw on load for missing names — that's fine, those tasks come next and the file only needs to `require` cleanly, which it will because the names are just `undefined` properties):

```js
  return {
    CONFIG, NICHES, PLATFORMS, PORDER, TIERS, TIERCUT, ENDINGS, EVENTS,
    setRng, rnd, rint, clamp, chance, pick, fmt, money,
    newState, activePlats, totalFollowers, strongest, platTier,
    useSlot, addStress, stressBand,
    buildHand, applyMove, doPost, startPlatform, crosspost, biz,
    settleWeek, drawEvent, rollEvent, applyEventChoice, advanceWeek, checkEndings,
  };
```

- [ ] **Step 8: Run tests**

Run: `npm test`
Expected: the 6 new tests pass. **Other engine code still references `S.energy`/`S.skill`/`rent`/`skillCap` (doPost, biz, events, settleWeek) — that's fine for now, nothing calls them yet.** `7/7 passed`.

- [ ] **Step 9: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed engine: slots + stress state, skill removed, per-view rpm

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Hires, payroll, overhead

**Files:**
- Modify: `the-feed-engine.js` (new HIRES data after PLATFORMS; new helpers after `stressBand`; `biz.hire`/`biz.fire` — the `biz` object is fully rewritten in Task 8, so for now add the two functions to the existing object)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write failing tests**

```js
// ---------------------------------------------------------------- hires + overhead
test('overhead is flat + per-platform + payroll + lease, and breakdown sums', () => {
  const S = mk();
  assert.strictEqual(E.overhead(S), 140 + 10);
  S.plats.shortform.active = true;
  assert.strictEqual(E.overhead(S), 140 + 20);
  S.hires.editor = true;
  assert.strictEqual(E.payroll(S), E.HIRES.editor.weekly);
  S.gear = 4;
  const b = E.overheadBreakdown(S);
  assert.strictEqual(b.base, 140); assert.strictEqual(b.platforms, 20);
  assert.strictEqual(b.payroll, E.HIRES.editor.weekly); assert.strictEqual(b.lease, E.CONFIG.studioLease);
  assert.strictEqual(b.total, E.overhead(S));
  assert.strictEqual(b.total, b.base + b.platforms + b.payroll + b.lease);
});
test('hire cap is 2 without studio, 4 with', () => {
  const S = mk(); S.cash = 99999;
  assert.strictEqual(E.hireCap(S), 2);
  E.biz.hire(S, 'editor'); S.slots.business = 1;
  E.biz.hire(S, 'mod'); S.slots.business = 1;
  assert.strictEqual(E.hireCount(S), 2);
  const before = S.cash;
  E.biz.hire(S, 'designer');
  assert.strictEqual(S.hires.designer, false, 'third hire refused without studio');
  assert.strictEqual(S.cash, before, 'refused hire costs nothing');
  assert.strictEqual(S.slots.business, 1, 'refused hire keeps the slot');
  S.gear = 4; assert.strictEqual(E.hireCap(S), 4);
  E.biz.hire(S, 'designer');
  assert.strictEqual(S.hires.designer, true);
});
test('hire takes signing cost and business slot; fire clears payroll', () => {
  const S = mk(); S.cash = 5000;
  const log = E.biz.hire(S, 'manager');
  assert.strictEqual(S.cash, 5000 - E.HIRES.manager.sign);
  assert.strictEqual(S.slots.business, 0);
  assert.ok(log.feed.length === 1 && /manager/i.test(log.feed[0].text));
  assert.strictEqual(E.payroll(S), E.HIRES.manager.weekly);
  E.biz.fire(S, 'manager');
  assert.strictEqual(S.hires.manager, true, 'fire refused: no business slot left');
  S.slots.business = 1;
  E.biz.fire(S, 'manager');
  assert.strictEqual(S.hires.manager, false);
  assert.strictEqual(E.payroll(S), 0);
});
test('hire refused when broke', () => {
  const S = mk(); S.cash = 10;
  E.biz.hire(S, 'mod');
  assert.strictEqual(S.hires.mod, false); assert.strictEqual(S.slots.business, 1);
});
test('hireInfo explains refusals', () => {
  const S = mk(); S.cash = 10;
  assert.strictEqual(E.hireInfo(S, 'mod').ok, false);
  assert.match(E.hireInfo(S, 'mod').reason, /\$/);
  S.cash = 5000; assert.strictEqual(E.hireInfo(S, 'mod').ok, true);
  S.hires.editor = S.hires.manager = true;
  assert.match(E.hireInfo(S, 'mod').reason, /studio/i);
});
```

- [ ] **Step 2: Run — expect failures** (`E.overhead is not a function`, etc.)

- [ ] **Step 3: Add HIRES data** right after the `PLATFORMS` block:

```js
  // Team. Each role is a one-line modifier applied at exactly one site in the engine.
  const HIRES = {
    editor:   { label: 'Editor',        emoji: '✂️', sign: 600, weekly: 110, blurb: 'Cuts the grind out of longform and live.' },
    manager:  { label: 'Manager',       emoji: '📞', sign: 500, weekly: 90,  blurb: 'Better deals, less of the sellout smell.' },
    mod:      { label: 'Community mod', emoji: '🛡️', sign: 400, weekly: 60,  blurb: 'Keeps the comments from becoming the story.' },
    designer: { label: 'Designer',      emoji: '🎨', sign: 800, weekly: 140, blurb: 'Packaging and thumbnails. More clicks everywhere.' },
  };
  const HORDER = ['editor', 'manager', 'mod', 'designer'];
```

- [ ] **Step 4: Add the helpers** right after `stressBand`:

```js
  // --- team, overhead ---
  const hasStudio = S => S.gear >= 4;
  const hireCount = S => HORDER.filter(k => S.hires[k]).length;
  const hireCap = S => hasStudio(S) ? CONFIG.hireCapStudio : CONFIG.hireCapBase;
  const payroll = S => HORDER.reduce((s, k) => s + (S.hires[k] ? HIRES[k].weekly : 0), 0);
  function overheadBreakdown(S) {
    const b = { base: CONFIG.overheadBase, platforms: activePlats(S).length * CONFIG.overheadPerPlatform, payroll: payroll(S), lease: hasStudio(S) ? CONFIG.studioLease : 0 };
    b.total = b.base + b.platforms + b.payroll + b.lease; return b;
  }
  const overhead = S => overheadBreakdown(S).total;
  function hireInfo(S, role) {
    const h = HIRES[role];
    if (S.hires[role]) return { ok: false, reason: 'Already on the team.' };
    if (hireCount(S) >= hireCap(S)) return { ok: false, reason: hasStudio(S) ? 'Team is full.' : 'No room — you need the Studio to hold more than two people.' };
    if (S.cash < h.sign) return { ok: false, reason: 'Signing costs ' + money(h.sign) + '.' };
    if (S.slots.business <= 0) return { ok: false, reason: 'No business slot left this week.' };
    return { ok: true, reason: '' };
  }
```

- [ ] **Step 5: Add `hire` and `fire` to the `biz` object** (add these two members to the existing `biz = { ... }`; the rest of `biz` is rewritten in Task 8):

```js
    hire(S, role) { const h = HIRES[role]; if (!h || !hireInfo(S, role).ok || !useSlot(S, 'business')) return L();
      S.cash -= h.sign; S.hires[role] = true;
      const log = L(); log.floats.push({ anchor: 'cash', text: '-' + money(h.sign), tone: 'loss' });
      log.feed.push({ emoji: h.emoji, text: `Hired a ${h.label.toLowerCase()}. Payroll is now ${money(payroll(S))}/week.`, kind: 'good' }); return log; },
    fire(S, role) { const h = HIRES[role]; if (!h || !S.hires[role] || !useSlot(S, 'business')) return L();
      S.hires[role] = false;
      const log = L(); log.feed.push({ emoji: '👋', text: `You let your ${h.label.toLowerCase()} go. Payroll −${money(h.weekly)}/week.`, kind: '' }); return log; },
```

- [ ] **Step 6: Export** — add `HIRES, HORDER,` after `ENDINGS, EVENTS,` and add `hasStudio, hireCount, hireCap, payroll, overhead, overheadBreakdown, hireInfo,` after `useSlot, addStress, stressBand,` in the export block.

- [ ] **Step 7: Run tests** — `npm test` → all pass (`12/12`).

- [ ] **Step 8: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed engine: hires, payroll, overhead breakdown

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Gear tiers + the Studio, view/stress multipliers

**Files:**
- Modify: `the-feed-engine.js` (helpers after `hireInfo`; `biz.upgrade`)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write failing tests**

```js
// ---------------------------------------------------------------- gear + studio + multipliers
test('viewsMult stacks gear, studio, designer, editor(longform/live), fumes', () => {
  const S = mk();
  assert.strictEqual(E.viewsMult(S, 'longform'), 1);
  S.gear = 2; assert.ok(Math.abs(E.viewsMult(S, 'micro') - 1.1 * 1.1) < 1e-9);
  S.gear = 4; assert.ok(Math.abs(E.viewsMult(S, 'micro') - Math.pow(1.1, 3) * 1.3) < 1e-9);
  S.gear = 0; S.hires.designer = true; assert.ok(Math.abs(E.viewsMult(S, 'micro') - 1.15) < 1e-9);
  S.hires.designer = false; S.hires.editor = true;
  assert.ok(Math.abs(E.viewsMult(S, 'longform') - 1.05) < 1e-9);
  assert.strictEqual(E.viewsMult(S, 'micro'), 1, 'editor does not touch micro');
  S.hires.editor = false; S.stress = 75; assert.strictEqual(E.viewsMult(S, 'micro'), E.CONFIG.fumesViewsMult);
});
test('stressCost: platform + angle − editor − studio, min 1', () => {
  const S = mk();
  assert.strictEqual(E.stressCost(S, 'longform', 'evergreen'), 18);
  assert.strictEqual(E.stressCost(S, 'longform', 'personal'), 24);
  S.hires.editor = true; assert.strictEqual(E.stressCost(S, 'longform', 'evergreen'), 10);
  assert.strictEqual(E.stressCost(S, 'micro', 'evergreen'), 6, 'editor does not touch micro');
  S.gear = 4; assert.strictEqual(E.stressCost(S, 'micro', 'evergreen'), 1, 'floors at 1');
});
test('upgrade tiers 1-3 cost cash and a business slot', () => {
  const S = mk(); S.cash = 5000;
  E.biz.upgrade(S); assert.strictEqual(S.gear, 1); assert.strictEqual(S.cash, 5000 - 350); assert.strictEqual(S.slots.business, 0);
  E.biz.upgrade(S); assert.strictEqual(S.gear, 1, 'no slot → refused');
  S.slots.business = 1; E.biz.upgrade(S); assert.strictEqual(S.gear, 2);
});
test('studio requires tier 3, 25K followers and $12K', () => {
  const S = mk(); S.gear = 3; S.cash = 20000; S.plats.longform.followers = 1000;
  assert.strictEqual(E.upgradeInfo(S).ok, false); assert.match(E.upgradeInfo(S).reason, /25K/);
  E.biz.upgrade(S); assert.strictEqual(S.gear, 3);
  S.plats.longform.followers = 30000;
  assert.strictEqual(E.upgradeInfo(S).ok, true); assert.strictEqual(E.upgradeInfo(S).cost, 12000);
  const log = E.biz.upgrade(S);
  assert.strictEqual(S.gear, 4); assert.strictEqual(S.cash, 8000);
  assert.ok(log.feed.some(f => f.kind === 'big'));
  assert.strictEqual(E.upgradeInfo(S).next, null, 'nothing left to buy');
});
```

- [ ] **Step 2: Run — expect failures.**

- [ ] **Step 3: Add multiplier helpers** after `hireInfo`:

```js
  // --- multipliers: every hire/gear/stress effect on output lives here ---
  function viewsMult(S, pkey) {
    let m = Math.pow(CONFIG.gearViewsMult, Math.min(S.gear, 3));
    if (hasStudio(S)) m *= CONFIG.studioViewsMult;
    if (S.hires.designer) m *= 1.15;
    if (S.hires.editor && (pkey === 'longform' || pkey === 'live')) m *= 1.05;
    if (stressBand(S) === 'fumes' || stressBand(S) === 'redline') m *= CONFIG.fumesViewsMult;
    return m;
  }
  function stressCost(S, pkey, angleKey) {
    let c = PLATFORMS[pkey].stress + (ANGLES[angleKey] ? ANGLES[angleKey].stress : 0);
    if (S.hires.editor && (pkey === 'longform' || pkey === 'live')) c -= 8;
    if (hasStudio(S)) c -= CONFIG.studioStressRelief;
    return Math.max(1, c);
  }
  function upgradeInfo(S) {
    const nx = S.gear + 1;
    if (nx > 4) return { next: null, cost: 0, ok: false, reason: 'Full rig and a studio — nothing left to buy.' };
    const cost = CONFIG.gearCost[nx];
    if (nx === 4 && totalFollowers(S) < CONFIG.studioUnlockFollowers) return { next: nx, cost, ok: false, reason: 'The Studio unlocks at ' + fmt(CONFIG.studioUnlockFollowers) + ' followers.' };
    if (S.cash < cost) return { next: nx, cost, ok: false, reason: 'Costs ' + money(cost) + '.' };
    if (S.slots.business <= 0) return { next: nx, cost, ok: false, reason: 'No business slot left this week.' };
    return { next: nx, cost, ok: true, reason: '' };
  }
```

`ANGLES` doesn't exist yet (Task 5). Add a temporary stub right after `HORDER` so this task's tests run — Task 5 replaces it:

```js
  const ANGLES = { trend: { stress: 0 }, evergreen: { stress: 0 }, personal: { stress: 6 } }; // replaced in Task 5
```

- [ ] **Step 4: Replace `biz.upgrade`** in the `biz` object:

```js
    upgrade(S) { const u = upgradeInfo(S); if (!u.ok || !useSlot(S, 'business')) return L();
      S.cash -= u.cost; S.gear = u.next;
      const log = L(); log.floats.push({ anchor: 'cash', text: '-' + money(u.cost), tone: 'loss' }); log.bump = PORDER.slice();
      if (u.next === 4) log.feed.push({ emoji: '🏢', text: `You signed the lease. The Studio is yours — every post gets bigger, every week costs ${money(CONFIG.studioLease)} more. No pressure.`, kind: 'big' });
      else log.feed.push({ emoji: '🛠️', text: `Upgraded your kit (tier ${u.next}). Every channel just got more polished.`, kind: 'good' });
      return log; },
```

- [ ] **Step 5: Export** `viewsMult, stressCost, upgradeInfo,` after `hireInfo,`; add `ANGLES,` after `HORDER,`.

- [ ] **Step 6: Run tests** — `npm test` → `16/16 passed`.

- [ ] **Step 7: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed engine: gear tiers, the Studio, views/stress multipliers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Angles, topics, the dealt hand

**Files:**
- Modify: `the-feed-engine.js` (replace the ANGLES stub; add TOPICS; rewrite `buildHand` + `applyMove`)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write failing tests**

```js
// ---------------------------------------------------------------- angles, topics, hand
test('TOPICS has 5 lines per niche per angle', () => {
  for (const n of Object.keys(E.NICHES)) for (const a of Object.keys(E.ANGLES)) {
    assert.strictEqual(E.TOPICS[n][a].length, 5, `${n}/${a}`);
    E.TOPICS[n][a].forEach(t => assert.ok(t.length > 8 && t.length <= 64, `${n}/${a}: "${t}"`));
  }
});
test('pickTopic avoids topics used within the cooldown', () => {
  const S = mk('gaming');
  const all = E.TOPICS.gaming.evergreen;
  all.slice(0, 4).forEach(t => S.usedTopics.push({ topic: t, week: 1 }));
  for (let i = 0; i < 20; i++) assert.strictEqual(E.pickTopic(S, 'evergreen'), all[4]);
  S.week = 1 + E.CONFIG.topicCooldown;
  const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(E.pickTopic(S, 'evergreen'));
  assert.ok(seen.size > 1, 'cooldown expired → other topics dealt again');
});
test('pickTopic falls back to any topic when all are on cooldown', () => {
  const S = mk('gaming');
  E.TOPICS.gaming.trend.forEach(t => S.usedTopics.push({ topic: t, week: 1 }));
  assert.ok(E.TOPICS.gaming.trend.includes(E.pickTopic(S, 'trend')));
});
test('buildHand: one post card per active platform, evergreen by default, plus an alt-angle card', () => {
  const S = mk(); const hand = E.buildHand(S);
  const posts = hand.filter(c => c.kind === 'post');
  assert.ok(posts.some(c => c.pkey === 'longform' && c.angle === 'evergreen'));
  assert.ok(posts.some(c => c.pkey === 'longform' && c.angle === 'trend'), 'alt angle for the strongest platform');
  posts.forEach(c => { assert.ok(c.topic); assert.strictEqual(c.stress, E.stressCost(S, c.pkey, c.angle)); });
});
test('buildHand: trend when hot, personal when rep low (max one), ride after a hit', () => {
  const S = mk(); S.plats.shortform.active = true; S.plats.micro.active = true;
  S.plats.shortform.heat = 45; S.rep = 40;
  const hand = E.buildHand(S).filter(c => c.kind === 'post' || c.kind === 'ride');
  assert.strictEqual(hand.find(c => c.pkey === 'shortform').angle, 'trend');
  assert.strictEqual(hand.filter(c => c.angle === 'personal').length, 1);
  S.rep = 60; S.lastHit = { key: 'micro', week: S.week - 1 };
  const ride = E.buildHand(S).find(c => c.kind === 'ride');
  assert.ok(ride && ride.pkey === 'micro' && ride.angle === 'trend' && ride.special);
});
test('buildHand keeps the same topic for the same platform+angle within a week', () => {
  const S = mk(); const a = E.buildHand(S).find(c => c.kind === 'post' && c.angle === 'evergreen').topic;
  const b = E.buildHand(S).find(c => c.kind === 'post' && c.angle === 'evergreen').topic;
  assert.strictEqual(a, b);
});
test('buildHand still deals cross-post and launch cards', () => {
  const S = mk(); S.plats.longform.followers = 3000; S.plats.longform.heat = 40; S.plats.shortform.active = true; S.plats.shortform.followers = 100;
  const hand = E.buildHand(S);
  const x = hand.find(c => c.kind === 'crosspost'); assert.ok(x && x.src === 'longform' && x.dst === 'shortform' && x.stress === 4);
  const st = hand.find(c => c.kind === 'start'); assert.ok(st && st.pkey === 'micro' && st.stress === 8);
});
test('applyMove consumes a content slot, adds stress, refuses at zero', () => {
  const S = mk(); const card = E.buildHand(S).find(c => c.kind === 'post');
  const s0 = S.stress; E.applyMove(S, card);
  assert.strictEqual(S.slots.content, 1); assert.strictEqual(S.stress, s0 + card.stress);
  E.applyMove(S, E.buildHand(S).find(c => c.kind === 'post'));
  assert.strictEqual(S.slots.content, 0);
  const posts = S.plats.longform.posts; const log = E.applyMove(S, E.buildHand(S).find(c => c.kind === 'post'));
  assert.strictEqual(S.plats.longform.posts, posts, 'refused'); assert.strictEqual(log.feed.length, 0);
});
```

- [ ] **Step 2: Run — expect failures.**

- [ ] **Step 3: Replace the ANGLES stub and add TOPICS** (put both right after `HORDER`):

```js
  // Content angles. Multipliers on the post math; the trade-offs are the lesson.
  //   views: reach multiplier · conv: follower conversion · heatHit: heat gain on a hit
  //   stress: extra stress · rep: passive rep gain · badChance/badRep: chance + size of a rep hit
  //   tail: evergreen keeps earning for CONFIG.tailWeeks · cohort: followers churn 2x
  const ANGLES = {
    trend:     { label: 'Trend',     emoji: '📈', views: 1.6, conv: 0.5, heatHit: [12, 20], stress: 0, badChance: 0.04, badRep: [3, 8],  cohort: true,
                 tag: 'chase what\'s hot', bad: 'aged badly — the take didn\'t hold up.' },
    evergreen: { label: 'Evergreen', emoji: '🌲', views: 0.8, conv: 1.3, heatHit: [4, 8],   stress: 0, tail: true,
                 tag: 'built to last' },
    personal:  { label: 'Personal',  emoji: '🫀', views: 1.0, conv: 1.1, heatHit: [8, 14],  stress: 6, rep: [2, 4], badChance: 0.08, badRep: [6, 12],
                 tag: 'you, on camera', bad: 'was too much for some people. Oversharing has a cost.' },
  };
  const AORDER = ['trend', 'evergreen', 'personal'];

  // Topic lines: written like real titles. 5 per niche per angle. Dealt with an 8-week cooldown.
  const TOPICS = {
    gaming: {
      trend:     ['I tried the patch everyone\'s furious about', 'Ranking every announcement from the showcase', 'The speedrun record just got destroyed', 'This game is dying and nobody will say it', 'Reacting to the most cursed clip of the week'],
      evergreen: ['The complete beginner\'s guide to speedrunning', 'Every setting you should change on day one', 'How matchmaking actually works', 'The best games nobody played this year', 'A beginner build that still wins'],
      personal:  ['Why I almost quit streaming', 'What 1,000 hours in one game did to me', 'My setup tour — the honest version', 'The DM that changed how I read chat', 'I got banned for this'],
    },
    beauty: {
      trend:     ['Testing the viral $9 dupe', 'Trying the routine that\'s all over my feed', 'Is this brand actually cancelled? The receipts', 'First impressions: the launch everyone\'s mad about', 'The clean-girl look in five minutes'],
      evergreen: ['Skincare basics I wish someone told me at 20', 'How to actually match your foundation', 'Everything in my bag, ranked by cost per wear', 'The 10-minute face for people who hate makeup', 'Reading an ingredients list without panicking'],
      personal:  ['Why I stopped hiding my skin', 'The brand deal I turned down', 'Getting ready with me on a bad day', 'My face at 30 vs 20 — no filter', 'The comment that made me stop posting for a month'],
    },
    edu: {
      trend:     ['That viral stat is wrong — here\'s the math', 'The news story everyone got wrong', 'Reacting to the study that broke the internet', 'Debunking the thread with 40 million views', 'Why the exam is trending, and what it means'],
      evergreen: ['The complete beginner\'s guide to compound interest', 'Every logical fallacy in 12 minutes', 'How to learn anything in 20 hours', 'The history nobody teaches in school', 'How the internet actually works, from first principles'],
      personal:  ['I failed out. Here\'s what actually happened.', 'What ten years of teaching taught me', 'The student question I couldn\'t answer', 'My study routine — the honest version', 'Why I left academia'],
    },
    comedy: {
      trend:     ['Every reply guy, ranked', 'Doing the trend but wrong on purpose', 'Live-reacting to the worst take of the week', 'The group chat when the drama drops', 'If the algorithm were a person'],
      evergreen: ['Types of people at every airport', 'The customer who\'s "just looking"', 'Every family dinner, condensed', 'The universal experience of a bad haircut', 'How to lose an argument you were winning'],
      personal:  ['The set that bombed so badly I rewrote everything', 'Why I stopped doing crowd work', 'My worst DM, read aloud', 'Getting sober on the internet', 'What my mom thinks I do for a living'],
    },
    fitness: {
      trend:     ['Testing the 75-day challenge everyone\'s doing', 'That viral workout is going to hurt you', 'Reacting to the celebrity\'s "routine"', 'The supplement everyone\'s mad about — tested', '30 days on the trending diet'],
      evergreen: ['The complete beginner\'s guide to the gym', 'Form check: five lifts you\'re doing wrong', 'How to actually build a habit', 'Eating enough — the guide nobody asked for', 'A home workout that isn\'t a scam'],
      personal:  ['The injury that took a year off my life', 'What I eat in a day — no lies this time', 'Why I deleted my progress photos', 'Training through a breakup', 'The DM from someone who started because of me'],
    },
    music: {
      trend:     ['Breaking down the song everyone\'s fighting about', 'Producing the trending sound in 10 minutes', 'Reacting to the award-show performance', 'This sample is about to blow up', 'Remixing the meme before it dies'],
      evergreen: ['Music theory in 15 minutes, no jargon', 'How a hit is actually built, layer by layer', 'Every chord progression you already know', 'Mixing for people with cheap headphones', 'The gear you actually need to start'],
      personal:  ['The label email I never answered', 'Why I stopped chasing playlists', 'Playing my first song again, five years later', 'Stage fright, on camera', 'The song I wrote about my dad'],
    },
  };
```

- [ ] **Step 4: Rewrite the hand section.** Replace everything from `// ======================= the adaptive hand` through the end of `buildHand` with:

```js
  // ======================= the dealt hand =======================
  function pickTopic(S, angleKey) {
    const all = TOPICS[S.niche][angleKey];
    const recent = new Set(S.usedTopics.filter(u => S.week - u.week < CONFIG.topicCooldown).map(u => u.topic));
    const fresh = all.filter(t => !recent.has(t));
    return pick(fresh.length ? fresh : all);
  }
  function postCard(S, p, angleKey, ride) {
    let mod = 1;
    if (p.heat >= 52) mod *= 1.35;
    if (p.proven && p.fatigue < 45) mod *= 1.12;
    if (p.fatigue >= 52) mod *= 0.55;
    if (ride) mod *= 1.6;
    // keep the topic the player already saw this week for this platform+angle
    const prev = (S.hand || []).find(c => c.pkey === p.key && c.angle === angleKey && c.topic);
    return { kind: ride ? 'ride' : 'post', pkey: p.key, angle: angleKey, topic: prev ? prev.topic : pickTopic(S, angleKey),
             mod, stress: stressCost(S, p.key, angleKey), special: !!ride, ride: !!ride, heat: p.heat, fatigue: p.fatigue, proven: p.proven };
  }
  function buildHand(S) {
    const hand = [], act = activePlats(S);
    let personalUsed = false;
    act.forEach(p => {
      const ride = !!(S.lastHit && S.lastHit.key === p.key && S.week - S.lastHit.week <= 1);
      let angle = 'evergreen';
      if (ride || p.heat >= 40) angle = 'trend';
      else if (S.rep < 50 && !personalUsed) { angle = 'personal'; personalUsed = true; }
      hand.push(postCard(S, p, angle, ride));
    });
    // With ≤3 platforms, add a second angle on the strongest so there's usually a Trend-vs-Evergreen choice.
    const top = strongest(S);
    if (top && hand.length <= 3) {
      const have = hand.find(c => c.pkey === top.key);
      hand.push(postCard(S, top, have.angle === 'trend' ? 'evergreen' : 'trend', false));
    }
    if (act.length >= 2) {
      const src = act.slice().sort((a, b) => b.followers - a.followers)[0];
      const dst = act.slice().sort((a, b) => a.followers - b.followers)[0];
      if (src.key !== dst.key && src.followers > 500 && src.heat > 25)
        hand.push({ kind: 'crosspost', src: src.key, dst: dst.key, special: true, stress: 4 });
    }
    const locked = PORDER.map(k => S.plats[k]).filter(p => !p.active && totalFollowers(S) >= PLATFORMS[p.key].unlock);
    if (locked.length) hand.push({ kind: 'start', pkey: locked[0].key, special: true, stress: 8 });
    S.hand = hand;
    return hand;
  }
```

- [ ] **Step 5: Replace `applyMove`:**

```js
  function applyMove(S, m) {
    if (!useSlot(S, 'content')) return L();
    addStress(S, m.stress);
    if (m.kind === 'start') return startPlatform(S, m.pkey);
    if (m.kind === 'crosspost') return crosspost(S, m.src, m.dst);
    return doPost(S, m.pkey, m.angle, m.topic, m.mod);
  }
```

`doPost` still has the old signature until Task 6 — the `applyMove` test above only checks slots/stress/refusal, and the old `doPost` will run (it references `S.skill`/`S.energy` which are `undefined` → `NaN` gains; harmless for this task).

- [ ] **Step 6: Export** `AORDER, TOPICS,` after `ANGLES,` and `pickTopic,` before `buildHand,`.

- [ ] **Step 7: Run tests** — `npm test` → `24/24 passed`.

- [ ] **Step 8: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed engine: angles, 90 topic lines, dealt hand with slots

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `doPost` — views → followers → revenue

**Files:**
- Modify: `the-feed-engine.js` (`doPost`, `startPlatform`, `crosspost`)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write failing tests**

```js
// ---------------------------------------------------------------- doPost
function firstCard(S, angle) { return E.buildHand(S).find(c => c.kind === 'post' && c.angle === angle); }
test('doPost produces views, followers, revenue and a written feed line', () => {
  const S = mk(); const c = firstCard(S, 'evergreen');
  const f0 = S.plats.longform.followers, cash0 = S.cash;
  const log = E.doPost(S, 'longform', 'evergreen', c.topic, 1);
  assert.ok(S.totalViews > 500, 'views ' + S.totalViews);
  assert.ok(S.plats.longform.followers > f0);
  assert.ok(S.cash >= cash0);
  assert.strictEqual(S.newFollowers, S.plats.longform.followers - f0);
  const line = log.feed[0].text;
  assert.ok(line.startsWith(`‘${c.topic}’`), line);
  assert.match(line, /did [\d.]+K? views on Longform Video — \+[\d.]+K? followers/);
  assert.ok(!/!\./.test(line), 'no double punctuation');
  assert.deepStrictEqual(S.usedTopics, [{ topic: c.topic, week: 1 }]);
});
test('trend: more views, fewer followers per view, tags the cohort', () => {
  E.setRng(seeded(7)); const A = mk(); E.doPost(A, 'longform', 'trend', 'x', 1);
  E.setRng(seeded(7)); const B = mk(); E.doPost(B, 'longform', 'evergreen', 'x', 1);
  assert.ok(A.totalViews > B.totalViews);
  assert.ok(A.plats.longform.followers < B.plats.longform.followers);
  assert.strictEqual(A.plats.longform.trendFollowers, A.plats.longform.followers - 40);
  assert.strictEqual(B.plats.longform.trendFollowers, 0);
});
test('evergreen pushes a 4-week tail; others do not', () => {
  const S = mk(); E.doPost(S, 'longform', 'evergreen', 't', 1);
  assert.strictEqual(S.tails.length, 1);
  assert.deepStrictEqual(Object.keys(S.tails[0]).sort(), ['pkey', 'topic', 'views', 'weeksLeft']);
  assert.strictEqual(S.tails[0].weeksLeft, E.CONFIG.tailWeeks);
  E.doPost(S, 'longform', 'trend', 't2', 1); assert.strictEqual(S.tails.length, 1);
});
test('personal raises rep on a normal post', () => {
  // seed chosen so badChance (8%) does not fire on the first draw
  let S, r0; for (let seed = 1; seed < 50; seed++) { E.setRng(seeded(seed)); S = mk(); r0 = S.rep; E.doPost(S, 'longform', 'personal', 't', 1); if (S.rep > r0) break; }
  assert.ok(S.rep > r0, 'a seed in 1..49 should produce a normal personal post');
});
test('a hit sets lastHit/proven and raises heat by the angle range', () => {
  let S, hitLog; for (let seed = 1; seed < 200; seed++) { E.setRng(seeded(seed)); S = mk(); hitLog = E.doPost(S, 'longform', 'trend', 't', 1); if (S.lastHit) break; }
  assert.ok(S.lastHit && S.lastHit.key === 'longform'); assert.ok(S.plats.longform.proven);
  assert.ok(S.plats.longform.heat >= 12 && S.plats.longform.heat <= 20, 'heat ' + S.plats.longform.heat);
  assert.ok(hitLog.feed[0].text.endsWith('It took off.'));
});
test('fumes band reduces views', () => {
  E.setRng(seeded(3)); const A = mk(); E.doPost(A, 'longform', 'evergreen', 't', 1);
  E.setRng(seeded(3)); const B = mk(); B.stress = 75; E.doPost(B, 'longform', 'evergreen', 't', 1);
  assert.ok(Math.abs(B.totalViews / A.totalViews - E.CONFIG.fumesViewsMult) < 0.02);
});
```

- [ ] **Step 2: Run — expect failures.**

- [ ] **Step 3: Rewrite `doPost`** (replace the whole function):

```js
  // ======================= applying content moves =======================
  // views -> followers -> money. Views are the per-post output (shown in the feed,
  // summed into S.totalViews); followers are the persistent number; ad revenue is views × rpm.
  function doPost(S, k, angleKey, topic, mod) {
    const p = S.plats[k], pf = PLATFORMS[k], A = ANGLES[angleKey], before = platTier(S, p);
    const q = 22 + rnd(4, 18);
    const heatF = 1 + p.heat / 45, luck = rnd(.55, 1.6);
    const sizeF = 1 + CONFIG.sizeMax * p.followers / (p.followers + CONFIG.sizeSat); // saturating, no runaway
    const views = Math.max(1, Math.round(q * heatF * sizeF * pf.viral * NICHES[S.niche].viral * A.views * (mod || 1)
                  * clamp(1 - p.fatigue / 160, .5, 1) * luck * CONFIG.viewsK * viewsMult(S, k)));
    const gain = Math.round(views * CONFIG.baseConv * pf.loyal * A.conv);
    const rev = Math.round(views * pf.rpm);
    p.followers += gain; if (A.cohort) p.trendFollowers += gain;
    S.newFollowers += gain; S.totalViews += views; S.cash += rev;
    p.posts++; p.lastPost = S.week; p.fatigue = clamp(p.fatigue + rint(10, 20), 0, 100);
    const hit = luck > 1.12;
    p.heat = clamp(p.heat + (hit ? rint(A.heatHit[0], A.heatHit[1]) : -rint(0, 3)), 0, 100);
    if (hit) { p.proven = true; S.lastHit = { key: k, week: S.week }; }
    if (A.rep) S.rep = clamp(S.rep + rint(A.rep[0], A.rep[1]), 0, 100);
    let repHit = 0;
    if (A.badChance && chance(A.badChance)) { repHit = rint(A.badRep[0], A.badRep[1]); S.rep = clamp(S.rep - repHit, 0, 100); }
    if (A.tail) S.tails.push({ pkey: k, topic, views, weeksLeft: CONFIG.tailWeeks });
    S.usedTopics.push({ topic, week: S.week });

    const log = L();
    log.floats.push({ anchor: 'plat:' + k, text: '+' + fmt(gain), tone: hit ? 'hit' : 'gain' });
    if (rev > 0) log.floats.push({ anchor: 'cash', text: '+' + money(rev), tone: 'cash' });
    log.feed.push({ emoji: pf.emoji, text: `‘${topic}’ did ${fmt(views)} views on ${pf.name} — +${fmt(gain)} followers${rev > 0 ? ', +' + money(rev) : ''}.${hit ? ' It took off.' : ''}`, kind: hit ? 'good' : '' });
    if (hit) log.feed.push({ emoji: '🔥', text: `${pf.name} is hot right now — ride it next week before it cools.`, kind: 'big' });
    if (repHit) { log.floats.push({ anchor: 'rep', text: '-' + repHit, tone: 'loss' }); log.feed.push({ emoji: '😬', text: `‘${topic}’ ${A.bad} Rep −${repHit}.`, kind: 'bad' }); }
    log.bump.push(k);
    if (platTier(S, p) > before) log.feed.push({ emoji: '📈', text: `Your ${pf.name} leveled up to ${TIERS[platTier(S, p)]} — it looks more professional now.`, kind: 'good' });
    return log;
  }
```

`startPlatform` and `crosspost` are unchanged except: in `crosspost`, after `dst.followers += moved;` add `S.newFollowers += moved;` (so membership recompute sees them).

- [ ] **Step 4: Run tests** — `npm test` → `30/30 passed`. If the "personal raises rep" or "hit" tests can't find a seed, widen the seed loop rather than weakening the assertion.

- [ ] **Step 5: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed engine: doPost as views -> followers -> revenue with angles

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `settleWeek` — tails, membership, overhead, churn, stress bands

**Files:**
- Modify: `the-feed-engine.js` (`settleWeek`)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write failing tests**

```js
// ---------------------------------------------------------------- settleWeek
test('settleWeek returns a log and charges overhead, tracking the peak', () => {
  const S = mk(); const cash0 = S.cash;
  const log = E.settleWeek(S);
  assert.ok(log && Array.isArray(log.feed));
  assert.strictEqual(S.cash, cash0 - E.overhead(S));
  assert.strictEqual(S.peakOverhead, E.overhead(S));
});
test('evergreen tails pay out 15% of views for 4 weeks then expire', () => {
  const S = mk(); S.slots.content = 0; // no empty-slot bonus noise
  S.tails.push({ pkey: 'longform', topic: 'T', views: 10000, weeksLeft: 4 });
  const f0 = S.plats.longform.followers, cash0 = S.cash;
  const log = E.settleWeek(S);
  const expectedGain = Math.round(1500 * E.CONFIG.baseConv * E.PLATFORMS.longform.loyal * E.ANGLES.evergreen.conv);
  assert.strictEqual(S.plats.longform.followers - f0 + Math.round(f0 * E.CONFIG.churnBase), expectedGain, 'tail gain (after base churn)');
  assert.strictEqual(S.totalViews, 1500);
  assert.ok(S.cash > cash0 - E.overhead(S), 'tail revenue landed');
  assert.ok(log.feed.some(f => /still getting found/.test(f.text)));
  assert.strictEqual(S.tails[0].weeksLeft, 3);
  S.tails[0].weeksLeft = 1; E.settleWeek(S); assert.strictEqual(S.tails.length, 0);
});
test('membership recomputes weekly: grows with new followers, churns, churns double when idle', () => {
  const S = mk(); S.members = 1000; S.newFollowers = 4000; S.plats.longform.lastPost = S.week;
  E.settleWeek(S);
  assert.strictEqual(S.members, Math.round(1000 + 4000 * .025 - 1000 * .03));
  assert.strictEqual(S.newFollowers, 0, 'reset each week');
  const T = mk(); T.members = 1000; T.plats.longform.lastPost = -9;
  E.settleWeek(T); assert.strictEqual(T.members, 1000 - 60);
});
test('membership income = members × memberRate', () => {
  const S = mk(); S.members = 100; S.plats.longform.lastPost = S.week; const cash0 = S.cash;
  E.settleWeek(S);
  assert.strictEqual(S.cash, cash0 + Math.round(97 * E.CONFIG.memberRate) - E.overhead(S));
});
test('churn: base, trend cohort at 2x, idle at churnIdle, feed line only when >1%', () => {
  const S = mk(); S.plats.longform.followers = 10000; S.plats.longform.trendFollowers = 2000; S.plats.longform.lastPost = S.week;
  const log = E.settleWeek(S);
  assert.strictEqual(S.plats.longform.followers, 10000 - Math.round(8000 * .006) - Math.round(2000 * .012));
  assert.strictEqual(S.plats.longform.trendFollowers, 2000 - Math.round(2000 * .012));
  assert.ok(!log.feed.some(f => /unfollowed/.test(f.text)), 'small churn is silent');
  const T = mk(); T.plats.longform.followers = 10000; T.plats.longform.lastPost = T.week - 3; T.week = 4;
  const log2 = E.settleWeek(T);
  assert.strictEqual(T.plats.longform.followers, 10000 - Math.round(10000 * .02));
  assert.ok(log2.feed.some(f => /unfollowed/.test(f.text)), 'idle churn is loud');
});
test('stress recovers 12 + 8 per empty content slot; bands log on change; redline streak counts', () => {
  const S = mk(); S.stress = 60; S.slots.content = 2;
  let log = E.settleWeek(S); assert.strictEqual(S.stress, 60 - 12 - 16);
  assert.ok(log.feed.some(f => /stress/i.test(f.text)), 'band went hot→normal, logged');
  assert.strictEqual(S.band, 'normal');
  S.stress = 95; S.slots.content = 0; log = E.settleWeek(S);
  assert.strictEqual(S.stress, 83); assert.strictEqual(S.band, 'fumes'); assert.strictEqual(S.redlineStreak, 0, 'ended the week below 90');
  S.stress = 100; E.settleWeek(S); assert.strictEqual(S.redlineStreak, 1);
  S.stress = 100; E.settleWeek(S); assert.strictEqual(S.redlineStreak, 2);
  S.stress = 60; E.settleWeek(S); assert.strictEqual(S.redlineStreak, 0, 'streak resets');
});
```

- [ ] **Step 2: Run — expect failures.**

- [ ] **Step 3: Rewrite `settleWeek`** (replace the function):

```js
  // ======================= weekly orchestration =======================
  const BAND_MSG = {
    normal:  { emoji: '😮‍💨', text: 'Stress is back under control. Good.', kind: 'good' },
    hot:     { emoji: '🌡️', text: 'You\'re running hot. Fine for a week or two — not for a month.', kind: '' },
    fumes:   { emoji: '🥵', text: 'On fumes. Your output is suffering (−15% reach) and you\'re one bad week from the wall.', kind: 'bad' },
    redline: { emoji: '🚨', text: 'REDLINE. Three weeks like this and you\'re done. Leave a slot empty.', kind: 'bad' },
  };
  function settleWeek(S) {
    const log = L();
    let passive = 0;
    // evergreen tails keep earning
    S.tails.forEach(t => {
      const pf = PLATFORMS[t.pkey], p = S.plats[t.pkey];
      const v = Math.round(t.views * CONFIG.tailRate), g = Math.round(v * CONFIG.baseConv * pf.loyal * ANGLES.evergreen.conv);
      p.followers += g; S.newFollowers += g; S.totalViews += v; passive += v * pf.rpm; t.weeksLeft--;
      log.feed.push({ emoji: '🌲', text: `‘${t.topic}’ is still getting found — +${fmt(v)} views this week.`, kind: '' });
    });
    S.tails = S.tails.filter(t => t.weeksLeft > 0);
    // membership: recomputed every week
    if (S.members > 0) {
      const posted = activePlats(S).some(p => p.lastPost === S.week);
      S.members = Math.max(0, Math.round(S.members + S.newFollowers * CONFIG.memberNewConv - S.members * (posted ? CONFIG.memberChurn : CONFIG.memberChurnIdle)));
      passive += S.members * CONFIG.memberRate;
    }
    const oh = overhead(S);
    S.cash += Math.round(passive); S.cash -= oh; S.peakOverhead = Math.max(S.peakOverhead, oh);
    // churn
    let lost = 0;
    activePlats(S).forEach(p => {
      const idle = S.week - p.lastPost >= CONFIG.idleWeeks;
      const trendLoss = Math.round(p.trendFollowers * (idle ? CONFIG.churnIdle : CONFIG.churnTrend));
      const baseLoss = Math.round((p.followers - p.trendFollowers) * (idle ? CONFIG.churnIdle : CONFIG.churnBase));
      p.trendFollowers = Math.max(0, p.trendFollowers - trendLoss);
      p.followers = Math.max(0, p.followers - trendLoss - baseLoss);
      lost += trendLoss + baseLoss;
    });
    if (lost > totalFollowers(S) * 0.01) log.feed.push({ emoji: '👋', text: `${fmt(lost)} people unfollowed this week. Silence and old trend-chasers both bleed.`, kind: 'bad' });
    // heat / fatigue decay
    PORDER.forEach(k => { const p = S.plats[k]; p.heat = clamp(Math.round(p.heat * 0.82) - 2, 0, 100); if (p.lastPost < S.week) p.fatigue = clamp(p.fatigue - 14, 0, 100); });
    // stress: recover, then band + burnout streak
    addStress(S, -(CONFIG.stressRecover + S.slots.content * CONFIG.stressRecoverPerEmptySlot));
    const band = stressBand(S);
    if (band !== S.band) { log.feed.push(BAND_MSG[band]); S.band = band; }
    S.redlineStreak = band === 'redline' ? S.redlineStreak + 1 : 0;
    S.newFollowers = 0;
    return log;
  }
```

- [ ] **Step 4: Run tests** — `npm test` → `36/36 passed`.

- [ ] **Step 5: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed engine: settleWeek with tails, membership recompute, churn, stress bands

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Business actions + events on the new model

**Files:**
- Modify: `the-feed-engine.js` (`biz` object; helpers `repHit`/`loseFollowers`; the whole `EVENTS` array)
- Test: `tools/the-feed-test.js`

- [ ] **Step 1: Write failing tests**

```js
// ---------------------------------------------------------------- business + events
test('engage uses the business slot and adds 5 stress', () => {
  const S = mk(); const r0 = S.rep, s0 = S.stress; E.biz.engage(S);
  assert.ok(S.rep > r0); assert.strictEqual(S.stress, s0 + 5); assert.strictEqual(S.slots.business, 0);
  const r1 = S.rep; E.biz.engage(S); assert.strictEqual(S.rep, r1, 'refused without slot');
});
test('deal: gated at 1K, pays more at high rep, manager boosts pay and softens rep cost', () => {
  const S = mk(); S.plats.longform.followers = 500; E.biz.deal(S); assert.strictEqual(S.deals, 0);
  S.plats.longform.followers = 10000;
  E.setRng(seeded(5)); const lo = mk(); lo.plats.longform.followers = 10000; lo.rep = 40; const c0 = lo.cash; E.biz.deal(lo);
  E.setRng(seeded(5)); const hi = mk(); hi.plats.longform.followers = 10000; hi.rep = 80; const c1 = hi.cash; E.biz.deal(hi);
  assert.ok(Math.abs((hi.cash - c1) / (lo.cash - c0) - 1.5) < 0.01, 'rep 80 pays 1.5x rep 40');
  E.setRng(seeded(5)); const m = mk(); m.plats.longform.followers = 10000; m.rep = 80; m.hires.manager = true; const c2 = m.cash; E.biz.deal(m);
  assert.ok(Math.abs((m.cash - c2) / (hi.cash - c1) - 1.3) < 0.01, 'manager 1.3x');
  assert.ok((80 - m.rep) < (80 - hi.rep), 'manager softens rep cost');
  assert.strictEqual(m.stress, E.CONFIG.startStress + 4);
});
test('paid membership: gated, once, uses the slot', () => {
  const S = mk(); E.biz.paid(S); assert.strictEqual(S.members, 0);
  S.plats.longform.followers = 2000; E.biz.paid(S); assert.ok(S.members >= 40 && S.members <= 90); assert.strictEqual(S.slots.business, 0);
  S.slots.business = 1; const m = S.members; E.biz.paid(S); assert.strictEqual(S.members, m, 'only once');
});
test('grind no longer exists', () => { assert.strictEqual(E.biz.grind, undefined); assert.strictEqual(E.biz.rest, undefined); });
test('loseFollowers takes a % of the strongest platform, halved by a mod, shrinks cohort proportionally', () => {
  const S = mk(); S.plats.longform.followers = 10000; S.plats.longform.trendFollowers = 5000;
  assert.strictEqual(E.loseFollowers(S, 0.10, 0.10), 1000);
  assert.strictEqual(S.plats.longform.followers, 9000); assert.strictEqual(S.plats.longform.trendFollowers, 4500);
  S.hires.mod = true; assert.strictEqual(E.loseFollowers(S, 0.10, 0.10), 450);
});
test('repHit is softened to 2/3 by a mod', () => {
  const S = mk(); S.rep = 60; E.repHit(S, 9, 9); assert.strictEqual(S.rep, 51);
  S.hires.mod = true; E.repHit(S, 9, 9); assert.strictEqual(S.rep, 45);
});
test('health event triggers on stress and moves stress', () => {
  const ev = E.EVENTS.find(e => /slept/.test(e.title));
  const S = mk(); S.stress = 59; assert.strictEqual(ev.cond(S), false); S.stress = 60; assert.strictEqual(ev.cond(S), true);
  const push = ev.choices.find(c => c.t === 'escalate'), rest = ev.choices.find(c => c.t === 'repair');
  push.apply(S); assert.strictEqual(S.stress, 72);
  rest.apply(S); assert.strictEqual(S.stress, 42);
});
test('every hostile escalate outcome costs followers', () => {
  E.EVENTS.filter(e => e.kind === 'hostile').forEach(ev => {
    const esc = ev.choices.find(c => c.t === 'escalate');
    // run until we hit a 'bad' outcome (some escalations are coin flips)
    let lostAny = false;
    for (let seed = 1; seed < 40 && !lostAny; seed++) { E.setRng(seeded(seed)); const S = mk(); S.week = 20; S.rep = 80; S.plats.longform.followers = 10000; const log = esc.apply(S); if (log.feed[0].kind === 'bad') lostAny = S.plats.longform.followers < 10000; }
    assert.ok(lostAny, ev.title);
  });
});
test('no engine code references energy or skill', () => {
  const src = require('fs').readFileSync(require.resolve('../the-feed-engine.js'), 'utf8');
  assert.ok(!/S\.energy|S\.skill|skillCap|\brent\(/.test(src));
});
```

- [ ] **Step 2: Run — expect failures.**

- [ ] **Step 3: Add the two event helpers** right after `viewsMult`/`stressCost`/`upgradeInfo`:

```js
  // --- damage helpers used by events; the community mod softens both ---
  function repHit(S, lo, hi) { const n = Math.round(rint(lo, hi) * (S.hires.mod ? 0.67 : 1)); S.rep = clamp(S.rep - n, 0, 100); return n; }
  function loseFollowers(S, fracLo, fracHi) {
    const p = strongest(S); if (!p) return 0;
    const n = Math.round(p.followers * rnd(fracLo, fracHi) * (S.hires.mod ? 0.5 : 1));
    const cohortShare = p.followers ? p.trendFollowers / p.followers : 0;
    p.followers -= n; p.trendFollowers = Math.max(0, Math.round(p.trendFollowers - n * cohortShare));
    return n;
  }
```

- [ ] **Step 4: Rewrite the `biz` object** (replace whole object; keep the `hire`/`fire`/`upgrade` bodies from Tasks 3–4):

```js
  // ======================= business actions (one per week) =======================
  const biz = {
    engage(S) { if (!useSlot(S, 'business')) return L(); addStress(S, 5); const r = rnd(2, 5); S.rep = clamp(S.rep + r, 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat + rint(1, 4), 0, 100));
      const log = L(); log.floats.push({ anchor: 'rep', text: '+' + r.toFixed(1), tone: 'up' });
      log.feed.push({ emoji: '💬', text: 'Showed up in the comments and DMs. The core crowd feels seen.', kind: 'good' }); return log; },
    deal(S) { if (totalFollowers(S) < 1000 || !useSlot(S, 'business')) return L(); addStress(S, 4);
      const repMult = 0.6 + S.rep / 100, mgr = S.hires.manager;
      const pay = Math.round((CONFIG.dealBase + totalFollowers(S) * CONFIG.dealScale) * NICHES[S.niche].deal * repMult * (mgr ? 1.3 : 1));
      const h = rnd(4, 9) * (mgr ? 0.6 : 1);
      S.cash += pay; S.rep = clamp(S.rep - h, 0, 100); S.deals++;
      const log = L(); log.floats.push({ anchor: 'cash', text: '+' + money(pay), tone: 'cash' }); log.floats.push({ anchor: 'rep', text: '-' + h.toFixed(0), tone: 'loss' });
      log.feed.push({ emoji: '🤝', text: `Ran a sponsored segment. +${money(pay)}${mgr ? ' (your manager negotiated)' : ''} — some fans smell the sellout.`, kind: '' }); return log; },
    upgrade(S) { /* body from Task 4 */ },
    paid(S) { if (S.members > 0 || totalFollowers(S) < CONFIG.paidUnlock || !useSlot(S, 'business')) return L();
      S.members = Math.round(totalFollowers(S) * rnd(CONFIG.memberConvMin, CONFIG.memberConvMax));
      const log = L(); log.feed.push({ emoji: '⭐', text: `Launched a paid membership. ${fmt(S.members)} true fans signed up — recurring income, as long as you keep showing up.`, kind: 'good' }); return log; },
    hire(S, role) { /* body from Task 3 */ },
    fire(S, role) { /* body from Task 3 */ },
  };
```

(Where a comment says "body from Task N", paste that task's code — do not leave the comment.)

- [ ] **Step 5: Rewrite the `EVENTS` array.** Replace the whole array. Changes from the original: energy → stress via `addStress`; every hostile `bad` outcome calls `repHit` and `loseFollowers` and appends the follower loss to the text; the health event conditions on stress.

```js
  // ======================= events (single deck: display + effect) =======================
  // choice.t ∈ repair | neutral | escalate  (personas pick by this tag)
  // choice.apply(S) -> effect log
  const fed = (e, t, k) => { const log = L(); log.feed.push({ emoji: e, text: t, kind: k || '' }); return log; };
  // a "bad" outcome that also costs followers on your biggest channel
  const hurt = (S, e, t, fracLo, fracHi) => { const n = loseFollowers(S, fracLo, fracHi); const log = fed(e, `${t} −${fmt(n)} followers.`, 'bad'); if (n) log.floats.push({ anchor: 'plat:' + strongest(S).key, text: '-' + fmt(n), tone: 'loss' }); return log; };
  const EVENTS = [
    { kind: 'neutral', emoji: '🚀', title: 'A post is going viral right now.', badge: 'Momentum', cond: () => true,
      text: 'One upload is spiking to people who have never heard of you. The window is open.',
      choices: [
        { t: 'repair', ci: '🌊', label: 'Ride it across every platform', desc: 'Cross-promote hard. Costs stress, huge upside.',
          apply: S => { const g = Math.round(rnd(2000, 8000) * (1 + totalFollowers(S) / 40000)); const p = strongest(S); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 22, 0, 100); addStress(S, 10); S.lastHit = { key: p.key, week: S.week };
            const log = fed('🚀', `You rode it hard. +${fmt(g)} followers and the buzz is roaring.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } },
        { t: 'neutral', ci: '😌', label: 'Let it breathe', desc: 'Take the smaller bump, keep your head.',
          apply: S => { const p = strongest(S); const g = Math.round(rnd(600, 2000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 8, 0, 100);
            const log = fed('🌊', `Didn't force it. +${fmt(g)} followers, stress intact.`, 'good'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'gain' }); log.bump.push(p.key); return log; } },
      ] },
    { kind: 'neutral', emoji: '🔄', title: 'The platform changed its algorithm overnight.', badge: 'Platform shift', cond: () => true,
      text: 'The rules just changed. Nobody knows what the feed rewards anymore.',
      choices: [
        { t: 'repair', ci: '📡', label: 'Chase the new format fast', desc: 'Adapt aggressively. Coin flip.',
          apply: S => { if (chance(.55)) { activePlats(S).forEach(p => p.heat = clamp(p.heat + 16, 0, 100)); return fed('📡', 'You cracked the new format early. Buzz surged everywhere.', 'big'); } activePlats(S).forEach(p => p.heat = clamp(p.heat - 13, 0, 100)); return fed('📉', 'Guessed wrong. Reach cratered across the board this week.', 'bad'); } },
        { t: 'neutral', ci: '🎯', label: 'Keep doing your thing', desc: 'Stay the course.',
          apply: S => { activePlats(S).forEach(p => p.heat = clamp(p.heat - 7, 0, 100)); S.rep = clamp(S.rep + 3, 0, 100); return fed('🎯', "Didn't chase it. Reach dipped, but the loyal ones stayed.", ''); } },
      ] },
    { kind: 'neutral', emoji: '🎁', title: 'A fan sends $500 and a note.', badge: 'Wholesome', cond: () => true,
      text: '"Your stuff got me through a hard year." It lands harder than any metric.',
      choices: [
        { t: 'repair', ci: '💖', label: 'Shout them out', desc: 'Feature the note. The community glows.',
          apply: S => { S.cash += 500; S.rep = clamp(S.rep + rint(4, 9), 0, 100); addStress(S, -5); const log = fed('💖', 'You shared it. +$500 and a wave of goodwill.', 'good'); log.floats.push({ anchor: 'cash', text: '+$500', tone: 'cash' }); return log; } },
        { t: 'neutral', ci: '🙏', label: 'Thank them privately', desc: 'Keep it personal.',
          apply: S => { S.cash += 500; S.rep = clamp(S.rep + 3, 0, 100); const log = fed('🙏', 'A quiet thank-you DM. +$500 and a warm feeling.', 'good'); log.floats.push({ anchor: 'cash', text: '+$500', tone: 'cash' }); return log; } },
      ] },
    { kind: 'neutral', emoji: '💸', title: 'A crypto brand slides into your DMs.', badge: 'Sponsor', cond: () => true,
      text: '"$$$ for one video. No disclosure needed 😉." Big bag, bad vibe.',
      choices: [
        { t: 'escalate', ci: '💰', label: 'Take the bag', desc: "Cash now. Your audience won't forget.",
          apply: S => { const p = Math.round(rnd(900, 2400)); S.cash += p; const r = repHit(S, 12, 22); S.deals++; const log = hurt(S, '💸', `Cashed it: +${money(p)}. The comments are rough. Rep −${r}.`, .01, .03); log.floats.push({ anchor: 'cash', text: '+' + money(p), tone: 'cash' }); return log; } },
        { t: 'repair', ci: '🛡️', label: 'Decline on camera', desc: 'Fans respect the integrity.',
          apply: S => { S.rep = clamp(S.rep + rint(6, 12), 0, 100); return fed('🛡️', 'You called it out publicly. Reputation up.', 'good'); } },
      ] },
    // ---- hostile sub-deck: repair / neutral / escalate ----
    { kind: 'hostile', emoji: '👹', title: 'A troll swarm hit your comments.', badge: 'Coordinated trolling', cond: () => true,
      text: 'A pile-on is filling every thread with bad-faith garbage. Newcomers see it first.',
      choices: [
        { t: 'repair', ci: '🧹', label: 'Moderate & set boundaries', desc: 'Clean it up, pin a calm reply.',
          apply: S => { addStress(S, 4); S.rep = clamp(S.rep + rint(2, 6), 0, 100); return fed('🧹', 'You cleaned house and stayed measured. The real audience exhaled.', 'good'); } },
        { t: 'neutral', ci: '😐', label: "Ignore, don't feed them", desc: 'Say nothing, keep posting.',
          apply: S => { if (chance(.6)) return fed('😐', 'You starved the trolls. They got bored and left.', ''); const r = repHit(S, 3, 7); return hurt(S, '😕', `Ignoring it let the narrative set in. Rep −${r}.`, .005, .015); } },
        { t: 'escalate', ci: '🤬', label: 'Roast them publicly', desc: 'Clap back hard. High variance.',
          apply: S => { if (chance(.45)) { const p = strongest(S); const g = Math.round(rnd(1200, 5000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 16, 0, 100); const log = fed('🔥', `The roast went viral. +${fmt(g)} followers came for the show.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } const r = repHit(S, 10, 18); return hurt(S, '💀', `It read as punching down. Screenshots everywhere. Rep −${r}.`, .02, .05); } },
      ] },
    { kind: 'hostile', emoji: '⚖️', title: "You're being cancelled over a misread clip.", badge: 'Cancel attempt', cond: S => S.rep > 25,
      text: 'A 12-second clip is circulating out of context. People who never watched you are furious. It\'s trending.',
      choices: [
        { t: 'repair', ci: '🎥', label: 'Post a calm clarification', desc: 'Show the full context, own any real mistake.',
          apply: S => { if (S.rep > 50 || chance(.7)) { S.rep = clamp(S.rep + rint(3, 8), 0, 100); return fed('✅', 'The full context defused it. Level-headed fans defended you.', 'good'); } const r = repHit(S, 4, 9); return hurt(S, '😬', `The clarification helped some, but the clip travelled further than the context. Rep −${r}.`, .01, .02); } },
        { t: 'neutral', ci: '🤐', label: 'Go quiet and wait it out', desc: 'Let the cycle move on.',
          apply: S => { if (chance(.5)) { repHit(S, 2, 6); return fed('🤐', 'You waited. The mob found a new target in a few days.', ''); } const r = repHit(S, 10, 20); activePlats(S).forEach(p => p.heat = clamp(p.heat - 10, 0, 100)); return hurt(S, '📉', `Silence read as guilt. It festered. Rep −${r}.`, .02, .04); } },
        { t: 'escalate', ci: '🗯️', label: 'Deny everything, attack the accusers', desc: 'Refuse to engage in good faith.',
          apply: S => { const r = repHit(S, 14, 26); activePlats(S).forEach(p => p.heat = clamp(p.heat - 8, 0, 100)); return hurt(S, '🌋', `Defiance poured fuel on it. The pile-on doubled. This is how creators get cancelled for real. Rep −${r}.`, .03, .06); } },
      ] },
    { kind: 'hostile', emoji: '⭐', title: "You're getting review-bombed.", badge: 'Brigade', cond: S => totalFollowers(S) > 2000,
      text: 'A brigade from another community is mass-downvoting and one-star-reviewing everything you post.',
      choices: [
        { t: 'repair', ci: '📣', label: 'Rally your real community', desc: 'Ask loyal fans to drown out the noise.',
          apply: S => { addStress(S, 3); const p = strongest(S); p.heat = clamp(p.heat + 8, 0, 100); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('📣', 'Your community showed up and buried the brigade. Solidarity win.', 'good'); } },
        { t: 'neutral', ci: '⏳', label: 'Report and wait', desc: 'Trust the platform to sort it.',
          apply: S => { if (chance(.55)) return fed('⏳', 'Platform caught the coordinated abuse and reversed it. No lasting harm.', ''); const p = strongest(S); p.heat = clamp(p.heat - 9, 0, 100); return hurt(S, '😑', 'The reports went nowhere for now. Reach took a hit.', .005, .015); } },
        { t: 'escalate', ci: '🎯', label: 'Name and target their community', desc: 'Point your audience at them. Starts a war.',
          apply: S => { const r = repHit(S, 8, 16); if (chance(.4)) { const p = strongest(S); const g = Math.round(rnd(800, 3000)); p.followers += g; S.newFollowers += g; const log = fed('⚔️', `Started an all-out war. Messy — but +${fmt(g)} rubberneckers subscribed. Rep −${r}.`, 'bad'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } return hurt(S, '🔥', `The feud spiralled. Both sides look bad; you look worse. Rep −${r}.`, .02, .04); } },
      ] },
    { kind: 'hostile', emoji: '🕵️', title: 'A "receipts" account is digging through your old posts.', badge: 'Callout', cond: S => S.week > 8,
      text: 'Someone is building a thread of your worst old takes, screenshotting everything from years ago.',
      choices: [
        { t: 'repair', ci: '🌱', label: 'Get ahead of it — address the old stuff', desc: 'Acknowledge growth, delete nothing quietly.',
          apply: S => { S.rep = clamp(S.rep + rint(2, 7), 0, 100); return fed('🌱', 'You owned your growth before they could frame it. Mature move, mostly respected.', 'good'); } },
        { t: 'neutral', ci: '😶', label: "Don't dignify it", desc: 'Keep posting like nothing happened.',
          apply: S => { if (chance(.5)) return fed('😶', 'The thread got some traction, then faded. No real damage.', ''); const r = repHit(S, 5, 11); return hurt(S, '🗂️', `The receipts thread stuck around and got quoted. Rep −${r}.`, .01, .02); } },
        { t: 'escalate', ci: '🚫', label: "Mass-delete and deny it's you", desc: 'Scrub everything, gaslight the thread.',
          apply: S => { const r = repHit(S, 12, 22); return hurt(S, '🧨', `People screenshot faster than you can delete. The cover-up became the story. Rep −${r}.`, .02, .05); } },
      ] },
    { kind: 'hostile', emoji: '💔', title: 'A parasocial superfan turned on you.', badge: 'Parasocial', cond: S => totalFollowers(S) > 4000,
      text: "A former top supporter feels personally betrayed you didn't reply, and is now your loudest hater.",
      choices: [
        { t: 'repair', ci: '🫶', label: 'Reach out privately, set kind boundaries', desc: 'Human, but firm about limits.',
          apply: S => { addStress(S, 3); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('🫶', "A gentle, firm DM cooled it. You can't save everyone, but you handled it with grace.", 'good'); } },
        { t: 'neutral', ci: '🚪', label: 'Quietly block and move on', desc: 'Protect your peace.',
          apply: S => fed('🚪', 'You blocked and moved on. A little noise, but your headspace is safer.', '') },
        { t: 'escalate', ci: '📸', label: 'Expose their DMs publicly', desc: 'Post the receipts to humiliate them.',
          apply: S => { if (chance(.5)) { const r = repHit(S, 8, 15); return hurt(S, '😖', `Airing a fan's private breakdown looked cruel. Rep −${r}.`, .01, .03); } const r = repHit(S, 3, 7); return hurt(S, '😐', `Some cheered, many winced. A wash that left a bad taste. Rep −${r}.`, .005, .015); } },
      ] },
    { kind: 'neutral', emoji: '🥵', title: "You haven't slept in days.", badge: 'Health', cond: S => S.stress >= 60,
      text: 'The grind is catching up. Your body is sending invoices.',
      choices: [
        { t: 'escalate', ci: '⛽', label: 'Push through it', desc: 'Keep the streak alive. Risky.',
          apply: S => { addStress(S, 12); activePlats(S).forEach(p => p.heat = clamp(p.heat + 5, 0, 100)); return fed('⛽', 'You pushed through. The feed stayed fed — you did not.', 'bad'); } },
        { t: 'repair', ci: '🛌', label: 'Log off and recover', desc: 'Reset stress, lose momentum.',
          apply: S => { addStress(S, -30); activePlats(S).forEach(p => p.heat = clamp(p.heat - 10, 0, 100)); return fed('🛌', 'You logged off for real. Stress dropped, buzz cooled.', 'good'); } },
      ] },
  ];
```

- [ ] **Step 6: Fix the Burnout ending blurb** to use the platform count. In `ENDINGS.burnout`, change `blurb` to a function-friendly template: keep it a string but with `{n}` placeholder:

```js
    burnout: { emoji: '🕯️', kicker: 'Burnout', title: 'You burned all the way out.', blurb: 'The stress redlined and stayed there. Feeding {n} platform{s} at once, you stopped being able to make anything at all.', lesson: 'You cannot feed every platform every week. The creators who last pick their surfaces and protect the one resource nobody tracks.' },
```

and add a helper next to `ENDINGS`, exported:

```js
  // Ending copy with the run's numbers filled in.
  function endingText(S, key) { const e = ENDINGS[key]; const n = activePlats(S).length; return Object.assign({}, e, { blurb: e.blurb.replace('{n}', n).replace('{s}', n === 1 ? '' : 's') }); }
```

- [ ] **Step 7: Export** `repHit, loseFollowers,` after `upgradeInfo,` and `endingText,` after `checkEndings,`.

- [ ] **Step 8: Run tests** — `npm test` → `45/45 passed`. The "no engine code references energy or skill" test is the safety net for anything missed.

- [ ] **Step 9: Update the engine header comment** (top of file) to describe the new weekly sequence:

```
 * Weekly orchestration (both consumers follow the same sequence):
 *   buildHand(S)               deal this week's content cards
 *   applyMove(S, card) / biz.* up to 2 content + 1 business action (slots)
 *   log = settleWeek(S)        tails, membership, overhead, churn, stress bands
 *   ev = rollEvent(S)          maybe draw an event (or null)
 *     if ev: applyEventChoice(S, ev, i) -> log   (browser shows card first)
 *   advanceWeek(S)             week++, slots reset
 *   checkEndings(S)            sets S.over / S.endKey, returns key|null
```

- [ ] **Step 10: Commit**

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed engine: business slot actions, events on stress, hostile events cost followers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Simulator rewritten for slots

**Files:**
- Rewrite: `tools/the-feed-sim.js`

No unit tests for the sim itself — it *is* the test for balance. The check is that it runs and the report renders.

- [ ] **Step 1: Replace `tools/the-feed-sim.js` entirely with:**

```js
#!/usr/bin/env node
/*
 * THE FEED — balance simulator
 * ------------------------------------------------------------------
 * Runs thousands of playthroughs driven by different player "personas"
 * and reports how the balance lands. All game mechanics live in the
 * shared engine (../the-feed-engine.js) — the SAME file the browser game
 * imports — so the sim and the game can never drift. This file only adds
 * the personas, the runner, and the report.
 *
 * Run:   npm run sim                        (500 games per persona)
 *        node tools/the-feed-sim.js 2000    (override games per persona)
 *        node tools/the-feed-sim.js 500 report.html   (also write a dashboard)
 *        SEED=7 npm run sim                 (reproducible run)
 *
 * To change balance, edit CONFIG in ../the-feed-engine.js and re-run.
 * The "BALANCE TARGETS" section at the bottom encodes the spec's exit criteria.
 * ------------------------------------------------------------------
 */
const E = require('../the-feed-engine.js');
const { CONFIG, HORDER, fmt, totalFollowers, activePlats } = E;

if (process.env.SEED) { let s = parseInt(process.env.SEED, 10) >>> 0; E.setRng(() => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }); }
const pick = a => a[Math.floor(Math.random() * a.length)];

// ======================= persona helpers =======================
// A persona's act(S) returns ONE action per call; the runner keeps calling until
// the persona returns {end:true}, a slot runs out, or an action is refused.
//   {card:i} | {biz:'engage'|'deal'|'upgrade'|'paid'} | {hire:'editor'} | {fire:'editor'} | {end:true}
const H = {
  posts(S)            { return S.hand.map((c, i) => ({ c, i })).filter(x => x.c.kind === 'post' || x.c.kind === 'ride'); },
  ride(S)             { return S.hand.findIndex(c => c.kind === 'ride'); },
  cross(S)            { return S.hand.findIndex(c => c.kind === 'crosspost'); },
  start(S)            { return S.hand.findIndex(c => c.kind === 'start'); },
  byAngle(S, a)       { const x = H.posts(S).find(x => x.c.angle === a); return x ? x.i : -1; },
  heaviest(S)         { const x = H.posts(S).sort((a, b) => b.c.stress - a.c.stress)[0]; return x ? x.i : -1; },
  lightest(S)         { const x = H.posts(S).sort((a, b) => a.c.stress - b.c.stress)[0]; return x ? x.i : -1; },
  bestMod(S)          { const x = H.posts(S).sort((a, b) => (b.c.mod * (1 - b.c.fatigue / 200)) - (a.c.mod * (1 - a.c.fatigue / 200)))[0]; return x ? x.i : -1; },
  coldest(S)          { const x = H.posts(S).sort((a, b) => a.c.heat - b.c.heat)[0]; return x ? x.i : -1; },
  canPaid(S)          { return S.members === 0 && totalFollowers(S) >= CONFIG.paidUnlock; },
  canDeal(S)          { return totalFollowers(S) >= 1000; },
  nextHire(S, order)  { return order.find(r => !S.hires[r] && E.hireInfo(S, r).ok && S.cash > E.HIRES[r].sign * 4) || null; },
  upgradeOk(S, mult)  { const u = E.upgradeInfo(S); return u.ok && u.next <= 3 && S.cash > u.cost * mult; },
  studioOk(S, cash)   { const u = E.upgradeInfo(S); return u.ok && u.next === 4 && S.cash > cash; },
};
const content = S => S.slots.content > 0, business = S => S.slots.business > 0;

// ======================= personas =======================
const PERSONAS = {
  // Two heavy posts every week, never hires, never rests. Should burn out — but not before ~15 weeks.
  'The Grinder': { home: 'longform', eventPref: ['neutral', 'repair', 'escalate'], act(S) {
    if (content(S)) { const i = H.heaviest(S); if (i >= 0) return { card: i }; }
    if (business(S)) { if (H.upgradeOk(S, 1.2)) return { biz: 'upgrade' }; return { biz: 'engage' }; }
    return { end: true };
  } },
  // One light post a week. Never hires, never deals. Should mostly Fade, rarely go Broke.
  'The Minimalist': { home: 'micro', eventPref: ['neutral', 'repair', 'escalate'], act(S) {
    if (S.slots.content === CONFIG.slotsContent) { const i = H.lightest(S); if (i >= 0) return { card: i }; }
    return { end: true };
  } },
  // Launches every platform it can, spreads posts to the coldest channels.
  'The Diversifier': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    if (content(S)) { const st = H.start(S); if (st >= 0) return { card: st }; if (S.stress < 70) { const i = H.coldest(S); if (i >= 0) return { card: i }; } }
    if (business(S)) { if (H.canPaid(S)) return { biz: 'paid' }; if (S.rep < 55) return { biz: 'engage' }; }
    return { end: true };
  } },
  // Deals every week it can, chases trends, buys gear early. Should Sell Out / get Cancelled a lot.
  'The Hustler': { home: 'shortform', eventPref: ['escalate', 'neutral', 'repair'], act(S) {
    if (business(S)) { if (H.canDeal(S)) return { biz: 'deal' }; if (H.upgradeOk(S, 1.5)) return { biz: 'upgrade' }; }
    if (content(S)) { let i = H.byAngle(S, 'trend'); if (i < 0) i = H.bestMod(S); if (i >= 0) return { card: i }; }
    return { end: true };
  } },
  // Watches stress, favours evergreen, hires an editor + mod, never buys the Studio. Target: Niche Legend.
  'The Sustainable': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    if (content(S)) {
      const heavyOk = S.stress < 50, anyOk = S.stress < 65;
      if (S.slots.content === CONFIG.slotsContent || heavyOk) {
        if (anyOk) { const r = H.ride(S); if (r >= 0) return { card: r }; let i = H.byAngle(S, 'evergreen'); if (i < 0) i = H.lightest(S); if (i >= 0 && (heavyOk || S.hand[i].stress <= 10)) return { card: i }; }
      }
    }
    if (business(S)) {
      if (H.canPaid(S)) return { biz: 'paid' };
      if (S.rep < 62) return { biz: 'engage' };
      const h = H.nextHire(S, ['editor', 'mod']); if (h) return { hire: h };
      if (H.upgradeOk(S, 3)) return { biz: 'upgrade' };
    }
    return { end: true };
  } },
  // Random legal actions.
  'The Chaos Gremlin': { eventPref: null, act(S) {
    const opts = [{ end: true }, { end: true }];
    if (content(S)) S.hand.forEach((c, i) => opts.push({ card: i }));
    if (business(S)) { opts.push({ biz: 'engage' }); if (H.canDeal(S)) opts.push({ biz: 'deal' }); if (E.upgradeInfo(S).ok) opts.push({ biz: 'upgrade' }); if (H.canPaid(S)) opts.push({ biz: 'paid' }); const h = HORDER.find(r => E.hireInfo(S, r).ok); if (h) opts.push({ hire: h }); }
    return pick(opts);
  } },
  // Plays well: rides hits, manages stress, hires everyone, buys the Studio. Target: Star/GOAT.
  'The Optimizer': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    if (content(S)) {
      const budget = S.stress >= 80 ? 0 : S.stress >= 60 ? 1 : 2;
      if (CONFIG.slotsContent - S.slots.content < budget) {
        const r = H.ride(S); if (r >= 0) return { card: r };
        const x = H.cross(S); if (x >= 0) return { card: x };
        const st = H.start(S); if (st >= 0 && activePlats(S).length < 4) return { card: st };
        const i = H.bestMod(S); if (i >= 0) return { card: i };
      }
    }
    if (business(S)) {
      if (H.canPaid(S)) return { biz: 'paid' };
      if (S.cash < 300 && H.canDeal(S)) return { biz: 'deal' };
      if (H.studioOk(S, 20000)) return { biz: 'upgrade' };
      const h = H.nextHire(S, ['editor', 'designer', 'manager', 'mod']); if (h) return { hire: h };
      if (H.upgradeOk(S, 2.5)) return { biz: 'upgrade' };
      if (S.rep < 50) return { biz: 'engage' };
      // fire the most expensive hire if the lease is drowning us
      if (S.cash < -600 && E.hireCount(S) > 0) return { fire: HORDER.filter(r => S.hires[r]).sort((a, b) => E.HIRES[b].weekly - E.HIRES[a].weekly)[0] };
    }
    return { end: true };
  } },
};

// ======================= run one game =======================
function resolveEvent(S, ev, persona) {
  const prefs = persona.eventPref || ['repair', 'neutral', 'escalate'];
  let idx = -1;
  for (const tag of prefs) { idx = ev.choices.findIndex(c => c.t === tag); if (idx >= 0) break; }
  if (idx < 0) idx = Math.floor(Math.random() * ev.choices.length);
  E.applyEventChoice(S, ev, idx);
}
function playWeek(S, persona) {
  E.buildHand(S);
  for (let t = 0; t < 8; t++) {
    const a = persona.act(S);
    if (!a || a.end) break;
    const before = S.slots.content + S.slots.business;
    if (a.card != null) { const c = S.hand[a.card]; if (!c) break; E.applyMove(S, c); }
    else if (a.biz) E.biz[a.biz](S);
    else if (a.hire) E.biz.hire(S, a.hire);
    else if (a.fire) E.biz.fire(S, a.fire);
    if (S.slots.content + S.slots.business === before) break; // refused → persona is stuck, end the week
    E.buildHand(S);
  }
  E.settleWeek(S);
  const ev = E.rollEvent(S);
  if (ev) resolveEvent(S, ev, persona);
  E.advanceWeek(S);
  E.checkEndings(S);
}
function playGame(persona) {
  const niche = persona.niche || pick(Object.keys(E.NICHES));
  const home = persona.home || pick(['longform', 'shortform', 'micro']);
  const S = E.newState(niche, home);
  let safety = 0;
  while (!S.over && safety++ < 200) playWeek(S, persona);
  const weeks = Math.min(S.week - 1, CONFIG.years);
  return { end: S.endKey || 'faded', week: weeks, followers: totalFollowers(S), views: S.totalViews, viewsPerWeek: Math.round(S.totalViews / Math.max(1, weeks)),
           cash: S.cash, rep: Math.round(S.rep), deals: S.deals, platforms: activePlats(S).length, members: S.members,
           hires: E.hireCount(S), studio: E.hasStudio(S), peakOverhead: S.peakOverhead };
}

// ======================= aggregation & report =======================
const ENDING_ORDER = ['goat', 'star', 'legend', 'faded', 'sellout', 'burnout', 'bankrupt', 'cancelled'];
const ENDING_LABEL = { goat: '👑 GOAT', star: '🌟 Viral Star', legend: '🏆 Niche Legend', faded: '🌫️ Faded Out',
  sellout: '🤑 Sold Out', burnout: '🕯️ Burnout', bankrupt: '💸 Broke', cancelled: '📛 Cancelled' };
const median = arr => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const pct = (n, d) => d ? 100 * n / d : 0;

function runSuite(N) {
  const results = {};
  for (const [name, persona] of Object.entries(PERSONAS)) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(playGame(persona));
    const dist = {}; ENDING_ORDER.forEach(k => dist[k] = 0);
    runs.forEach(r => dist[r.end]++);
    results[name] = { runs, dist,
      medFollowers: median(runs.map(r => r.followers)), medCash: median(runs.map(r => r.cash)), medWeek: median(runs.map(r => r.week)),
      medRep: median(runs.map(r => r.rep)), medPlatforms: median(runs.map(r => r.platforms)), medViewsWk: median(runs.map(r => r.viewsPerWeek)),
      medHires: median(runs.map(r => r.hires)), studioPct: pct(runs.filter(r => r.studio).length, N) };
  }
  return results;
}

function printReport(results, N) {
  const bar = p => { const n = Math.round(p / 5); return '█'.repeat(n) + '·'.repeat(20 - n); };
  console.log('\n' + '='.repeat(78));
  console.log(`  THE FEED — balance report   (${N} games per persona, ${N * Object.keys(PERSONAS).length} total)`);
  console.log('='.repeat(78));
  for (const [name, r] of Object.entries(results)) {
    console.log(`\n▓ ${name}`);
    console.log(`  median: ${fmt(r.medFollowers)} followers · ${fmt(r.medViewsWk)} views/wk · $${r.medCash.toLocaleString()} · rep ${r.medRep} · ${r.medPlatforms} plat · ${r.medHires} hires · studio ${r.studioPct.toFixed(0)}% · ${r.medWeek}w`);
    ENDING_ORDER.forEach(k => { const p = pct(r.dist[k], N); if (p > 0) console.log(`    ${ENDING_LABEL[k].padEnd(16)} ${bar(p)} ${p.toFixed(1)}%`); });
  }
  console.log('\n' + '-'.repeat(78));
  console.log('  OVERALL ending mix (all personas pooled)');
  const total = {}; ENDING_ORDER.forEach(k => total[k] = 0); let grand = 0;
  for (const r of Object.values(results)) ENDING_ORDER.forEach(k => { total[k] += r.dist[k]; grand += r.dist[k]; });
  ENDING_ORDER.forEach(k => console.log(`    ${ENDING_LABEL[k].padEnd(16)} ${bar(pct(total[k], grand))} ${pct(total[k], grand).toFixed(1)}%`));

  // ---- BALANCE TARGETS (spec §5) ----
  console.log('\n' + '-'.repeat(78));
  console.log('  ⚑ BALANCE TARGETS');
  const checks = [];
  const R = n => results[n];
  const top = r => ENDING_ORDER.reduce((a, k) => r.dist[k] > r.dist[a] ? k : a, ENDING_ORDER[0]);
  const g = R('The Grinder');
  checks.push([top(g) === 'burnout' && g.medWeek >= 15, `1. Grinder → Burnout (top: ${ENDING_LABEL[top(g)]}), median survival ${g.medWeek}w (need ≥15)`]);
  const m = R('The Minimalist');
  checks.push([pct(m.dist.faded, N) >= 60 && pct(m.dist.bankrupt, N) <= 15, `2. Minimalist → Faded ${pct(m.dist.faded, N).toFixed(0)}% (need ≥60), Broke ${pct(m.dist.bankrupt, N).toFixed(0)}% (need ≤15)`]);
  const s = R('The Sustainable');
  checks.push([pct(s.dist.legend, N) >= 50 && pct(s.dist.legend, N) <= 70, `3. Sustainable → Niche Legend ${pct(s.dist.legend, N).toFixed(0)}% (need 50–70)`]);
  const o = R('The Optimizer');
  checks.push([pct(o.dist.star, N) >= 50 && pct(o.dist.goat, N) >= 10 && pct(o.dist.goat, N) <= 25 && pct(total.goat, grand) <= 5,
    `4. Optimizer → Star ${pct(o.dist.star, N).toFixed(0)}% (need ≥50), GOAT ${pct(o.dist.goat, N).toFixed(0)}% (need 10–25); pooled GOAT ${pct(total.goat, grand).toFixed(1)}% (need ≤5)`]);
  const funnels = Object.entries(results).filter(([, r]) => pct(r.dist[top(r)], N) > 85).map(([n, r]) => `${n} ${pct(r.dist[top(r)], N).toFixed(0)}% ${ENDING_LABEL[top(r)]}`);
  checks.push([funnels.length === 0, `5. No persona >85% into one ending${funnels.length ? ' — ' + funnels.join('; ') : ''}`]);
  const lateBroke = Object.values(results).flatMap(r => r.runs).filter(r => r.end === 'bankrupt' && r.week > 20);
  const studioShare = pct(lateBroke.filter(r => r.studio).length, lateBroke.length);
  checks.push([lateBroke.length === 0 || studioShare > 50, `6. Late (>20w) Broke endings caused by the Studio: ${studioShare.toFixed(0)}% of ${lateBroke.length} (need >50)`]);
  checks.forEach(([ok, msg]) => console.log(`    ${ok ? '✓' : '✗'} ${msg}`));
  console.log(`\n  ${checks.filter(c => c[0]).length}/${checks.length} targets met`);
  console.log('\n' + '='.repeat(78) + '\n');
  return checks.every(c => c[0]);
}

function writeHTML(results, N, path) {
  const fs = require('fs');
  const COL = { goat: '#ffca4b', star: '#ff5cae', legend: '#4fd48a', faded: '#776d99', sellout: '#ff9f43', burnout: '#ffb03a', bankrupt: '#ff5b6e', cancelled: '#e0405b' };
  const stack = dist => ENDING_ORDER.map(k => { const p = pct(dist[k], N); return p > 0 ? `<span style="width:${p}%;background:${COL[k]}" title="${ENDING_LABEL[k]} ${p.toFixed(1)}%"></span>` : ''; }).join('');
  const rows = Object.entries(results).map(([name, r]) => `
    <div class="prow"><div class="pname">${name}<span>${fmt(r.medFollowers)} followers · ${fmt(r.medViewsWk)} views/wk · $${r.medCash.toLocaleString()} · rep ${r.medRep} · ${r.medHires} hires · studio ${r.studioPct.toFixed(0)}% · ${r.medWeek}w</span></div>
    <div class="stack">${stack(r.dist)}</div></div>`).join('');
  const legend = ENDING_ORDER.map(k => `<span class="lg"><i style="background:${COL[k]}"></i>${ENDING_LABEL[k]}</span>`).join('');
  const html = `<!doctype html><meta charset="utf8"><title>The Feed — Balance Report</title>
<style>body{margin:0;background:#0A2540;color:#fff;font-family:system-ui,sans-serif;padding:32px}
h1{font-size:22px;margin:0 0 4px}.sub{color:#94A3B8;font-size:13px;margin-bottom:24px}
.prow{margin-bottom:16px}.pname{font-weight:700;font-size:14px;margin-bottom:6px}.pname span{display:block;font-weight:400;color:#94A3B8;font-size:11.5px;font-family:monospace}
.stack{display:flex;height:22px;border-radius:6px;overflow:hidden;background:#1E293B}.stack span{display:block}
.legend{margin:24px 0;display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#94A3B8}.lg{display:flex;align-items:center;gap:5px}.lg i{width:11px;height:11px;border-radius:3px;display:inline-block}</style>
<h1>THE FEED — balance report</h1><div class="sub">${N} playthroughs per persona · ${N * Object.keys(results).length} games total · ${new Date().toLocaleString()}</div>
${rows}<div class="legend">${legend}</div>`;
  fs.writeFileSync(path, html);
  console.log(`  HTML dashboard written to ${path}\n`);
}

// ======================= main =======================
const N = parseInt(process.argv[2], 10) || 500;
const htmlPath = process.argv[3] || null;
const t0 = Date.now();
const results = runSuite(N);
const allMet = printReport(results, N);
if (htmlPath) writeHTML(results, N, htmlPath);
console.log(`  (ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
process.exit(allMet ? 0 : 2);
```

- [ ] **Step 2: Run it**

Run: `node tools/the-feed-sim.js 300`
Expected: a report prints with 7 personas and the 6 target lines (most will be ✗ at this point — that's Task 10's job). Exit code 2. If it throws, fix the engine call that threw — the sim only uses the API listed at the top of this plan.

- [ ] **Step 3: Commit**

```bash
git add tools/the-feed-sim.js
git commit -m "The Feed sim: personas and runner for slots/stress, balance targets as exit criteria

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Balance until the six targets hold

**Files:**
- Modify: `the-feed-engine.js` `CONFIG` (and only CONFIG unless a target is structurally unreachable — then say so and stop)

This task is a loop. Run `node tools/the-feed-sim.js 600`, read the six target lines, move a knob, repeat. Finish with a 1200-run pass. **Do not edit the personas to make targets pass** — the personas are the players.

- [ ] **Step 1: Baseline run.** `node tools/the-feed-sim.js 600 /tmp/feed-baseline.html`. Paste the target block into the commit message later.

- [ ] **Step 2: Iterate using this knob map**

| Symptom | Knob | Direction |
|---|---|---|
| Grinder burns out too early (<15w) | `stressRecover` up (12→14), or platform `stress` for longform down (18→16) | gentler |
| Grinder doesn't burn out (Faded/Broke instead) | `bandRedline` down (90→85) or `stressRecover` down | harsher |
| Minimalist goes Broke | `overheadBase` down (140→120) or micro/shortform `rpm` up | cheaper to exist |
| Minimalist reaches Legend (too easy) | `legendAt` up, or `churnBase` up | harder |
| Sustainable Legend < 50% | `legendAt` down (40K→35K) or `viewsK` up (160→175) | more reach |
| Sustainable Legend > 70% | `legendAt` up, `legendRep` up (55→60) | rarer |
| Optimizer Star < 50% | `starAt` down, `viewsK` up, `sizeMax` up (4.5→5) | more top-end |
| Optimizer GOAT > 25% or pooled > 5% | `goatAt` up (1.2M→1.5M) | rarer |
| Optimizer GOAT < 10% | `goatAt` down or `studioViewsMult` up | reachable |
| Studio never causes Broke (target 6 ✗ with few late Brokes) | `studioLease` up (350→450) | riskier |
| Studio bankrupts everyone (Optimizer Broke > 15%) | `studioLease` down, `studioUnlockFollowers` up | safer |
| Hustler never Sells Out / always Cancelled | `sellRepUnder` up (45→50) or crypto event follower loss down | — |
| Money is meaningless (all cash medians > $50K) | `memberRate` down (6→5), `memberChurn` up | tighter |
| Everyone Broke (pooled > 35%) | `overheadBase` down, `bankruptFloor` down (−1500→−2000) | looser |

Move one or two knobs per run. Keep the values in `CONFIG` — never inline numbers elsewhere.

- [ ] **Step 3: Final validation.** `node tools/the-feed-sim.js 1200` → `6/6 targets met`, exit 0. Also `npm test` still passes (some tests assert CONFIG-derived numbers via `E.CONFIG.*`, so they track knob changes; if a test hardcodes a number that a knob moved — e.g. the `stressCost` test's `18` — update the test to read from `E.PLATFORMS`/`E.CONFIG`).

- [ ] **Step 4: Commit** with the final target block in the message body:

```bash
git add the-feed-engine.js tools/the-feed-test.js
git commit -m "The Feed: rebalance CONFIG — all six sim targets met

<paste the ⚑ BALANCE TARGETS block from the 1200-run here>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Wire the game UI to the new engine (current skin)

**Files:**
- Modify: `the-feed.html` — CSS block (add rules), markup (meters, stat label, stage header), and the **entire game script** (`<script>(function(){ ... })();</script>` at the bottom).

Keep the `SFX` sound manager block exactly as it is (it has no engine dependencies). Everything else in the script is replaced below.

- [ ] **Step 1: CSS — add these rules** at the end of the `<style>` block, before `.hidden`:

```css
  /* ---------- stress bands, angle badges, slot pill, team panel ---------- */
  .fill-stress{background:var(--color-status-info)}
  .fill-stress.hot{background:var(--color-status-warning)}
  .fill-stress.fumes,.fill-stress.redline{background:var(--color-status-error)}
  .fill-stress.redline{animation:pulse 1s infinite}
  .mband{font-family:var(--font-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; margin-left:8px; color:var(--fg-3)}
  .mband.hot{color:var(--color-status-warning)} .mband.fumes,.mband.redline{color:var(--color-status-error)}
  .abadge{font-family:var(--font-mono); font-size:10px; letter-spacing:.05em; padding:2px 7px; border-radius:var(--radius-pill); border:1px solid var(--border-subtle); text-transform:uppercase}
  .abadge.trend{color:var(--color-status-info); border-color:rgba(59,130,246,.4)}
  .abadge.evergreen{color:var(--fg-2); border-color:var(--border-default)}
  .abadge.personal{color:var(--color-status-warning); border-color:rgba(245,158,11,.4)}
  .slotpill{font-family:var(--font-mono); font-size:12px; color:var(--fg-2); border:1px solid var(--border-subtle); background:var(--bg-deep); padding:5px 11px; border-radius:var(--radius-pill); white-space:nowrap}
  .slotpill b{color:var(--color-accent-vivid); font-weight:500}
  .move .topic{font-weight:var(--fw-bold); font-size:14px; line-height:1.3}
  .team{margin:4px 17px 8px; border:1px solid var(--border-subtle); border-radius:var(--radius-lg); background:var(--bg-deep); overflow:hidden}
  .trow{display:flex; align-items:center; gap:12px; padding:10px 13px; border-top:1px solid var(--border-subtle); font-size:13px}
  .trow:first-child{border-top:0}
  .trow .te{font-size:18px; flex:none} .trow .tt{flex:1} .trow .tt b{display:block} .trow .tt span{font-size:11.5px; color:var(--fg-2)}
  .trow .tcost{font-family:var(--font-mono); font-size:11px; color:var(--fg-3); white-space:nowrap}
  .tbtn{font-family:var(--font-sans); font-weight:var(--fw-bold); font-size:12px; padding:7px 12px; border-radius:var(--radius-md); cursor:pointer; border:1px solid var(--border-strong); background:transparent; color:var(--fg-1)}
  .tbtn.hire{border-color:var(--color-accent-vivid); color:var(--color-accent-vivid)} .tbtn:disabled{opacity:.4; cursor:not-allowed}
  .tnote{padding:9px 13px; font-size:11.5px; color:var(--fg-3); border-top:1px solid var(--border-subtle)}
```

- [ ] **Step 2: Markup — meters.** Replace the three `.meter` divs inside `.meters` with two:

```html
        <div class="meter"><div class="mtop"><span class="mname">🌡️ Stress<span class="mband" id="v-band"></span></span><span class="mval mono" id="v-stress">20</span></div><div class="bar"><i class="fill-stress" id="b-stress"></i></div></div>
        <div class="meter"><div class="mtop"><span class="mname">💚 Reputation</span><span class="mval mono" id="v-rep">60</span></div><div class="bar"><i class="fill-rep" id="b-rep"></i></div></div>
```

- [ ] **Step 3: Markup — overhead + slot pill + help line.**

Change `<div class="k">Weekly costs</div>` to `<div class="k">Overhead</div>`.

Change the help line to:
```html
      <div class="helpline" id="helpline">Two content slots and one business slot a week. Leaving a slot empty is how you rest — stress is the one number that ends runs.</div>
```

Replace `<span class="energypill" id="energypill">⚡ 100 energy left</span>` with:
```html
<span class="slotpill" id="slotpill"><b>2</b> content · <b>1</b> business</span>
```

- [ ] **Step 4: Replace the game script.** Replace everything from `const E = window.FeedEngine;` down to (but not including) the SFX block's `const SFX = (function(){`, and everything after the SFX block's closing `})();` + the `pointerdown` unlock line, with the code below. (Net effect: the file keeps `"use strict"; const E = ...` → *new destructure* → SFX block untouched → *new everything else*.)

Top of script (replaces the destructure + globals):

```js
  const E = window.FeedEngine;
  const { PLATFORMS, NICHES, TIERS, PORDER, ANGLES, HIRES, HORDER, fmt, money, clamp } = E;
  const $ = id => document.getElementById(id);
  const pick = a => a[Math.floor(Math.random()*a.length)];

  let S = null, selNiche = 'gaming', selHome = 'longform', bumped = {}, teamOpen = false;
```

After the SFX block and the `pointerdown` line, the rest of the script:

```js
  // pick the most salient sound implied by an effect-log
  function logSound(log){ if(!log)return null; const f=log.floats||[], fe=log.feed||[];
    if(fe.some(x=>/leveled up|signed the lease/.test(x.text))) return 'level';
    if(f.some(x=>x.tone==='hit')||fe.some(x=>x.kind==='big')) return 'hit';
    if(fe.some(x=>x.kind==='bad')) return 'bad';
    if(f.some(x=>x.tone==='cash')) return 'cash';
    if(f.some(x=>x.tone==='gain'||x.tone==='up')) return 'post';
    return null; }

  // engine-bound convenience wrappers (S is closed over)
  const N = () => NICHES[S.niche];
  const activePlats = () => E.activePlats(S);
  const totalFollowers = () => E.totalFollowers(S);
  const platTier = p => E.platTier(S, p);

  function newGame(name, niche, home){
    SFX.unlock(); SFX.play('level');
    S = E.newState(niche, home); S.name = name || 'untitled'; teamOpen = false;
    pushFeed(NICHES[niche].emoji, `Channel created on ${PLATFORMS[home].name}. The first post is always the hardest.`, '');
    E.buildHand(S); render(); openClose($('startOverlay'), false);
  }

  // ---------- feedback layer: turn engine logs into pops / feed / bumps ----------
  const TONE = { hit:'var(--color-accent-vivid)', gain:'var(--color-accent-signal)', cash:'var(--color-accent-vivid)',
                 up:'var(--color-accent-signal)', loss:'var(--color-status-error)', down:'var(--color-status-error)' };
  function anchorId(a){ if(a==='cash')return 'v-cash'; if(a==='rep')return 'v-rep'; if(a==='stress')return 'v-stress';
    if(a.indexOf('plat:')===0)return 'cc-'+a.slice(5); return null; }
  function applyLog(log){ if(!log)return;
    (log.floats||[]).forEach(f=>floatDelta(anchorId(f.anchor), f.text, TONE[f.tone]||'var(--fg-1)'));
    (log.feed||[]).forEach(f=>pushFeed(f.emoji, f.text, f.kind));
    (log.bump||[]).forEach(k=>{ bumped[k]=true; });
    SFX.play(logSound(log));
  }
  function pushFeed(e,t,k){ S.feed = S.feed||[]; S.feed.unshift({e,t,k:k||''}); if(S.feed.length>8)S.feed.pop(); }
  function floatDelta(id,text,color){ const a=id&&$(id); if(!a)return; const r=a.getBoundingClientRect();
    const el=document.createElement('div'); el.className='flt'; el.textContent=text; el.style.color=color;
    el.style.left=(r.left+r.width/2-12+(Math.random()*16-8))+'px'; el.style.top=(r.top-4)+'px';
    $('floats').appendChild(el); setTimeout(()=>el.remove(),1200); }

  // ---------- actions ----------
  function takeMove(i){ const m=S.hand[i]; if(!m||S.slots.content<=0)return; applyLog(E.applyMove(S,m)); E.buildHand(S); render(); }
  function bizDo(id, role){ applyLog(E.biz[id](S, role)); E.buildHand(S); render(); }
  function endWeek(){ applyLog(E.settleWeek(S)); const ev=E.rollEvent(S);
    if(ev){ S.event=ev; S.phase='event'; SFX.play('event'); render(); return; } SFX.play('week'); advance(); }
  function advance(){ E.advanceWeek(S); if(E.checkEndings(S)){ endGame(S.endKey); return; } S.phase='play'; E.buildHand(S); render(); }
  function chooseEvent(i){ applyLog(E.applyEventChoice(S, S.event, i)); S.event=null; advance(); }

  // ---------- move display (presentation of the engine's hand) ----------
  function moveView(m){
    if(m.kind==='start'){ const pf=PLATFORMS[m.pkey];
      return { ico:'✨', label:'Expand to '+pf.name, desc:`Open a second front (${pf.tag}). More reach, another mouth to feed each week.`,
        flags:[['+platform','up'],['+'+m.stress+' stress','en']] }; }
    if(m.kind==='crosspost'){
      return { ico:'🔗', label:`Cross-post ${PLATFORMS[m.src].name} → ${PLATFORMS[m.dst].name}`,
        desc:`Funnel your ${PLATFORMS[m.src].name} audience to your smaller ${PLATFORMS[m.dst].name}.`,
        flags:[['🔗 Funnel','up'],['+'+m.stress+' stress','en']] }; }
    const pf=PLATFORMS[m.pkey], A=ANGLES[m.angle], flags=[[A.label, 'angle '+m.angle]];
    if(m.ride) flags.push(['🔥 Ride the wave','hot']);
    else if(m.heat>=52) flags.push(['🔥 Hot','hot']);
    if(m.proven && m.fatigue<45) flags.push(['⭐ Proven','up']);
    if(m.fatigue>=52) flags.push(['😴 Fatigued','dn']);
    flags.push(['+'+m.stress+' stress','en']);
    const outlook = (m.mod||1)>=1.4?'primed to pop':(m.mod||1)>=1.05?'in a good spot':(m.mod||1)<=0.7?'this audience is tired':'steady';
    return { ico:pf.emoji, label:m.topic, topic:true, desc:`${pf.name} · ${A.tag} · ${outlook}.`, flags };
  }

  // ---------- channel SVG (levels up visually with tier) ----------
  function channelSVG(p){
    const pf=PLATFORMS[p.key], t=platTier(p), col=pf.color, id=p.key;
    const banner = t>=2 ? `<rect x="0" y="0" width="224" height="40" fill="${col}" opacity="${0.14+0.05*t}"/><rect x="0" y="39" width="224" height="1.5" fill="${col}" opacity="0.5"/>`
      : t>=1 ? `<rect x="0" y="0" width="224" height="40" fill="${col}" opacity="0.10"/>`
      : `<rect x="0" y="0" width="224" height="40" fill="#0A2540"/>`;
    const verified = t>=3 ? `<circle cx="150" cy="58" r="7" fill="${col}"/><path d="M146.4 58 l2.4 2.4 l4.7 -4.9" fill="none" stroke="#0F172A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : '';
    const filled=clamp(t,0,3);
    let thumbs=''; for(let i=0;i<3;i++){ const x=14+i*68; const on=i<filled;
      thumbs+= on ? `<rect x="${x}" y="86" width="60" height="30" rx="5" fill="${col}" opacity="${0.22+0.10*t/4}"/><rect x="${x}" y="86" width="60" height="30" rx="5" fill="none" stroke="${col}" opacity="0.55"/>`
                   : `<rect x="${x}" y="86" width="60" height="30" rx="5" fill="none" stroke="#334155" stroke-dasharray="4 4"/>`; }
    const glow = t>=3?`filter="drop-shadow(0 0 8px ${col})"`:'';
    return `<svg viewBox="0 0 224 126" width="100%" height="126" xmlns="http://www.w3.org/2000/svg" ${glow} id="cc-${id}">
      <rect x="0.5" y="0.5" width="223" height="125" rx="10" fill="#0F172A" stroke="rgba(148,163,184,.14)"/>
      <clipPath id="cl${id}"><rect x="0.5" y="0.5" width="223" height="125" rx="10"/></clipPath>
      <g clip-path="url(#cl${id})">
        ${banner}
        <circle cx="40" cy="44" r="20" fill="#0A2540" stroke="${col}" stroke-width="${t>=2?2:1}"/>
        <text x="40" y="51" font-size="20" text-anchor="middle">${N().emoji}</text>
        <text x="70" y="42" fill="#FFFFFF" font-family="DM Sans, sans-serif" font-weight="700" font-size="13">${pf.emoji} ${pf.name}</text>
        ${verified}
        <text x="70" y="60" fill="${col}" font-family="DM Mono, monospace" font-weight="500" font-size="15">${fmt(p.followers)}</text>
        <text x="128" y="60" fill="#94A3B8" font-family="DM Sans, sans-serif" font-size="10">followers</text>
        ${thumbs}
      </g></svg>`;
  }

  // ---------- render ----------
  const BAND_LABEL = { normal:'', hot:'running hot', fumes:'on fumes', redline:'redline' };
  function render(){ if(!S)return;
    $('channame').textContent=S.name; $('avatar').textContent=N().emoji;
    $('nichebadge').textContent=N().label+' · '+N().blurb;
    $('totfollow').textContent=fmt(totalFollowers());
    $('weekchip').textContent='WEEK '+String(Math.min(S.week,52)).padStart(2,'0')+' / 52';
    const band=E.stressBand(S);
    setMeter('stress',S.stress); $('b-stress').className='fill-stress '+band; $('v-band').className='mband '+band; $('v-band').textContent=BAND_LABEL[band];
    setMeter('rep',S.rep);
    const c=$('v-cash'); c.textContent=money(S.cash); c.className='v mono '+(S.cash<0?'neg':'pos');
    const ob=E.overheadBreakdown(S); $('v-rent').textContent='-'+money(ob.total);
    $('helpline').textContent=`Overhead: ${money(ob.base)} living + ${money(ob.platforms)} platforms`+(ob.payroll?` + ${money(ob.payroll)} payroll`:'')+(ob.lease?` + ${money(ob.lease)} studio lease`:'')+'. Leaving a slot empty is how you rest.';
    $('slotpill').innerHTML=`<b>${S.slots.content}</b> content · <b>${S.slots.business}</b> business`;
    renderChannels();
    if(S.phase==='event'&&S.event) renderEvent(); else renderMoves();
    renderFeed();
  }
  function setMeter(k,v){ $('b-'+k).style.width=clamp(v,0,100)+'%'; $('v-'+k).textContent=Math.round(v); }

  function renderChannels(){ const row=$('chanrow'); const act=activePlats();
    $('chanhint').textContent=act.length+' active · '+(S.members>0?fmt(S.members)+' paid members':'no paid tier yet')+(E.hasStudio(S)?' · 🏢 studio':'');
    row.innerHTML=act.map(p=>{ const t=platTier(p);
      return `<div class="chancard ${bumped[p.key]?'up':''}" data-k="${p.key}">${channelSVG(p)}
        <div class="chanmeta"><span class="tl"><b>${TIERS[t]}</b> tier</span>
        <span class="tierpill" style="color:${PLATFORMS[p.key].color}">${'●'.repeat(t+1)}${'○'.repeat(4-t)}</span></div></div>`; }).join('');
    bumped={};
  }

  function renderMoves(){
    $('stagetitle').textContent='Week '+Math.min(S.week,52)+' — what are you making?';
    const noContent=S.slots.content<=0, noBiz=S.slots.business<=0;
    const moveHTML=S.hand.map((m,i)=>{ const v=moveView(m);
      return `<button class="move ${m.special?'special':''}" data-i="${i}" ${noContent?'disabled':''}>
        <span class="ico">${v.ico}</span><span><span class="${v.topic?'topic':'mt'}">${v.topic?'‘'+v.label+'’':v.label}</span><span class="md">${v.desc}</span>
        <span class="flags">${v.flags.map(f=>f[1].indexOf('angle ')===0?`<span class="abadge ${f[1].slice(6)}">${f[0]}</span>`:`<span class="flag ${f[1]}">${f[0]}</span>`).join('')}</span></span></button>`; }).join('');
    const canDeal=totalFollowers()>=1000, up=E.upgradeInfo(S), canPaid=S.members===0&&totalFollowers()>=E.CONFIG.paidUnlock;
    const biz=[
      {id:'engage',ic:'💬',t:'Engage the community',d:'Build reputation and a little buzz everywhere.',on:!noBiz,f:[['+5 stress','en'],['+rep','up']]},
      {id:'deal',ic:'🤝',t:'Take a brand deal',d:canDeal?'Cash today, reputation tomorrow. Pays more when your rep is high.':'Locked — reach 1K total first.',on:canDeal&&!noBiz,f:[['+4 stress','en'],['+$$','mo'],['-rep','dn']]},
      up.next===null?{id:'upgrade',ic:'🏢',t:'Studio owned',d:'Full rig, real space, full team. Nothing left to buy.',on:false,f:[]}
        :up.next===4?{id:'upgrade',ic:'🏢',t:'Sign a studio lease ('+money(up.cost)+')',d:up.ok?'Views ×1.3, −6 stress per post, room for a full team — and +'+money(E.CONFIG.studioLease)+'/week, forever.':up.reason,on:up.ok,f:[['-'+money(up.cost),'dn'],['+'+money(E.CONFIG.studioLease)+'/wk','dn'],['×1.3 views','up']]}
        :{id:'upgrade',ic:'🛠️',t:'Upgrade gear ('+money(up.cost)+')',d:up.ok?'Better production on every channel (+10% views).':up.reason,on:up.ok,f:[['-'+money(up.cost),'dn'],['+quality','up']]},
      S.members>0?{id:'paid',ic:'⭐',t:'Membership live',d:fmt(S.members)+' members · '+money(S.members*E.CONFIG.memberRate)+'/week. Grows with new followers, churns when you go quiet.',on:false,f:[]}
        :{id:'paid',ic:'⭐',t:'Launch paid membership',d:canPaid?'Convert true fans into recurring income.':'Locked — reach '+fmt(E.CONFIG.paidUnlock)+' total first.',on:canPaid&&!noBiz,f:[['+members','up']]},
      {id:'team',ic:'🧑‍💻',t:'Team ('+E.hireCount(S)+'/'+E.hireCap(S)+')',d:E.hireCount(S)?HORDER.filter(r=>S.hires[r]).map(r=>HIRES[r].label).join(', ')+' · '+money(E.payroll(S))+'/week':'Hire help. Every role is a weekly salary.',on:true,f:[]},
    ];
    const bizHTML=biz.map(b=>`<button class="move ${b.id==='team'&&teamOpen?'special':''}" data-biz="${b.id}" ${b.on?'':'disabled'}>
      <span class="ico">${b.ic}</span><span><span class="mt">${b.t}</span><span class="md">${b.d}</span>
      <span class="flags">${b.f.map(f=>`<span class="flag ${f[1]}">${f[0]}</span>`).join('')}</span></span></button>`).join('');
    const teamHTML = !teamOpen ? '' : `<div class="team">${HORDER.map(r=>{ const h=HIRES[r], info=E.hireInfo(S,r), have=S.hires[r];
        return `<div class="trow"><span class="te">${h.emoji}</span><span class="tt"><b>${h.label}</b><span>${h.blurb}</span></span>
          <span class="tcost">${money(h.sign)} to sign · ${money(h.weekly)}/wk</span>
          ${have?`<button class="tbtn" data-fire="${r}" ${noBiz?'disabled':''}>Let go</button>`:`<button class="tbtn hire" data-hire="${r}" ${info.ok?'':'disabled'} title="${info.reason}">Hire</button>`}</div>`; }).join('')}
      <div class="tnote">${E.hasStudio(S)?'Studio: room for four.':'Two people max until you have a Studio.'} Hiring and letting go each take your business slot.</div></div>`;
    $('stagebody').innerHTML=`<div class="movelabel">📣 Content — pick up to ${E.CONFIG.slotsContent}. Angles are trade-offs, not grades.</div>
      <div class="moves">${moveHTML}</div>
      <div class="movelabel">🧰 Business — one a week</div>
      <div class="moves">${bizHTML}</div>${teamHTML}
      <div class="stagefoot"><button class="btn primary" id="endWeekBtn">End the week ▸</button></div>`;
    $('stagebody').querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ if(!b.disabled)takeMove(+b.dataset.i); });
    $('stagebody').querySelectorAll('[data-biz]').forEach(b=>b.onclick=()=>{ if(b.disabled)return; if(b.dataset.biz==='team'){ teamOpen=!teamOpen; SFX.play('click'); render(); return; } bizDo(b.dataset.biz); });
    $('stagebody').querySelectorAll('[data-hire]').forEach(b=>b.onclick=()=>{ if(!b.disabled)bizDo('hire', b.dataset.hire); });
    $('stagebody').querySelectorAll('[data-fire]').forEach(b=>b.onclick=()=>{ if(!b.disabled)bizDo('fire', b.dataset.fire); });
    $('endWeekBtn').onclick=endWeek;
  }

  function renderEvent(){
    $('stagetitle').textContent='Something happened';
    const ev=S.event, cls=ev.kind==='hostile'?'hostile':'neutral';
    $('stagebody').innerHTML=`<div class="event">
      <span class="ebadge ${cls}">${ev.kind==='hostile'?'⚠️ ':'✦ '}${ev.badge}</span>
      <div class="ehead"><div class="eemoji">${ev.emoji}</div><h2>${ev.title}</h2></div>
      <p class="etext">${ev.text}</p>
      <div class="choices">${ev.choices.map((c,i)=>`<button class="choice" data-i="${i}"><span class="ci">${c.ci}</span><span><b>${c.label}</b><span>${c.desc}</span></span></button>`).join('')}</div>
    </div>`;
    $('stagebody').querySelectorAll('.choice').forEach(b=>b.onclick=()=>chooseEvent(+b.dataset.i));
  }
  function renderFeed(){ $('feedlist').innerHTML=(S.feed||[]).map(f=>`<div class="fitem ${f.k}"><span class="fe">${f.e}</span><span>${f.t}</span></div>`).join(''); }

  // ---------- endings ----------
  function endGame(key){ S.phase='end'; SFX.play(['goat','star','legend'].indexOf(key)>=0?'win':'lose'); const e=E.endingText(S,key);
    $('endEmoji').textContent=e.emoji; $('endKicker').textContent='Ending · '+e.kicker;
    $('endTitle').textContent=e.title; $('endBlurb').textContent=e.blurb; $('endLesson').textContent='“'+e.lesson+'”';
    $('endStats').innerHTML=[['Total following',fmt(totalFollowers())],['Total views',fmt(S.totalViews)],['Weeks',Math.min(S.week-1,52)+' / 52'],
      ['Platforms run',activePlats().length],['Bank',money(S.cash)],['Peak overhead',money(S.peakOverhead)+'/wk']].map(([k,v])=>`<div class="endstat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    render(); openClose($('endOverlay'),true);
  }
  function openClose(el,show){ el.classList.toggle('hidden',!show); }

  // ---------- start wiring ----------
  function buildStart(){
    $('nichegrid').innerHTML=Object.entries(NICHES).map(([k,n])=>`<div class="pick ${k===selNiche?'sel':''}" data-k="${k}"><span class="pe">${n.emoji}</span><span class="pl">${n.label}</span><span class="pm">${n.blurb}</span></div>`).join('');
    $('homegrid').innerHTML=PORDER.filter(k=>PLATFORMS[k].unlock===0).map(k=>{const p=PLATFORMS[k];
      return `<div class="pick ${k===selHome?'sel':''}" data-k="${k}"><span class="pe">${p.emoji}</span><span class="pl">${p.name}</span><span class="pm">${p.tag} · +${p.stress} stress</span></div>`;}).join('');
    $('nichegrid').querySelectorAll('.pick').forEach(el=>el.onclick=()=>{SFX.unlock(); SFX.play('click'); selNiche=el.dataset.k; $('nichegrid').querySelectorAll('.pick').forEach(x=>x.classList.toggle('sel',x===el));});
    $('homegrid').querySelectorAll('.pick').forEach(el=>el.onclick=()=>{SFX.unlock(); SFX.play('click'); selHome=el.dataset.k; $('homegrid').querySelectorAll('.pick').forEach(x=>x.classList.toggle('sel',x===el));});
  }
  buildStart();
  const soundBtn=$('soundBtn');
  if(SFX.isMuted()){ soundBtn.textContent='🔇'; soundBtn.classList.add('muted'); }
  soundBtn.onclick=()=>{ SFX.unlock(); const m=SFX.toggleMute(); soundBtn.textContent=m?'🔇':'🔊'; soundBtn.classList.toggle('muted',m); if(!m)SFX.play('click'); };
  $('startBtn').onclick=()=>{ const nm=$('nameInput').value.trim()||pick(['midnight uploads','the daily grind','no filter','raw takes','after hours','main character']);
    newGame(nm, selNiche, selHome); };
  $('nameInput').addEventListener('keydown',e=>{ if(e.key==='Enter')$('startBtn').click(); });
  $('againBtn').onclick=()=>{ openClose($('endOverlay'),false); openClose($('startOverlay'),true); $('nameInput').value=''; };
```

Note: the event `choice` buttons no longer carry the `repair|neutral|escalate` class (the spec says choice colours telegraphed the answer). Remove the three `.choice.repair:hover / .neutral:hover / .escalate:hover` CSS rules and leave the generic `.choice:hover` border as `var(--border-strong)`:

```css
  .choice:hover{transform:translateX(3px); background:rgba(30,41,59,.9); border-color:var(--border-strong)}
```

- [ ] **Step 5: Build and open the preview**

```bash
npm run build
```

Then use the Browser pane: `preview_start` with `name: "eleventy-site"`, navigate to `/the-feed`, and:
1. `read_console_messages` with `onlyErrors: true` → expect none.
2. Start a game (any niche). `read_page` → confirm the stage shows two content cards with quoted topic titles and angle badges, five business buttons, the slot pill `2 content · 1 business`.
3. Click a content card → slot pill shows `1 content`; the feed's newest line matches `‘…’ did N views on …`.
4. Click Team → roster appears with Hire buttons; Hire the Mod → payroll appears in the Overhead help line and the Team button reads `Team (1/2)`.
5. Click End the week → either an event card or week 2 with `2 content · 1 business` again.
6. Drive stress up (two longform posts/week for ~4 weeks) → Stress meter turns amber then red, feed shows the band warnings.
7. `computer` screenshot of the play screen for the commit/PR.

- [ ] **Step 6: Commit**

```bash
git add the-feed.html
git commit -m "The Feed UI: slots, stress bands, topic cards with angles, team panel, overhead breakdown

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Docs, final checks, merge

**Files:**
- Modify: `the-feed-BACKLOG.md`, `CLAUDE.md`

- [ ] **Step 1: Rewrite `the-feed-BACKLOG.md`**

Replace the whole file with:

```markdown
# The Feed — project state & backlog

*The Feed* is a content-creator life-sim game on this site. This file is the
working memory for it: what's done, what's deferred, and enough detail to pick
the deferred work back up without re-deriving anything. (Not built by Eleventy —
listed in `.eleventyignore`.)

Live at **`/the-feed`** and **`thefeed.jasonnellis.com`**. Currently `noindex`
and not in the nav (deliberately unlisted while in progress).

The rework is three sub-projects, specced in `docs/superpowers/specs/`:
**A. core loop** (shipped — see below) · **B. event deck** · **C. social-app
reskin**. Specs and plans for B and C get written when each starts.

---

## Architecture (shipped)

- **`the-feed.html`** — the game page. Standalone (does not load `nav.js`),
  styled in the site's Bolt OS system via `/colors_and_type.css` tokens.
  Contains rendering, input, the sound layer, and the Substack end-screen CTA.
- **`the-feed-engine.js`** — the **single source of truth** for all mechanics,
  economy, events, and balance (`CONFIG` block at top). Pure/UMD. Imported by
  the game, the simulator and the tests, so they can't drift. State-mutating
  actions (including `settleWeek`) return an effect-log `{floats, feed, bump}`
  the browser animates and the sim ignores. RNG is injectable (`setRng`).
- **`tools/the-feed-sim.js`** — headless balance simulator with seven player
  personas. `npm run sim` (or `node tools/the-feed-sim.js 1200 report.html`).
  Its **⚑ BALANCE TARGETS** block encodes the spec's six exit criteria and the
  process exits non-zero if any fail. **To rebalance: edit `CONFIG`, re-run.**
- **`tools/the-feed-test.js`** — deterministic engine tests. `npm test`.
- **Sound** — Kenney CC0 pack in `the-feed-assets/sfx/`, mute persisted.
- **Capture** — end-screen CTA links to Substack; no email touches the game.
- **Analytics** — Plausible, inline snippet (page doesn't load `nav.js`).
- **Assets/licenses** — `the-feed-assets/CREDITS.md`.

## The game, mechanically (after sub-project A)

- **52 weeks.** Each week: **2 content slots + 1 business slot**. Leaving a
  slot empty is how you rest.
- **Stress** (0–100) replaces energy. Bands: <50 normal · 50–69 running hot ·
  70–89 on fumes (views −15%) · ≥90 redline. Three redline weeks = Burnout.
  Every band change is announced in the feed.
- **Content cards** are dealt each week: platform × **angle** × authored topic
  line (`TOPICS` in the engine, 5 per niche per angle, 8-week cooldown).
  Angles: **Trend** (×1.6 views, ×0.5 conversion, cohort churns 2×, may age
  badly) · **Evergreen** (×0.8 views, ×1.3 conversion, 4-week tail of 15%
  views/week) · **Personal** (+rep, +6 stress, may overshare).
- **Views → followers → money.** Posts produce views; followers = views ×
  conversion; ad revenue = views × per-view RPM. Followers **churn** (0.6%/wk
  base, trend cohort 1.2%, 2% when a platform is idle 3+ weeks) and hostile
  events cost followers.
- **Business** (one/week): Engage · Brand deal (pays more at high rep) ·
  Upgrade gear (3 tiers, +10% views each) · **The Studio** (tier 4: $12K +
  $350/wk lease, views ×1.3, −6 stress/post, needed for >2 hires; unlocks at
  tier 3 + 25K followers) · Launch membership (recomputed weekly) · **Team**
  (Editor / Manager / Mod / Designer; hire & fire; weekly payroll).
- **Overhead** = $140 + $10/platform + payroll + lease. No hidden creep.
- Same eight endings.

### When ready to launch publicly
1. Remove `<meta name="robots" content="noindex">` from `the-feed.html`.
2. Add a nav entry (`NAV_LINKS` in `nav.js`) or link it from a tools page.
3. Consider adding it to `sitemap.njk`.

---

## Next: sub-project B — event deck expansion

Ten events is too few for 52 weeks (all seen by ~week 15, "review-bombed"
seven times in one run). Target 30+, gated by phase (early/mid/late) and
state (hires, studio, angles used, churn), non-repeating within a run.
Candidate cards: collab offer (the #1 real growth lever — asymmetric by
creator size), platform beta invite, press feature, a copycat stealing your
format, a strike/demonetization, seasonal CPM swings (Q4 spike, summer slump),
a tax bill, an editor quitting, a sponsor pulling out after a scandal, a
year-end awards/annual-review arc for weeks 45–52.

## Then: sub-project C — social-app reskin

Make the game *look like being a creator*: a phone-shaped fake social app
(Home = this week's cards, Notifications = the feed with fake usernames and
comments, Inbox = events arrive as DMs, Stats = sparklines), Bolt OS tokens
only for the chrome. Drop emoji-as-icons for a small bespoke icon set. Fix the
mobile stacking order (moves above meters). Ship the engine's data as-is.

---

## Priority item — ending → essay CTA (blocked on content)

Each ending's Substack CTA should link to a specific essay on that ending's
theme (Burnout → an essay on creator burnout, Sellout → one on brand trust,
etc.). **Blocked until the essays exist.** When they do: add an `essay` URL
per `ENDINGS` entry in the engine and swap the end-screen CTA copy/link.
This is the whole reason the game exists — do not let it slip.

## Deferred — high-score leaderboard (Netlify Blobs)

Defer until after C. Client-submitted scores are spoofable (acceptable for a
toy board with clamping + rate-limits). Score should be a composite (followers,
rep, weeks survived, ending), not raw followers. Plan when picked up: `npm i
@netlify/blobs`, `netlify/functions/submit-score.mjs` + `top-scores.mjs`,
board UI on the end screen. Display name only, never email.

## Dropped — OpenMoji

Consistent emoji would polish the exact thing the reskin removes (emoji as the
icon system). Not doing it. The OpenMoji entry in `CREDITS.md` can be deleted
when C ships.

## Other noted ideas (not committed to)
- Inline email capture — no; Substack link-out is the right GDPR/maintenance call.
- Rivals / a shifting platform meta as a persistent system (B may cover this with events first).
```

- [ ] **Step 2: Update `CLAUDE.md`** — in the "The Feed (game at `/the-feed`)" section, replace the bullet list with:

```markdown
- Mechanics/economy/balance are in **`the-feed-engine.js`** (single source of
  truth, `CONFIG` block); imported by the game, the balance simulator
  `tools/the-feed-sim.js` and the tests `tools/the-feed-test.js`. To
  rebalance: edit `CONFIG`, run `npm run sim` (exits non-zero if the six
  balance targets fail). `npm test` runs the deterministic engine tests.
- The week loop is **2 content slots + 1 business slot**; **stress** (not
  energy) is the health meter; content cards are platform × angle
  (Trend / Evergreen / Personal) × an authored topic line. There is no skill
  stat. See `the-feed-BACKLOG.md` for the full mechanical summary.
- `the-feed.html` is standalone (does NOT load `nav.js`) — so its Plausible
  snippet is inline, and it's styled via Bolt OS tokens from
  `colors_and_type.css`.
- Live at `/the-feed` and `thefeed.jasonnellis.com`; currently `noindex` and
  not in the nav (unlisted on purpose).
```

- [ ] **Step 3: Final verification**

```bash
npm test && node tools/the-feed-sim.js 1200 && npm run build
```

Expected: all tests pass; `6/6 targets met`; Eleventy build succeeds with `_site/the-feed.html` and `_site/the-feed-engine.js` present.

- [ ] **Step 4: Commit docs**

```bash
git add the-feed-BACKLOG.md CLAUDE.md
git commit -m "The Feed: backlog + CLAUDE.md for the core-loop rework; queue B and C; promote essay CTA

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Merge to main and deploy** — ask Jason before this step; merging to `main` deploys to production.

```bash
git checkout main && git merge --no-ff feed-core-loop -m "The Feed: core loop rework (sub-project A)" && git push origin main
```

Then check the Netlify deploy log, load `https://jasonnellis.com/the-feed`, and play one week.

---

## Self-review notes

- **Spec coverage:** §1 slots/stress → Tasks 2, 7; §2 cards/angles/topics/tail → Tasks 5, 6, 7; §3 views/conv/rpm/churn/hostile follower loss → Tasks 2, 6, 7, 8; §4 business/Studio/hires/overhead → Tasks 3, 4, 8; §5 endings/targets → Tasks 8, 9, 10; §6 sim → Task 9; §7 UI → Task 11; §8 testing → Tasks 1–8; §9 docs → Task 12.
- **Name consistency:** `useSlot`, `addStress`, `stressBand`, `hireInfo`, `upgradeInfo`, `viewsMult`, `stressCost`, `repHit`, `loseFollowers`, `endingText`, `overheadBreakdown`, `pickTopic`, `HORDER`, `AORDER` are spelled identically in engine, tests, sim and UI.
- **Known judgement calls for the implementer:** (a) `stressCost` test hardcodes `18`/`24`/`6` from the initial PLATFORMS values — if Task 10 retunes platform stress, switch those to `E.PLATFORMS.longform.stress` etc.; (b) the sim `Grinder` persona picks the *heaviest* card, which with editor absent is longform — if Task 10 lowers longform stress a lot, Grinder may stop burning out and target 1 fails "correctly": that means the game is too gentle, not that the persona is wrong.

