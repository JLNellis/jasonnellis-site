# The Feed — Team-as-characters 2a (dealt cast + traits) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the six always-available role modifiers into an 8-character cast dealt as a weekly roguelike shop — each hire a bet, not a checkbox — via `S.hires[role]` becoming a character id whose `fx` the modifier sites read.

**Architecture:** Engine-heavy and TDD (`the-feed-engine.js` has `npm test` + `npm run sim`). `S.hires[role]` goes boolean→id; a `CHARACTERS` table holds each hire's price + `fx`; `hiredChar(S,role)` sources the magnitude at the same modifier sites they live today (no new formula shape). `dealTeamHand` fills a weekly `S.teamHand`. The sim's `nextHire` picks from the dealt hand. `SAVE_VERSION` → 3. The Team panel (chrome) shows the dealt candidates instead of the six-role menu.

**Tech Stack:** Vanilla JS (engine UMD, game inline IIFE), Node for `npm test`/`npm run sim`.

**Depends on:** Pillar 1 (Acts, PRs #2/#3). Build this branch off a `main` that has them, so `SAVE_VERSION` is at 2 before this bumps it to 3.

**Testing model:** Engine/sim are TDD. `npm test` does NOT parse `the-feed.html` — after every chrome task load `http://localhost:8080/the-feed.html`, confirm the IIFE ran (`#nichegrid .pick` length 6) with no console errors (IIFE internals aren't console-reachable — verify observable behavior). Every `fx`/price change reruns `npm run sim` on seeds 7/42/123 (6/6). Preview: served at `http://localhost:8080/the-feed.html`.

---

## File structure
- **`the-feed-engine.js`** — `CHARACTERS` + `hiredChar`; `S.hires` ids + `S.teamHand` in `newState`; `dealTeamHand`; the ~8 modifier sites sourcing `fx`; `biz.hire`/`fire`/`hireInfo`; `payroll`.
- **`tools/the-feed-test.js`** — cast/hand/hire/fire/fx tests.
- **`tools/the-feed-sim.js`** — `nextHire` from the dealt hand.
- **`the-feed.html`** — Team panel + business card rework; `SAVE_VERSION` → 3.
- **`the-feed-BACKLOG.md`** — note.

---

### Task 0: Baseline
- [ ] `npm test` (record total, ~83), `npm run sim` seeds 7/42/123 (6/6). `preview_start {name:"site"}`, load the game, console clean.

---

### Task 1: The `CHARACTERS` cast + `hiredChar` (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing test**
```js
test('CHARACTERS: 8 characters, valid roles, editor+designer each have two', () => {
  const roles = ['editor','manager','mod','designer','producer','analyst'];
  const ids = Object.keys(E.CHARACTERS);
  assert.equal(ids.length, 8);
  ids.forEach(id => { const c = E.CHARACTERS[id]; assert.ok(roles.includes(c.role)); assert.ok(c.name && c.sign>0 && c.weekly>0 && c.fx); });
  const byRole = r => ids.filter(id => E.CHARACTERS[id].role === r).length;
  assert.equal(byRole('editor'), 2); assert.equal(byRole('designer'), 2);
  ['manager','mod','producer','analyst'].forEach(r => assert.equal(byRole(r), 1));
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Replace the `HIRES`/`HORDER` block (keep `HORDER` — the role order — but repurpose `HIRES` usages to `CHARACTERS`). Add near the old `HIRES`:
```js
  // The cast: each hire is a character filling one of the six roles. Two roles (editor,
  // designer) offer an in-role bet; the rest are a single distinctive hire. `fx` holds the
  // magnitudes the modifier sites read (so a hire is data, not a hard-coded constant).
  // Copy is a draft (Jason voice-passes); numbers tuned against the sim.
  const CHARACTERS = {
    'editor-roommate': { role:'editor',  name:'Your college roommate', sign:400, weekly:80,  blurb:'Loyal, cheap, in over their head eventually. Cuts some of the grind.', fx:{ stressCut:5,  viewsBump:1.0 } },
    'editor-pro':      { role:'editor',  name:'The seasoned pro',       sign:850, weekly:160, blurb:'Expensive and worth it. Cuts the grind hard and sharpens the work.',      fx:{ stressCut:10, viewsBump:1.08 } },
    'designer-steady': { role:'designer',name:'The reliable designer',  sign:800, weekly:140, blurb:'Clean thumbnails, on time. More clicks everywhere.',                      fx:{ viewsBump:1.15 } },
    'designer-edgy':   { role:'designer',name:'The edgy designer',      sign:600, weekly:120, blurb:'Louder packaging, more reach — and more people mad about it.',           fx:{ viewsBump:1.22, edgy:true } },
    'manager':         { role:'manager', name:'The manager',           sign:500, weekly:90,  blurb:'Better deals, less of the sellout smell.',                               fx:{ dealMult:1.3, dealRepMult:0.6 } },
    'mod':             { role:'mod',     name:'The community mod',      sign:400, weekly:60,  blurb:'Keeps the comments from becoming the story.',                            fx:{ repHitMult:0.67, followerLossMult:0.5 } },
    'producer':        { role:'producer',name:'The producer',          sign:900, weekly:160, blurb:'Runs the back catalogue. Evergreen posts earn two weeks longer.',         fx:{ tailWeeks:2 } },
    'analyst':         { role:'analyst', name:'The analyst',           sign:1000,weekly:180, blurb:'Reads the numbers so you don’t. Heat fades slower.',                      fx:{ heatKeep:0.9 } },
  };
  const hiredChar = (S, role) => S.hires[role] ? CHARACTERS[S.hires[role]] : null;
```
Export `CHARACTERS, hiredChar,` in the public API. (Keep the old `HIRES` object present only if something still needs its labels; prefer migrating all reads to `CHARACTERS`. `HORDER` stays.)
- [ ] **Step 4: Run → PASS.** Commit (`the-feed-engine.js`, test): `"The Feed: add the CHARACTERS cast + hiredChar"` + trailer.

---

### Task 2: `S.hires` boolean→id + modifier sites source `fx` (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing test**
```js
test('S.hires holds character ids; the pro editor beats the roommate on stress + views', () => {
  const S = E.newState('gaming','longform');
  assert.deepEqual(S.hires, { editor:null, manager:null, mod:null, designer:null, producer:null, analyst:null });
  S.hires.editor = 'editor-roommate'; const roomStress = E.stressCost(S,'longform','trend'); const roomViews = E.viewsMult(S,'longform');
  S.hires.editor = 'editor-pro';      const proStress  = E.stressCost(S,'longform','trend'); const proViews  = E.viewsMult(S,'longform');
  assert.ok(proStress < roomStress, 'pro cuts more stress'); assert.ok(proViews > roomViews, 'pro adds views, roommate does not');
});
test('payroll sums the hired characters\' weekly', () => {
  const S = E.newState('gaming','longform'); S.hires.mod = 'mod'; S.hires.analyst = 'analyst';
  assert.equal(E.payroll(S), E.CHARACTERS.mod.weekly + E.CHARACTERS.analyst.weekly);
});
```
- [ ] **Step 2: Run → FAIL** (newState still booleans; sites read booleans).
- [ ] **Step 3: Implement.**
  - `newState`: `hires: { editor:null, manager:null, mod:null, designer:null, producer:null, analyst:null }`, and add `teamHand: [],`.
  - `viewsMult`: replace `if (S.hires.designer) m *= 1.15;` and `if (S.hires.editor && (pkey==='longform'||pkey==='live')) m *= 1.05;` with:
    ```js
    const des = hiredChar(S,'designer'); if (des) m *= des.fx.viewsBump;
    const ed = hiredChar(S,'editor'); if (ed && (pkey==='longform'||pkey==='live')) m *= ed.fx.viewsBump;
    ```
  - `stressCost`: replace `if (S.hires.editor && ...) c -= 8;` with `const ed = hiredChar(S,'editor'); if (ed && (pkey==='longform'||pkey==='live')) c -= ed.fx.stressCut;`
  - `repHit`: `const mod = hiredChar(S,'mod'), des = hiredChar(S,'designer'); let mult = mod ? mod.fx.repHitMult : 1; if (des && des.fx.edgy) mult *= 1.15; const n = Math.round(rint(lo,hi)*mult); ...`
  - `loseFollowers`: replace `(S.hires.mod ? 0.5 : 1)` with `(hiredChar(S,'mod') ? hiredChar(S,'mod').fx.followerLossMult : 1)`.
  - `settleWeek` heat: `const an = hiredChar(S,'analyst'); const heatKeep = an ? an.fx.heatKeep : 0.82;`
  - `doPost` tail: replace `(S.hires.producer ? 2 : 0)` with `(hiredChar(S,'producer') ? hiredChar(S,'producer').fx.tailWeeks : 0)`.
  - `biz.deal`: `const mgr = hiredChar(S,'manager');` then `* (mgr ? mgr.fx.dealMult : 1)` on pay and `* (mgr ? mgr.fx.dealRepMult : 1)` on the rep hit.
  - `payroll`: `HORDER.reduce((s,k)=> s + (hiredChar(S,k) ? hiredChar(S,k).weekly : 0), 0)`.
  - `hireCount`: `HORDER.filter(k => S.hires[k]).length` still works (truthy id).
- [ ] **Step 4: Run → PASS.** Then `npm run sim` seeds 7/42/123 — will likely FAIL until the sim can hire (Task 5); that's expected, don't tune yet. Just confirm `npm test` is green.
- [ ] **Step 5: Commit** (`the-feed-engine.js`, test): `"The Feed: S.hires holds character ids; modifier sites read fx"` + trailer.

---

### Task 3: The dealt hand (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing test**
```js
test('dealTeamHand: 2–3 candidates, never a filled role, stable within a week', () => {
  E.setRng(seeded(4));
  const S = E.newState('gaming','longform'); E.dealTeamHand(S);
  assert.ok(S.teamHand.length >= 2 && S.teamHand.length <= 3);
  S.teamHand.forEach(id => assert.ok(E.CHARACTERS[id], 'valid id'));
  // fill a role → future hands never offer it
  S.hires.editor = 'editor-pro';
  for (let i=0;i<20;i++){ E.dealTeamHand(S); assert.ok(!S.teamHand.some(id => E.CHARACTERS[id].role==='editor'), 'no editor offered when filled'); }
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.**
```js
  function dealTeamHand(S) {
    const filled = new Set(HORDER.filter(r => S.hires[r]));
    const pool = Object.keys(CHARACTERS).filter(id => !filled.has(CHARACTERS[id].role));
    // pick 2–3 distinct, and never two characters of the same still-open role in one hand
    const hand = [], seenRole = new Set(); let tries = 0;
    const want = pool.length >= 3 ? rint(2,3) : pool.length;
    while (hand.length < want && tries++ < 50) {
      const id = pick(pool);
      if (hand.includes(id) || seenRole.has(CHARACTERS[id].role)) continue;
      hand.push(id); seenRole.add(CHARACTERS[id].role);
    }
    S.teamHand = hand; return hand;
  }
```
Call it in `newState` (before `return S;`, after hires init) and in `advanceWeek` (so each week re-deals): add `dealTeamHand(S);` to `advanceWeek`.
- [ ] **Step 4: Run → PASS.** Commit (`the-feed-engine.js`, test): `"The Feed: deal 2–3 team candidates per week (S.teamHand)"` + trailer.

---

### Task 4: Hire / fire from the hand (engine, TDD)

**Files:** `the-feed-engine.js`, `tools/the-feed-test.js`

- [ ] **Step 1: Failing test**
```js
test('hireInfo/biz.hire work on a candidate id; fire clears the role', () => {
  const S = E.newState('gaming','longform'); S.cash = 5000; S.teamHand = ['mod'];
  assert.ok(E.hireInfo(S,'mod').ok);
  E.biz.hire(S,'mod'); assert.equal(S.hires.mod, 'mod'); assert.ok(S.cash < 5000);
  // can't hire a candidate not in the dealt hand
  S.slots.business = 1; S.teamHand = []; assert.ok(!E.hireInfo(S,'analyst').ok);
  E.biz.fire(S,'mod'); assert.equal(S.hires.mod, null);
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Rewrite `hireInfo(S, id)` to validate a candidate id: `const c = CHARACTERS[id]; if (!c) return {ok:false,reason:'No such candidate.'}; if (!S.teamHand.includes(id)) return {ok:false,reason:'Not on offer this week.'}; if (S.hires[c.role]) return {ok:false,reason:'That seat is filled.'}; if (hireCount(S) >= hireCap(S)) return {ok:false,reason: S.gear>=6?'Team is full.':'No room. A bigger space holds more people.'}; if (S.cash < c.sign) return {ok:false,reason:'Signing costs '+money(c.sign)+'.'}; if (S.slots.business <= 0) return {ok:false,reason:'No business slot left this week.'}; return {ok:true,reason:''};` — Rewrite `biz.hire(S, id)`: `const c = CHARACTERS[id]; if (!c || !hireInfo(S,id).ok || !useSlot(S,'business')) return L(); S.cash -= c.sign; S.hires[c.role] = id; ... feed line ("Hired <name>. Payroll is now <payroll>/week...")`. — `biz.fire(S, role)`: `const c = hiredChar(S, role); if (!c || !useSlot(S,'business')) return L(); S.hires[role] = null; ... feed line ("Let <name> go. Payroll −<weekly>/week...")`.
- [ ] **Step 4: Run → PASS.** `npm test` green. Commit (`the-feed-engine.js`, test): `"The Feed: hire/fire from the dealt hand"` + trailer.

---

### Task 5: Sim picks from the dealt hand + tuning (sim)

**Files:** `tools/the-feed-sim.js`

- [ ] **Step 1: Rework `nextHire`.** The current `H.nextHire(S, order)` finds the first affordable role in a fixed order — that no longer works (roles aren't freely available; you hire from `S.teamHand`). Replace with a helper that picks the best offered candidate for a persona's preference order over IDs, gated on `E.hireInfo(S, id).ok` and a cash buffer:
```js
nextHire(S, prefIds) {
  return (S.teamHand || []).slice()
    .sort((a,b) => prefIds.indexOf(a) - prefIds.indexOf(b))   // persona's preference among what's offered
    .find(id => prefIds.includes(id) && E.hireInfo(S, id).ok && S.cash > E.CHARACTERS[id].sign * 4) || null;
}
```
Update each persona that hires to pass an ID preference list instead of a role order, e.g. the Sustainable's `H.nextHire(S, ['editor-roommate','mod'])`, the Optimizer's `H.nextHire(S, ['editor-pro','designer-steady','manager','mod','producer','analyst'])`, and return `{hire: id}` (the runner already calls `E.biz.hire(S, id)` — confirm the runner passes the value through; if it maps `{hire}` to a role, update it to pass the id).
- [ ] **Step 2: Balance.** `npm run sim` on seeds 7/42/123 → tune character `fx`/prices until **6/6**. Watch: the Optimizer still reaching Star/GOAT with the pro editor + designer; the Sustainable still hitting Legend with cheaper hires; no persona >85% into one ending. Record the hire mix and the before/after ending mix.
- [ ] **Step 3: Commit** (`the-feed-engine.js` if you retuned `fx`, `tools/the-feed-sim.js`): `"The Feed: sim hires from the dealt hand; retune the cast to 6/6"` + trailer.

---

### Task 6: `SAVE_VERSION` → 3 (chrome)

**Files:** `the-feed.html`
- [ ] Change `SAVE_VERSION = 2` → `3` (the `S.hires` shape changed + `S.teamHand` is new, so v2 saves must retire). Verify (browser): plant a `{v:2,...}` save → reload → no Continue, IIFE clean. Commit: `"The Feed: bump SAVE_VERSION to 3 for the character roster"` + trailer.

---

### Task 7: Team panel + business card rework (chrome, browser-verified)

**Files:** `the-feed.html`

The Team dialog and the desktop Studio/Team panel currently render the six fixed roles from `HORDER`/`HIRES`/`S.hires[r]`. Rework them to render **this week's dealt candidates** (`S.teamHand`) as hire cards plus the **current roster** (`E.hiredChar(S,r)` for each role) as fire rows.

- [ ] **Step 1: Migrate references.** Anywhere the chrome reads `S.hires[r]` as a boolean or `HIRES[r]`, switch to `E.hiredChar(S,r)` (returns the character or null) and its `.name`/`.blurb`/`.weekly`. The `S.hires.designer` note in `renderStudio` (the "· Designer ×1.15 on top" line) reads the hired designer's `fx.viewsBump`.
- [ ] **Step 2: Rebuild `teamRowsHTML` (~L1312–1327).** Two sections: **(a) On offer this week** — map `S.teamHand.filter(id => !S.hires[E.CHARACTERS[id].role])` to candidate cards showing `name`, role label, the trait `blurb`, `sign` + `weekly`, and a Hire button (`data-hire="<id>"`, disabled with the reason from `E.hireInfo(S,id)` when not ok). **(b) Your team** — map the filled roles (`HORDER.filter(r => S.hires[r])`) to rows showing the hired character's `name` + a Fire button (`data-fire="<role>"`). Empty states: "No new faces this week." / "No one on the payroll yet." Wire `data-hire` → `bizDo('hire', id)` and `data-fire` → `bizDo('fire', role)` (confirm `bizDo`/`takeMove` pass the argument to `E.biz.hire`/`E.biz.fire` unchanged; hire now takes an id, fire a role).
- [ ] **Step 3: Business card (~L1258).** The Team card's summary line reads the roster via `E.hiredChar`; its count stays `hireCount`/`hireCap`. The `Manage ▸` chip opens the dialog as today.
- [ ] **Step 4: Verify (browser).** IIFE clean (6 tiles, no console errors). Start a run, open Team → see 2–3 named candidates (not the six-role menu); the offer differs across weeks (advance a couple weeks and reopen); hiring one fills the role, shows it under "Your team", raises payroll/overhead, and removes that role from future offers; firing returns the seat. Screenshot the panel. Mobile + desktop.
- [ ] **Step 5: Commit** (`the-feed.html`): `"The Feed: Team panel shows this week's dealt candidates + roster"` + trailer.

---

### Task 8: Backlog note + final regression
- [ ] Backlog "Shipped: Team-as-characters 2a" note (the cast, dealt hand, `S.hires` ids, `SAVE_VERSION` 3, sim rework; 2b = drift + morale). `npm test` all green (record total); `npm run sim` 7/42/123 → 6/6; browser end-to-end (hire a candidate, see the fx apply — e.g. hire the pro editor and confirm a longform post's stress/reach preview changes). `preview_stop`. Commit the note.

---

## Self-review notes (author checklist)
- **Spec coverage:** cast (T1) · `S.hires` ids + fx sites (T2) · dealt hand (T3) · hire/fire (T4) · sim (T5) · version bump (T6) · panel rework (T7). Save bump present; drift/morale correctly absent (2b).
- **Name/type consistency:** `CHARACTERS` (keyed by id), `hiredChar(S,role)`, `S.hires[role]=id|null`, `S.teamHand=[ids]`, `dealTeamHand`, `fx` keys (`stressCut`,`viewsBump`,`repHitMult`,`followerLossMult`,`heatKeep`,`tailWeeks`,`dealMult`,`dealRepMult`,`edgy`) used identically across engine/tests/sim/chrome. `biz.hire(id)` vs `biz.fire(role)` argument types called out where wired.
- **No placeholders in mechanism:** engine tasks fully coded; the cast *copy* and the exact `fx`/prices are drafts to tune in T5 and voice-pass, but the shape and sites are complete.
