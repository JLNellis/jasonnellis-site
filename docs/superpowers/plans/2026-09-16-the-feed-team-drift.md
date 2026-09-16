# The Feed — Team-as-characters 2b (drift + morale) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the cast's drift-and-morale arcs — the roommate-editor drowns at scale, the edgy designer's backlash detonates, overworked hires threaten to walk, and firing thins the candidate pool — completing Pillar 2.

**Architecture:** Engine-heavy, TDD. Three new `EVENTS` (two arc events + one morale event), a hidden `S.hiStressStreak` counter in `settleWeek`, and a `firedRecently` flag that shrinks `dealTeamHand` — all on the consequence engine (`S.flags` + `priority`) and the Team-2a cast (`S.hires` ids, `hiredChar`, `dealTeamHand`). A few new `CONFIG` tuning constants; no existing economy knob changes. **No `SAVE_VERSION` bump** (all new state is absent-means-default).

**Tech Stack:** Vanilla JS (engine UMD), Node for `npm test`/`npm run sim`.

**Depends on:** Team 2a (PR #4). Build this branch off a `main` that has it (so `S.hires` are ids, `dealTeamHand`/`hiredChar` exist, `SAVE_VERSION` is 3).

**Testing model:** Engine/sim are TDD. `npm run sim` on seeds 7/42/123 must stay 6/6 — and unlike the Acts exit, these events **fire on** personas, so expect a real tuning pass (Task 4). `npm test` doesn't parse `the-feed.html`; the browser check in Task 5 confirms the arcs render.

---

## File structure
- **`the-feed-engine.js`** — 3 new `EVENTS`; `hiStressStreak` in `settleWeek` + `newState`; `firedRecently` in `biz.fire`; `dealTeamHand` reads `firedRecently`; new `CONFIG` constants (`moraleStreak`, `firedWindow`, `roommateScale`).
- **`tools/the-feed-test.js`** — arc/morale/pool tests.
- **`tools/the-feed-sim.js`** — rerun/tune only (likely no logic change).
- **`the-feed-BACKLOG.md`** — note.

---

### Task 0: Baseline
- [ ] `npm test` (record total, ~88), `npm run sim` seeds 7/42/123 (6/6). `preview_start {name:"site"}`, load the game, console clean.

---

### Task 1: The two drift arcs (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing tests**
```js
test('roommate-drift: eligible only with the roommate editor at scale, fires once, "let go" clears the editor', () => {
  const S = E.newState('gaming','longform'); S.plats.longform.followers = 45000; S.hires.editor = 'editor-roommate';
  const ev = E.EVENTS.find(e => e.id === 'roommate-drift'); assert.ok(ev && ev.cond(S) && ev.priority(S));
  const noPro = E.newState('gaming','longform'); noPro.plats.longform.followers = 45000; noPro.hires.editor = 'editor-pro';
  assert.ok(!ev.cond(noPro), 'not for the pro');
  const letGo = ev.choices.find(c => c.label === 'Let them go'); letGo.apply(S);
  assert.equal(S.hires.editor, null); assert.ok(S.flags.roommateDrift && S.flags.firedRecently);
  assert.ok(!ev.cond(S), 'fires once');
});
test('edgy-detonation: eligible only with the edgy designer in act 2+, fires once', () => {
  const S = E.newState('gaming','longform'); S.week = 20; S.hires.designer = 'designer-edgy';
  const ev = E.EVENTS.find(e => e.id === 'edgy-detonation'); assert.ok(ev && ev.cond(S));
  const S1 = E.newState('gaming','longform'); S1.week = 5; S1.hires.designer = 'designer-edgy';
  assert.ok(!ev.cond(S1), 'not in act 1');
  ev.choices.find(c => /rein it in/i.test(c.label)).apply(S);
  assert.equal(S.hires.designer, null); assert.ok(S.flags.edgyDetonated); assert.ok(!ev.cond(S));
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Add two `CONFIG` constants near the top: `roommateScale: 40000,`. Add to `EVENTS`:
```js
    { id: 'roommate-drift', kind: 'neutral', emoji: '😰', title: 'Your roommate is drowning at this size.', badge: 'Team',
      cond: S => S.hires.editor === 'editor-roommate' && totalFollowers(S) > CONFIG.roommateScale && !S.flags.roommateDrift,
      priority: S => S.hires.editor === 'editor-roommate' && totalFollowers(S) > CONFIG.roommateScale,
      text: 'The channel got big and the edits didn’t keep up. Your college roommate is working nights and still behind, and everyone can tell the pipeline is straining. They know it too.',
      choices: [
        { t: 'repair', ci: '📈', label: 'Level them up', desc: 'Pay for help and better gear. Keep your friend.', stakes: 'pay ~$1,200 (capped) · keep the editor · rep +1–4',
          apply: S => { S.flags.roommateDrift = S.week; const cost = bite(S, 1200, 0.5); S.rep = clamp(S.rep + rint(1,4), 0, 100); return spend(S, '📈', `You invested in them: −${money(cost)}. They rose to it, mostly, and remembered who bet on them.`, cost, ''); } },
        { t: 'escalate', ci: '🚪', label: 'Let them go', desc: 'Cut the loyal hire. Hire a pro later.', stakes: 'lose the editor · rep −6–12 · the pool thins',
          apply: S => { S.flags.roommateDrift = S.week; S.hires.editor = null; S.flags.firedRecently = S.week; const r = repHit(S, 6, 12); return fed('🚪', `You let your roommate go. The pipeline needed it; the friendship needed the opposite. Rep −${r}.`, 'bad'); } },
      ] },
    { id: 'edgy-detonation', kind: 'hostile', emoji: '💥', title: 'Your designer’s edgiest thumbnail finally blew up in your face.', badge: 'Backlash',
      cond: S => S.hires.designer === 'designer-edgy' && act(S) >= 2 && !S.flags.edgyDetonated,
      priority: S => S.hires.designer === 'designer-edgy' && act(S) >= 2,
      text: 'The louder packaging that juiced your reach for months just crossed the line for a lot of people. There’s a thread, a screenshot, a headline. The thumbnail is the story now.',
      choices: [
        { t: 'escalate', ci: '🤘', label: 'Stand by them', desc: 'Own the bit. Eat the hit.', stakes: 'rep −10–18 · −2–5% followers · keep the designer + the reach',
          apply: S => { S.flags.edgyDetonated = S.week; const r = repHit(S, 10, 18); return hurt(S, '💥', `You backed your designer and the choice. The reach stays; so does the reputation for it. Rep −${r}.`, .02, .05); } },
        { t: 'repair', ci: '✂️', label: 'Rein it in — let them go', desc: 'Cut the edge (and the designer). Smaller hit.', stakes: 'rep −3–7 · lose the edgy designer · the pool thins',
          apply: S => { S.flags.edgyDetonated = S.week; S.hires.designer = null; S.flags.firedRecently = S.week; const r = repHit(S, 3, 7); return fed('✂️', `You cut the edge loose — and the designer with it. The reach cools, the temperature drops. Rep −${r}.`, ''); } },
      ] },
```
- [ ] **Step 4: Run → PASS.** `npm test` green (sim later). Commit (`the-feed-engine.js`, test): `"The Feed: drift arcs — the roommate drowns at scale, the edgy designer detonates"` + trailer.

---

### Task 2: Morale — talk-down-or-lose (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing tests**
```js
test('hiStressStreak counts consecutive fumes+ weeks and sets the morale flag', () => {
  const S = E.newState('gaming','longform'); S.hires.mod = 'mod';
  assert.equal(S.hiStressStreak, 0);
  for (let i=0;i<E.CONFIG.moraleStreak;i++){ S.stress = 95; S.slots.content = 0; E.settleWeek(S); }
  assert.ok(S.hiStressStreak >= E.CONFIG.moraleStreak); assert.ok(S.flags.morale);
  S.stress = 10; E.settleWeek(S); assert.equal(S.hiStressStreak, 0);   // a calm week resets
});
test('team-fraying: needs the morale flag + a hire; "let them walk" drops a hire', () => {
  const S = E.newState('gaming','longform'); S.hires.mod = 'mod'; S.flags.morale = 5;
  const ev = E.EVENTS.find(e => e.id === 'team-fraying'); assert.ok(ev.cond(S) && ev.priority(S));
  ev.choices.find(c => /walk/i.test(c.label)).apply(S);
  assert.equal(E.hireCount(S), 0); assert.equal(S.flags.morale, 0); assert.ok(S.flags.firedRecently);
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Add `CONFIG.moraleStreak: 3,`. In `newState`, add `hiStressStreak: 0,`. In `settleWeek`, after the band/`redlineStreak` block (which computes `band`), add:
```js
    // morale: sustained fumes+ frays the team (a hidden streak, never shown; not a meter)
    S.hiStressStreak = (band === 'fumes' || band === 'redline') ? (S.hiStressStreak || 0) + 1 : 0;
    if (S.hiStressStreak >= CONFIG.moraleStreak && hireCount(S) >= 1) S.flags.morale = S.week;
```
Add the event to `EVENTS`:
```js
    { id: 'team-fraying', kind: 'neutral', emoji: '😮‍💨', title: 'Someone on the team is done.', badge: 'Morale',
      cond: S => !!S.flags.morale && hireCount(S) >= 1,
      priority: S => !!S.flags.morale,
      text: 'Weeks of running on fumes, and it shows — not just in you, in them. One of your people pulls you aside: they can’t keep doing this. They mean it.',
      choices: [
        { t: 'repair', ci: '🤝', label: 'Talk them down', desc: 'A bonus, some time off, an actual apology.', stakes: 'pay ~$800 (capped) · −15 stress · keep them · resets the strain',
          apply: S => { S.flags.morale = 0; S.hiStressStreak = 0; addStress(S, -15); const cost = bite(S, 800, 0.4); return spend(S, '🤝', `You paid attention (and a bonus): −${money(cost)}. They stayed. You both finally slept.`, cost, 'good'); } },
        { t: 'escalate', ci: '🚪', label: 'Let them walk', desc: 'You can’t fix it this week. Wish them well.', stakes: 'lose a hire · rep −3–7 · the pool thins',
          apply: S => { S.flags.morale = 0; S.hiStressStreak = 0; const roles = HORDER.filter(r => S.hires[r]); const role = pick(roles); const c = hiredChar(S, role); S.hires[role] = null; S.flags.firedRecently = S.week; const r = repHit(S, 3, 7); return fed('🚪', `${c ? c.name : 'Someone'} walked out. Payroll’s lighter; so is the room. Rep −${r}.`, 'bad'); } },
      ] },
```
- [ ] **Step 4: Run → PASS.** Commit (`the-feed-engine.js`, test): `"The Feed: morale — overworked hires threaten to walk (talk-down-or-lose)"` + trailer.

---

### Task 3: Firing thins the pool (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing test**
```js
test('firing sets firedRecently and thins the next hand', () => {
  const S = E.newState('gaming','longform'); S.hires.mod = 'mod'; S.slots.business = 1;
  E.biz.fire(S, 'mod'); assert.ok(S.flags.firedRecently);
  // with a recent firing, hands cap smaller
  let big = 0; for (let i=0;i<40;i++){ E.setRng(seeded(i)); E.dealTeamHand(S); big = Math.max(big, S.teamHand.length); }
  assert.ok(big <= 2, 'a recent firing thins the offer to at most 2');
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Add `CONFIG.firedWindow: 4,`. In `biz.fire`, after clearing the role, add `S.flags.firedRecently = S.week;`. In `dealTeamHand`, after computing `want`, add:
```js
    if (S.flags.firedRecently && S.week - S.flags.firedRecently < CONFIG.firedWindow) want = Math.min(want, 2);
```
(Word gets around: fewer candidates for a few weeks after you cut someone.)
- [ ] **Step 4: Run → PASS.** `npm test` green. Commit (`the-feed-engine.js`, test): `"The Feed: firing thins the candidate pool for a few weeks"` + trailer.

---

### Task 4: Sim rerun + tune (sim)

**Files:** `tools/the-feed-sim.js` (only if a persona change is needed), `the-feed-engine.js` (only `CONFIG`/event numbers if tuning)

- [ ] **Step 1:** `npm run sim` seeds 7/42/123. These events now fire on personas: the **Sustainable** hires `editor-roommate` and will hit `roommate-drift` (a cash spend or a lost editor + rep hit) — watch its Niche Legend rate (50–70%); grinding personas will trip morale. Personas resolve by `t` tag via `resolveEvent`, so no persona logic change is expected — but confirm the Sustainable still sees the roommate-drift as `repair`-first (level up) and doesn't collapse.
- [ ] **Step 2:** If any target fails, tune the **event numbers** (the `~$1,200`/`~$800` costs, the rep-hit ranges, `CONFIG.moraleStreak`) — NOT the existing economy knobs or the 2a `CHARACTERS` `fx`. Get all three seeds to 6/6. Record the Sustainable ending mix + the morale-event frequency vs. the Team-2a baseline.
- [ ] **Step 3: Commit** the changes: `"The Feed: keep 6/6 with the drift + morale arcs"` + trailer.

---

### Task 5: Backlog note + final regression + browser
- [ ] **Step 1:** Backlog "Shipped: Team-as-characters 2b" note (the two arcs, morale counter+flag+event, firing-thins-pool; no `SAVE_VERSION` bump; **Pillar 2 complete**; next = the hall 5a). Copy is a draft pending Jason's voice pass.
- [ ] **Step 2: Final guards:** `npm test` all green (record total); `npm run sim` 7/42/123 → 6/6.
- [ ] **Step 3: Browser (`the-feed.html`):** IIFE clean (6 tiles, no console errors). Then exercise at least one arc end-to-end: hire the roommate editor, grow the audience past ~40K (or, faster: confirm the arc fires by driving weeks with a big follower count), and confirm the drift event appears and "let them go" empties the editor seat + thins the next hand; drive the team into fumes for `moraleStreak` weeks and confirm `team-fraying` fires. (Reaching 40K by real play is slow — a targeted check that the event is eligible in a mid/late run is enough; the engine tests already prove the mechanics.) A v3 save still resumes (no version bump).
- [ ] **Step 4:** `preview_stop`. Commit the note.

---

## Self-review notes (author checklist)
- **Spec coverage:** roommate drift (T1) · edgy detonation (T1) · morale counter+flag+event (T2) · firing-thins-pool (T3) · balance (T4). No `SAVE_VERSION` bump (spec-conformant — all new state absent-means-default). Out of scope (other-6 arcs, a meter, the hall) correctly absent.
- **Name/type consistency:** flags `roommateDrift`/`edgyDetonated`/`morale`/`firedRecently`, counter `hiStressStreak`, event ids `roommate-drift`/`edgy-detonation`/`team-fraying`, CONFIG `roommateScale`/`moraleStreak`/`firedWindow` used identically across engine + tests. All reads of the cast go through `S.hires[role]` (ids) / `hiredChar` from 2a.
- **No placeholders in mechanism:** T1–T3 fully coded; event *copy* is a draft for Jason's voice pass, the numbers are tune-in-T4 starting values.
