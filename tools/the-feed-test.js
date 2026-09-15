#!/usr/bin/env node
/*
 * THE FEED — engine tests. Plain Node asserts, seeded RNG, no deps.
 * Run: npm test
 */
const assert = require('assert');
const E = require('../the-feed-engine.js');

// Deterministic LCG so every test sees the same "random" sequence. Warmed up: the raw LCG's
// first output is nearly linear in the seed, which made small-seed searches degenerate.
function seeded(seed) { let s = seed >>> 0; const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; for (let i = 0; i < 3; i++) next(); return next; }

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
  for (let i = 0; i < 200; i++) { const ev = E.drawEvent(S); if (!ev) break; drawn.push(ev.id); if (!ev.repeatable && !S.seenEvents.includes(ev.id)) S.seenEvents.push(ev.id); }
  const repeatableIds = new Set(E.EVENTS.filter(e => e.repeatable).map(e => e.id));
  const nonRepeat = drawn.filter(id => !repeatableIds.has(id));
  assert.strictEqual(nonRepeat.length, new Set(nonRepeat).size, 'a non-repeatable id repeated');
});
test('drawEvent respects minWeek/maxWeek phase gating', () => {
  E.setRng(seeded(6));
  for (const wk of [3, 20, 50]) {
    for (let i = 0; i < 300; i++) {
      const S = mk(); S.week = wk; S.plats.longform.followers = 60000; S.rep = 60; S.deals = 4; S.gear = 3;
      const ev = E.drawEvent(S); if (!ev) continue;
      if (ev.minWeek != null) assert.ok(wk >= ev.minWeek, `${ev.id} fired at wk ${wk} < minWeek ${ev.minWeek}`);
      if (ev.maxWeek != null) assert.ok(wk <= ev.maxWeek, `${ev.id} fired at wk ${wk} > maxWeek ${ev.maxWeek}`);
    }
  }
});
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
// ---------------------------------------------------------------- event deck: size + coverage
test('deck has ~30 cards with early/mid/late coverage', () => {
  assert.ok(E.EVENTS.length >= 28, 'expected >= 28 events, got ' + E.EVENTS.length);
  const hasLate = E.EVENTS.some(e => e.minWeek && e.minWeek >= 36);
  const hasMid  = E.EVENTS.some(e => (e.minWeek && e.minWeek >= 18 && e.minWeek < 36));
  assert.ok(hasLate, 'need at least one late-phase card');
  assert.ok(hasMid, 'need at least one mid-phase card');
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

// ---------------------------------------------------------------- hires + overhead
test('overhead is flat + per-platform + payroll + lease, and breakdown sums', () => {
  const S = mk();
  assert.strictEqual(E.overhead(S), E.CONFIG.overheadBase + E.CONFIG.overheadPerPlatform);
  S.plats.shortform.active = true;
  assert.strictEqual(E.overhead(S), E.CONFIG.overheadBase + E.CONFIG.overheadPerPlatform * 2);
  S.hires.editor = true;
  assert.strictEqual(E.payroll(S), E.HIRES.editor.weekly);
  S.gear = 4;
  const b = E.overheadBreakdown(S);
  assert.strictEqual(b.base, E.CONFIG.overheadBase); assert.strictEqual(b.platforms, E.CONFIG.overheadPerPlatform * 2);
  assert.strictEqual(b.payroll, E.HIRES.editor.weekly); assert.strictEqual(b.lease, E.STUDIOS[4].lease);
  assert.strictEqual(b.total, E.overhead(S));
  assert.strictEqual(b.total, b.base + b.platforms + b.payroll + b.lease);
});
test('hire cap is 2 without studio, 4 with', () => {
  const S = mk(); S.cash = 99999;
  assert.strictEqual(E.hireCap(S), E.CONFIG.hireCapBase);
  E.biz.hire(S, 'editor'); S.slots.business = 1;
  E.biz.hire(S, 'mod'); S.slots.business = 1;
  assert.strictEqual(E.hireCount(S), 2);
  const before = S.cash;
  E.biz.hire(S, 'designer');
  assert.strictEqual(S.hires.designer, false, 'third hire refused without studio');
  assert.strictEqual(S.cash, before, 'refused hire costs nothing');
  assert.strictEqual(S.slots.business, 1, 'refused hire keeps the slot');
  S.gear = 4; assert.strictEqual(E.hireCap(S), E.STUDIOS[4].cap); S.gear = 6; assert.strictEqual(E.hireCap(S), E.STUDIOS[6].cap);
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
  assert.match(E.hireInfo(S, 'mod').reason, /bigger space/i);
  S.gear = 6; S.hires.mod = S.hires.designer = S.hires.producer = S.hires.analyst = true;
  assert.match(E.hireInfo(S, 'editor').reason, /already/i); assert.strictEqual(E.hireCount(S), 6);
});

// ---------------------------------------------------------------- gear + studio + multipliers
test('viewsMult stacks gear, studio, designer, editor(longform/live), fumes', () => {
  const S = mk();
  assert.strictEqual(E.viewsMult(S, 'longform'), 1);
  S.gear = 2; assert.ok(Math.abs(E.viewsMult(S, 'micro') - E.CONFIG.gearViewsMult * E.CONFIG.gearViewsMult) < 1e-9);
  S.gear = 4; assert.ok(Math.abs(E.viewsMult(S, 'micro') - Math.pow(E.CONFIG.gearViewsMult, 3) * E.STUDIOS[4].views) < 1e-9);
  S.gear = 6; assert.ok(Math.abs(E.viewsMult(S, 'micro') - Math.pow(E.CONFIG.gearViewsMult, 3) * E.STUDIOS[6].views) < 1e-9);
  S.gear = 0; S.hires.designer = true; assert.ok(Math.abs(E.viewsMult(S, 'micro') - 1.15) < 1e-9);
  S.hires.designer = false; S.hires.editor = true;
  assert.ok(Math.abs(E.viewsMult(S, 'longform') - 1.05) < 1e-9);
  assert.strictEqual(E.viewsMult(S, 'micro'), 1, 'editor does not touch micro');
  S.hires.editor = false; S.stress = 75; assert.strictEqual(E.viewsMult(S, 'micro'), E.CONFIG.fumesViewsMult);
});
test('stressCost: platform + angle − editor − studio, min 1', () => {
  const S = mk();
  assert.strictEqual(E.stressCost(S, 'longform', 'evergreen'), E.PLATFORMS.longform.stress);
  assert.strictEqual(E.stressCost(S, 'longform', 'personal'), E.PLATFORMS.longform.stress + E.ANGLES.personal.stress);
  S.hires.editor = true; assert.strictEqual(E.stressCost(S, 'longform', 'evergreen'), E.PLATFORMS.longform.stress - 8, 'editor takes 8 off longform');
  assert.strictEqual(E.stressCost(S, 'micro', 'evergreen'), E.PLATFORMS.micro.stress, 'editor does not touch micro');
  S.gear = 4; assert.strictEqual(E.stressCost(S, 'micro', 'evergreen'), E.PLATFORMS.micro.stress - E.STUDIOS[4].stress, 'spare room takes its relief off');
  S.gear = 6; assert.strictEqual(E.stressCost(S, 'micro', 'evergreen'), 1, 'floors at 1');
});
test('upgrade tiers 1-3 cost cash and a business slot', () => {
  const S = mk(); S.cash = 5000;
  E.biz.upgrade(S); assert.strictEqual(S.gear, 1); assert.strictEqual(S.cash, 5000 - E.CONFIG.gearCost[1]); assert.strictEqual(S.slots.business, 0);
  E.biz.upgrade(S); assert.strictEqual(S.gear, 1, 'no slot → refused');
  S.slots.business = 1; E.biz.upgrade(S); assert.strictEqual(S.gear, 2);
});
test('studios: no follower gate; deposit + runway of the NEW overhead; sequential tiers; nothing left after the building', () => {
  const C = E.CONFIG; const S = mk(); S.gear = 3; S.plats.longform.followers = 500;   // tiny audience on purpose
  const need4 = C.gearCost[4] + C.studioRunwayWeeks * E.overheadAt(S, 4);
  S.cash = need4 - 1; const u0 = E.upgradeInfo(S);
  assert.strictEqual(u0.ok, false); assert.match(u0.reason, /weeks of the new overhead/); assert.strictEqual(u0.need, need4);
  E.biz.upgrade(S); assert.strictEqual(S.gear, 3, 'refused');
  S.cash = need4; assert.strictEqual(E.upgradeInfo(S).ok, true, 'money, not followers, opens it');
  const log = E.biz.upgrade(S); assert.strictEqual(S.gear, 4); assert.strictEqual(S.cash, need4 - C.gearCost[4]); assert.ok(log.feed.some(f => f.kind === 'big'));
  assert.strictEqual(E.contentSlots(S), 2, 'the spare room does not add a slot'); assert.strictEqual(E.hireCap(S), 3);
  assert.strictEqual(E.overheadBreakdown(S).lease, E.STUDIOS[4].lease);
  S.cash = 1e6; E.advanceWeek(S); E.biz.upgrade(S); assert.strictEqual(S.gear, 5); assert.strictEqual(E.contentSlots(S), 3); assert.strictEqual(E.hireCap(S), 4);
  E.advanceWeek(S); E.biz.upgrade(S); assert.strictEqual(S.gear, 6); assert.strictEqual(E.contentSlots(S), 3, 'capped at 3'); assert.strictEqual(E.hireCap(S), 6);
  assert.ok(Math.abs(E.viewsMult(S, 'micro') - Math.pow(C.gearViewsMult, 3) * E.STUDIOS[6].views) < 1e-9);
  assert.strictEqual(E.upgradeInfo(S).next, null, 'nothing left to buy');
});
test('producer keeps evergreen tails two weeks longer; analyst slows heat decay', () => {
  E.setRng(seeded(3)); const S = mk(); S.plats.longform.followers = 2000;
  E.doPost(S, 'longform', 'evergreen', 'a', 1); assert.strictEqual(S.tails[0].weeksLeft, E.CONFIG.tailWeeks);
  S.hires.producer = true; E.doPost(S, 'longform', 'evergreen', 'b', 1); assert.strictEqual(S.tails[1].weeksLeft, E.CONFIG.tailWeeks + 2);
  const A = mk(); A.cash = 50000; A.plats.longform.heat = 60; A.plats.longform.lastPost = A.week; E.settleWeek(A);
  const B = mk(); B.cash = 50000; B.plats.longform.heat = 60; B.plats.longform.lastPost = B.week; B.hires.analyst = true; E.settleWeek(B);
  assert.ok(B.plats.longform.heat > A.plats.longform.heat, 'analyst keeps more heat');
});

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
test('buildHand: hot→trend; a single platform gets all three angles (fix 5); ride after a hit', () => {
  // multi-platform: the hot platform is dealt trend
  const M = mk(); M.plats.shortform.active = true; M.plats.micro.active = true; M.plats.shortform.heat = 45;
  const mhand = E.buildHand(M).filter(c => c.kind === 'post' || c.kind === 'ride');
  assert.strictEqual(mhand.find(c => c.pkey === 'shortform').angle, 'trend');
  // one platform: Trend + Evergreen + Personal all on it, so the focused creator picks 2 of 3 —
  // and Personal is offered regardless of rep (it used to be dealt only at rep < 50)
  const S = mk(); S.rep = 60;
  const shand = E.buildHand(S).filter(c => c.kind === 'post');
  const angles = new Set(shand.filter(c => c.pkey === 'longform').map(c => c.angle));
  assert.ok(angles.has('trend') && angles.has('evergreen') && angles.has('personal'), 'all three angles on the one platform');
  assert.strictEqual(shand.filter(c => c.angle === 'personal').length, 1, 'personal dealt exactly once');
  // ride after a hit
  S.lastHit = { key: 'longform', week: S.week - 1 };
  const ride = E.buildHand(S).find(c => c.kind === 'ride');
  assert.ok(ride && ride.pkey === 'longform' && ride.angle === 'trend' && ride.special);
});
test('buildHand keeps the same topic for the same platform+angle within a week', () => {
  const S = mk(); const a = E.buildHand(S).find(c => c.kind === 'post' && c.angle === 'evergreen').topic;
  const b = E.buildHand(S).find(c => c.kind === 'post' && c.angle === 'evergreen').topic;
  assert.strictEqual(a, b);
});
test('buildHand deals ONE expansion card carrying every openable platform; no cross-post card', () => {
  const S = mk(); S.plats.longform.followers = 3000; S.plats.longform.heat = 40; S.plats.shortform.active = true; S.plats.shortform.followers = 100;
  const hand = E.buildHand(S);
  assert.ok(!hand.some(c => c.kind === 'crosspost'), 'cross-post is no longer a card');
  const st = hand.filter(c => c.kind === 'start'); assert.strictEqual(st.length, 1);
  assert.deepStrictEqual(st[0].options, ['micro', 'writing', 'live'], 'every inactive platform under its threshold-met list, in PORDER');
  assert.strictEqual(st[0].pkey, null); assert.strictEqual(st[0].stress, 8);
  // the chooser fills pkey; an unset/invalid pkey falls back to the first option (keeps the sim's old behaviour)
  const T = mk(); T.plats.longform.followers = 3000; const card = E.buildHand(T).find(c => c.kind === 'start');
  E.applyMove(T, Object.assign({}, card, { pkey: 'writing' })); assert.ok(T.plats.writing.active && !T.plats.shortform.active);
  const U = mk(); U.plats.longform.followers = 3000; E.applyMove(U, E.buildHand(U).find(c => c.kind === 'start')); assert.ok(U.plats.shortform.active, 'fallback = first option');
});
test('cross-post: free once-a-week follow-up on a post made this week; half lift; resets destination idle clock', () => {
  const C = E.CONFIG; E.setRng(() => 0.5);
  const S = mk(); S.plats.longform.followers = 10000; S.plats.shortform.active = true; S.plats.shortform.followers = 100; S.plats.shortform.lastPost = S.week - 5;
  assert.deepStrictEqual(E.crossOptions(S), [], 'nothing posted this week yet');
  E.doPost(S, 'longform', 'evergreen', 'x', 1);
  assert.deepStrictEqual(E.crossOptions(S), [{ src: 'longform', dst: 'shortform' }]);
  const slots = S.slots.content, st = S.stress, f0 = S.plats.shortform.followers;
  const log = E.crosspost(S, 'longform', 'shortform');
  assert.strictEqual(S.slots.content, slots, 'no content slot used'); assert.strictEqual(S.stress, st + C.crossStress);
  const moved = S.plats.shortform.followers - f0; assert.ok(moved > 0 && moved <= Math.round(10000 * C.crossLift[1] * 2), 'small lift: ' + moved);
  assert.strictEqual(S.plats.shortform.lastPost, S.week, 'destination no longer idle'); assert.ok(log.feed.some(f => /Cross-posted/.test(f.text)));
  assert.deepStrictEqual(E.crossOptions(S), [], 'once a week'); assert.strictEqual(E.crosspost(S, 'longform', 'shortform').feed.length, 0, 'refused');
  E.advanceWeek(S); assert.strictEqual(S.crossUsed, false);
});
test('endingHint fills thresholds from CONFIG for every ending', () => {
  Object.keys(E.ENDINGS).forEach(k => { const h = E.endingHint(k); assert.ok(h.length > 20, k); assert.ok(!/\{\w+\}/.test(h), 'no unfilled placeholder in ' + k); });
  assert.ok(E.endingHint('goat').includes(E.fmt(E.CONFIG.goatAt)));
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
  assert.match(line, /did [\d.]+K? views on Longform Video\. \+[\d.]+K? followers/);
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
  S.plats.longform.lastPost = S.week; // posted this week → not idle, so base churn applies
  S.tails.push({ pkey: 'longform', topic: 'T', views: 10000, weeksLeft: E.CONFIG.tailWeeks });
  const f0 = S.plats.longform.followers, cash0 = S.cash;
  const log = E.settleWeek(S);
  const tailViews = Math.round(10000 * E.CONFIG.tailRate);
  const expectedGain = Math.round(tailViews * E.CONFIG.baseConv * E.PLATFORMS.longform.loyal * E.ANGLES.evergreen.conv);
  const afterTail = f0 + expectedGain; // churn is applied to the post-tail count
  assert.strictEqual(S.plats.longform.followers, afterTail - Math.round(afterTail * E.CONFIG.churnBase), 'tail gain, then base churn');
  assert.strictEqual(S.totalViews, tailViews);
  assert.ok(S.cash > cash0 - E.overhead(S), 'tail revenue landed');
  assert.ok(log.feed.some(f => /still getting found/.test(f.text)));
  assert.strictEqual(S.tails[0].weeksLeft, 3);
  S.tails[0].weeksLeft = 1; E.settleWeek(S); assert.strictEqual(S.tails.length, 0);
});
test('membership recomputes weekly: grows with new followers, churns, churns double when idle', () => {
  const S = mk(); S.members = 1000; S.newFollowers = 4000; S.plats.longform.lastPost = S.week;
  E.settleWeek(S);
  assert.strictEqual(S.members, Math.round(1000 + 4000 * E.CONFIG.memberNewConv - 1000 * E.CONFIG.memberChurn));
  assert.strictEqual(S.newFollowers, 0, 'reset each week');
  const T = mk(); T.members = 1000; T.plats.longform.lastPost = -9;
  E.settleWeek(T); assert.strictEqual(T.members, 1000 - Math.round(1000 * E.CONFIG.memberChurnIdle));
});
test('membership income = members × memberRate', () => {
  const S = mk(); S.members = 100; S.plats.longform.lastPost = S.week; const cash0 = S.cash;
  E.settleWeek(S);
  const after = Math.round(100 - 100 * E.CONFIG.memberChurn); // members churn before they pay
  assert.strictEqual(S.cash, cash0 + Math.round(after * E.CONFIG.memberRate) - E.overhead(S));
});
test('churn: base, trend cohort at 2x, idle at churnIdle, feed line only when >1%', () => {
  const S = mk(); S.plats.longform.followers = 10000; S.plats.longform.trendFollowers = 2000; S.plats.longform.lastPost = S.week;
  const log = E.settleWeek(S);
  assert.strictEqual(S.plats.longform.followers, 10000 - Math.round(8000 * E.CONFIG.churnBase) - Math.round(2000 * E.CONFIG.churnTrend));
  assert.strictEqual(S.plats.longform.trendFollowers, 2000 - Math.round(2000 * E.CONFIG.churnTrend));
  assert.ok(!log.feed.some(f => /people left/.test(f.text)), 'small churn is silent');
  const T = mk(); T.plats.longform.followers = 10000; T.plats.longform.lastPost = T.week - 3; T.week = 4;
  const log2 = E.settleWeek(T);
  assert.strictEqual(T.plats.longform.followers, 10000 - Math.round(10000 * E.CONFIG.churnIdle));
  assert.ok(log2.feed.some(f => /people left/.test(f.text)), 'idle churn is loud');
});
test('cadence is not punished: alternating angles weekly never tires the audience', () => {
  E.setRng(seeded(5)); const S = mk('edu', 'longform'); S.plats.longform.followers = 5000;
  for (let w = 0; w < 8; w++) { E.doPost(S, 'longform', 'evergreen', 'a' + w, 1); E.doPost(S, 'longform', 'trend', 'b' + w, 1); E.settleWeek(S); E.advanceWeek(S); }
  assert.ok(S.plats.longform.fatigue < E.CONFIG.tiredAt, 'fatigue stays low: ' + S.plats.longform.fatigue);
  assert.ok(!E.postCard(S, S.plats.longform, 'evergreen', false).tired);
});
test('repetition tires the audience of THAT angle only; switching angles relieves it', () => {
  const C = E.CONFIG; E.setRng(seeded(5)); const S = mk('edu', 'longform'); S.plats.longform.followers = 5000;
  let log; for (let i = 0; i < 4; i++) { log = E.doPost(S, 'longform', 'trend', 't' + i, 1); }
  assert.ok(S.plats.longform.fatigue >= C.tiredAt, 'tired after repeats');
  assert.ok(log.feed.some(f => /see the pattern/.test(f.text)), 'announced when it crosses');
  const same = E.postCard(S, S.plats.longform, 'trend', false), other = E.postCard(S, S.plats.longform, 'evergreen', false);
  assert.ok(same.tired && !other.tired);
  assert.ok(Math.abs(same.mod / other.mod - C.tiredViewsMult) < 1e-9 || same.mod < other.mod, 'same-angle card is penalised');
  E.doPost(S, 'longform', 'evergreen', 'e', 1); assert.ok(S.plats.longform.fatigue < C.tiredAt + 1 - C.repeatAngleRelief + C.repeatAngleGain, 'relief on switch');
});
test('a second post on the same platform in the same week is diluted; the counter resets weekly', () => {
  const C = E.CONFIG; const views = (pre) => { E.setRng(() => 0.5); const S = mk('edu', 'longform'); S.plats.longform.followers = 5000; S.plats.longform.weekPosts = pre; const v0 = S.totalViews; E.doPost(S, 'longform', 'evergreen', 'x', 1); return S.totalViews - v0; };
  const a = views(0), b = views(1);
  assert.ok(Math.abs(b / a - C.sameWeekDilution) < 0.02, `dilution ratio ${b / a}`);
  E.setRng(seeded(1)); const S = mk(); E.doPost(S, 'longform', 'evergreen', 'x', 1); assert.strictEqual(S.plats.longform.weekPosts, 1); E.advanceWeek(S); assert.strictEqual(S.plats.longform.weekPosts, 0);
});
test('newsletter over-send: two issues in a week churn readers and members', () => {
  const C = E.CONFIG; const S = mk(); S.cash = 50000; S.plats.writing.active = true; S.plats.writing.followers = 1000; S.plats.writing.weekPosts = 2; S.plats.writing.lastPost = S.week; S.members = 100; S.plats.longform.lastPost = S.week;
  const log = E.settleWeek(S);
  assert.ok(S.plats.writing.followers <= 1000 - Math.round(1000 * C.newsletterOverSendChurn), 'readers lost');
  assert.ok(log.feed.some(f => /one was plenty/.test(f.text)));
});
test('lifestyle creep: living steps up with peak followers, never down, announced once per step', () => {
  const C = E.CONFIG; const S = mk(); S.cash = 50000; S.plats.longform.lastPost = S.week;
  assert.strictEqual(E.livingStep(S), 0); assert.strictEqual(E.overheadBreakdown(S).base, C.overheadBase);
  S.plats.longform.followers = C.livingSteps[0][0] + 5; const log = E.settleWeek(S);
  assert.strictEqual(E.livingStep(S), 1); assert.strictEqual(E.livingCost(S), C.livingSteps[0][1]);
  assert.ok(log.feed.some(f => /Living is/.test(f.text)), 'step announced');
  S.plats.longform.followers = 100; const log2 = E.settleWeek(S);   // audience collapses: lifestyle doesn't
  assert.strictEqual(E.livingCost(S), C.livingSteps[0][1]); assert.ok(!log2.feed.some(f => /Living is/.test(f.text)), 'announced only once');
  S.plats.longform.followers = C.livingSteps[2][0]; E.settleWeek(S); assert.strictEqual(E.livingCost(S), C.livingSteps[2][1]);
});
test('taxOwed reads the accrued bill without settling it', () => {
  const S = mk(); S.grossEarned = 1000; S.taxedThrough = 200;
  assert.strictEqual(E.taxOwed(S), Math.round(800 * E.CONFIG.taxRate)); assert.strictEqual(S.taxedThrough, 200);
});
test('idle churn ramps with each account-wide silent week and caps; a neglected platform alone stays flat', () => {
  const C = E.CONFIG;
  const at = w => { const S = mk(); S.week = 20; S.plats.longform.lastPost = 20 - w; return E.idleChurnRate(S, S.plats.longform); };
  // two platforms: longform silent 8 weeks, micro posted this week → longform pays the flat idle rate
  const M = mk(); M.week = 20; M.plats.micro.active = true; M.plats.micro.lastPost = 20; M.plats.longform.lastPost = 12;
  assert.strictEqual(E.idleChurnRate(M, M.plats.longform), C.churnIdle, 'still posting elsewhere: flat');
  assert.strictEqual(E.idleChurnRate(M, M.plats.micro), 0);
  assert.strictEqual(at(0), 0); assert.strictEqual(at(C.idleWeeks - 1), 0, 'not idle yet');
  assert.strictEqual(at(C.idleWeeks), C.churnIdle);
  assert.ok(Math.abs(at(C.idleWeeks + 1) - (C.churnIdle + C.churnIdleRamp)) < 1e-9, 'one extra silent week adds the ramp');
  assert.ok(Math.abs(at(C.idleWeeks + 2) - (C.churnIdle + 2 * C.churnIdleRamp)) < 1e-9);
  assert.strictEqual(at(30), C.churnIdleCap, 'capped');
  const N = mk(); N.week = 6; assert.strictEqual(E.silentWeeks(N, N.plats.longform), 5, 'never posted counts from week 1');
  // settleWeek applies the ramped rate to both cohorts
  const S = mk(); S.week = 20; S.plats.longform.followers = 10000; S.plats.longform.trendFollowers = 2000; S.plats.longform.lastPost = 20 - (C.idleWeeks + 2);
  const r = E.idleChurnRate(S, S.plats.longform); const log = E.settleWeek(S);
  assert.strictEqual(S.plats.longform.followers, 10000 - Math.round(2000 * r) - Math.round(8000 * r));
  assert.ok(log.feed.some(f => /forgot you exist/.test(f.text)), 'long silence gets the sharper line');
});
test('stress: band + redline streak judged before recovery; recovery is stressRecover + stressRecoverPerEmptySlot per empty slot', () => {
  const S = mk(); S.stress = 60; S.slots.content = 2;
  let log = E.settleWeek(S);
  assert.strictEqual(S.band, 'hot'); assert.ok(log.feed.some(f => /Running hot/.test(f.text)), 'normal→hot logged');
  assert.strictEqual(S.stress, 60 - E.CONFIG.stressRecover - 2 * E.CONFIG.stressRecoverPerEmptySlot);
  S.stress = 95; S.slots.content = 0; log = E.settleWeek(S);
  assert.strictEqual(S.band, 'redline'); assert.strictEqual(S.redlineStreak, 1);
  assert.ok(log.feed.some(f => /Redline/.test(f.text)), 'hot→redline logged');
  assert.strictEqual(S.stress, 95 - E.CONFIG.stressRecover);
  S.stress = 100; E.settleWeek(S); assert.strictEqual(S.redlineStreak, 2);
  S.stress = 60; E.settleWeek(S); assert.strictEqual(S.redlineStreak, 0, 'streak resets'); assert.strictEqual(S.band, 'hot');
  S.stress = 30; log = E.settleWeek(S); assert.strictEqual(S.band, 'normal'); assert.ok(log.feed.some(f => /under control/.test(f.text)), 'hot→normal logged');
});

// ---------------------------------------------------------------- business + events
test('engage uses the business slot and adds CONFIG.engageStress', () => {
  const S = mk(); const r0 = S.rep, s0 = S.stress; E.biz.engage(S);
  assert.ok(S.rep > r0); assert.strictEqual(S.stress, s0 + E.CONFIG.engageStress); assert.strictEqual(S.slots.business, 0);
  const r1 = S.rep; E.biz.engage(S); assert.strictEqual(S.rep, r1, 'refused without slot');
});
test('deal: gated at 1K, pays more at high rep, manager boosts pay and softens rep cost', () => {
  const S = mk(); S.plats.longform.followers = 500; E.biz.deal(S); assert.strictEqual(S.deals, 0);
  S.plats.longform.followers = 10000;
  E.setRng(seeded(5)); const lo = mk(); lo.plats.longform.followers = 10000; lo.rep = 40; const c0 = lo.cash; E.biz.deal(lo);
  E.setRng(seeded(5)); const hi = mk(); hi.plats.longform.followers = 10000; hi.rep = 80; const c1 = hi.cash; E.biz.deal(hi);
  const expectRatio = (E.CONFIG.dealRepBase + 0.8) / (E.CONFIG.dealRepBase + 0.4);
  assert.ok(Math.abs((hi.cash - c1) / (lo.cash - c0) - expectRatio) < 0.01, `rep 80 pays ${expectRatio.toFixed(2)}x rep 40`);
  E.setRng(seeded(5)); const m = mk(); m.plats.longform.followers = 10000; m.rep = 80; m.hires.manager = true; const c2 = m.cash; E.biz.deal(m);
  assert.ok(Math.abs((m.cash - c2) / (hi.cash - c1) - 1.3) < 0.01, 'manager 1.3x');
  assert.ok((80 - m.rep) < (80 - hi.rep), 'manager softens rep cost');
  assert.strictEqual(m.stress, E.CONFIG.startStress + E.CONFIG.dealStress);
});
test('paid membership: gated, once, uses the slot', () => {
  const S = mk(); E.biz.paid(S); assert.strictEqual(S.members, 0);
  S.plats.longform.followers = 2000; E.biz.paid(S); assert.ok(S.members >= 2000 * E.CONFIG.memberConvMin && S.members <= 2000 * E.CONFIG.memberConvMax); assert.strictEqual(S.slots.business, 0);
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
    // some escalations (e.g. the troll-swarm chance(.45)) are coin flips, so loop seeds
    // rather than assuming the first seed lands on a 'bad' outcome.
    for (let seed = 1; seed < 40 && !lostAny; seed++) { E.setRng(seeded(seed)); const S = mk(); S.week = 20; S.rep = 80; S.plats.longform.followers = 10000; const log = esc.apply(S); if (log.feed[0].kind === 'bad') lostAny = S.plats.longform.followers < 10000; }
    assert.ok(lostAny, ev.title);
  });
});
test('follower-loss float anchors on the platform that actually lost them', () => {
  const S = mk(); S.plats.shortform.active = true;
  S.plats.longform.followers = 10000; S.plats.shortform.followers = 9900; // a 1–3% loss on longform drops it below shortform
  const esc = E.EVENTS.find(e => /crypto/.test(e.title)).choices.find(c => c.t === 'escalate');
  const log = esc.apply(S);
  const f = log.floats.find(x => x.tone === 'loss' && /^plat:/.test(x.anchor));
  assert.ok(f, 'has a follower-loss float');
  assert.strictEqual(f.anchor, 'plat:longform');
  assert.ok(S.plats.longform.followers < 10000 && S.plats.shortform.followers === 9900);
});
test('endingText fills platform count and the star/goat thresholds from CONFIG', () => {
  const S = mk(); S.plats.shortform.active = true;
  assert.match(E.endingText(S, 'burnout').blurb, /Feeding 2 platforms/);
  assert.match(E.endingText(S, 'star').blurb, new RegExp('^' + E.fmt(E.CONFIG.starAt) + '-plus'));
  assert.match(E.endingText(S, 'goat').blurb, new RegExp('^' + E.fmt(E.CONFIG.goatAt) + '-plus'));
  assert.ok(!/\{(n|s|star|goat)\}/.test(E.endingText(S, 'star').blurb + E.endingText(S, 'goat').blurb + E.endingText(S, 'burnout').blurb));
});
test('no engine code references energy or skill', () => {
  const src = require('fs').readFileSync(require.resolve('../the-feed-engine.js'), 'utf8');
  assert.ok(!/S\.energy|S\.skill|skillCap|\brent\(/.test(src));
});
test('previewPost: read-only view/follower range that brackets an actual post, no mutation', () => {
  const S = mk(); const card = E.buildHand(S).find(c => c.kind === 'post' && c.pkey === 'longform');
  const before = JSON.stringify(S);
  const pv = E.previewPost(S, card);
  assert.strictEqual(JSON.stringify(S), before, 'previewPost must not mutate state');
  assert.ok(pv.viewsLo >= 1 && pv.viewsHi > pv.viewsLo, 'a real low<high range');
  assert.ok(pv.followersHi >= pv.followersLo, 'follower range ordered');
  // an actual post of the same card lands inside the previewed view range (with margin for rounding)
  const T = mk(); const c2 = E.buildHand(T).find(c => c.kind === 'post' && c.pkey === 'longform');
  const p2 = E.previewPost(T, c2); const v0 = T.totalViews;
  E.setRng(() => 0.5); E.applyMove(T, c2); const got = T.totalViews - v0;
  assert.ok(got >= p2.viewsLo * 0.6 && got <= p2.viewsHi * 1.4, `actual ${got} within preview ${p2.viewsLo}-${p2.viewsHi}`);
  assert.strictEqual(E.previewPost(S, { kind: 'start' }), null, 'no preview for non-post cards');
});
test('THUMBS: an authored thumbnail string for every one of the 90 topic lines, index-aligned', () => {
  let n = 0;
  Object.keys(E.TOPICS).forEach(niche => Object.keys(E.TOPICS[niche]).forEach(angle => {
    const titles = E.TOPICS[niche][angle], thumbs = E.THUMBS[niche] && E.THUMBS[niche][angle];
    assert.ok(Array.isArray(thumbs) && thumbs.length === titles.length, `${niche}/${angle} thumb count matches topics`);
    titles.forEach((t, i) => { assert.ok(thumbs[i] && thumbs[i].trim(), `${niche}/${angle}[${i}] has a thumb`);
      assert.strictEqual(E.thumbFor(niche, angle, t), thumbs[i], 'thumbFor resolves the title to its thumb'); n++; });
  }));
  assert.strictEqual(n, 90, 'exactly 90 topic lines covered');
  assert.strictEqual(E.thumbFor('gaming', 'trend', 'not a real topic'), null, 'unknown topic falls back');
});
test('choices that echo: Take the bag flags soldOut and makes crypto-fallout eligible + weighted', () => {
  const S = mk(); S.week = 6;
  const crypto = E.EVENTS.find(e => e.id === 'crypto-dm');
  const bag = crypto.choices.find(c => c.label === 'Take the bag');
  assert.ok(!E.EVENTS.find(e => e.id === 'crypto-fallout').cond(S), 'fallout not eligible before the bag');
  bag.apply(S);
  assert.strictEqual(S.flags.soldOut, 6, 'soldOut flag stamped with the week');
  S.week = 9;   // 3 weeks later, inside the 2–8 window
  const fallout = E.EVENTS.find(e => e.id === 'crypto-fallout');
  assert.ok(fallout.cond(S) && fallout.priority(S), 'fallout now eligible and prioritised');
  S.week = 20;  // past the 8-week window
  assert.ok(!fallout.cond(S), 'the echo window closes');
});

// ---------------------------------------------------------------- runner
let failed = 0;
for (const [name, fn] of tests) {
  try { E.setRng(seeded(42)); fn(); console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed ? 1 : 0);
