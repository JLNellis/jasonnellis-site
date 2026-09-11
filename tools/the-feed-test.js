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
  assert.strictEqual(b.payroll, E.HIRES.editor.weekly); assert.strictEqual(b.lease, E.CONFIG.studioLease);
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
  S.gear = 4; assert.strictEqual(E.hireCap(S), E.CONFIG.hireCapStudio);
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

// ---------------------------------------------------------------- gear + studio + multipliers
test('viewsMult stacks gear, studio, designer, editor(longform/live), fumes', () => {
  const S = mk();
  assert.strictEqual(E.viewsMult(S, 'longform'), 1);
  S.gear = 2; assert.ok(Math.abs(E.viewsMult(S, 'micro') - E.CONFIG.gearViewsMult * E.CONFIG.gearViewsMult) < 1e-9);
  S.gear = 4; assert.ok(Math.abs(E.viewsMult(S, 'micro') - Math.pow(E.CONFIG.gearViewsMult, 3) * E.CONFIG.studioViewsMult) < 1e-9);
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
  S.hires.editor = true; assert.strictEqual(E.stressCost(S, 'longform', 'evergreen'), 10);
  assert.strictEqual(E.stressCost(S, 'micro', 'evergreen'), E.PLATFORMS.micro.stress, 'editor does not touch micro');
  S.gear = 4; assert.strictEqual(E.stressCost(S, 'micro', 'evergreen'), 1, 'floors at 1');
});
test('upgrade tiers 1-3 cost cash and a business slot', () => {
  const S = mk(); S.cash = 5000;
  E.biz.upgrade(S); assert.strictEqual(S.gear, 1); assert.strictEqual(S.cash, 5000 - E.CONFIG.gearCost[1]); assert.strictEqual(S.slots.business, 0);
  E.biz.upgrade(S); assert.strictEqual(S.gear, 1, 'no slot → refused');
  S.slots.business = 1; E.biz.upgrade(S); assert.strictEqual(S.gear, 2);
});
test('studio requires tier 3, 25K followers and $12K', () => {
  const S = mk(); S.gear = 3; S.cash = 20000; S.plats.longform.followers = 1000;
  assert.strictEqual(E.upgradeInfo(S).ok, false); assert.match(E.upgradeInfo(S).reason, /25K/);
  E.biz.upgrade(S); assert.strictEqual(S.gear, 3);
  S.plats.longform.followers = 30000;
  assert.strictEqual(E.upgradeInfo(S).ok, true); assert.strictEqual(E.upgradeInfo(S).cost, E.CONFIG.gearCost[4]);
  const log = E.biz.upgrade(S);
  assert.strictEqual(S.gear, 4); assert.strictEqual(S.cash, 20000 - E.CONFIG.gearCost[4]);
  assert.ok(log.feed.some(f => f.kind === 'big'));
  assert.strictEqual(E.upgradeInfo(S).next, null, 'nothing left to buy');
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
  assert.strictEqual(S.cash, cash0 + Math.round(97 * E.CONFIG.memberRate) - E.overhead(S));
});
test('churn: base, trend cohort at 2x, idle at churnIdle, feed line only when >1%', () => {
  const S = mk(); S.plats.longform.followers = 10000; S.plats.longform.trendFollowers = 2000; S.plats.longform.lastPost = S.week;
  const log = E.settleWeek(S);
  assert.strictEqual(S.plats.longform.followers, 10000 - Math.round(8000 * E.CONFIG.churnBase) - Math.round(2000 * E.CONFIG.churnTrend));
  assert.strictEqual(S.plats.longform.trendFollowers, 2000 - Math.round(2000 * E.CONFIG.churnTrend));
  assert.ok(!log.feed.some(f => /unfollowed/.test(f.text)), 'small churn is silent');
  const T = mk(); T.plats.longform.followers = 10000; T.plats.longform.lastPost = T.week - 3; T.week = 4;
  const log2 = E.settleWeek(T);
  assert.strictEqual(T.plats.longform.followers, 10000 - Math.round(10000 * E.CONFIG.churnIdle));
  assert.ok(log2.feed.some(f => /unfollowed/.test(f.text)), 'idle churn is loud');
});
test('stress: band + redline streak judged before recovery; recovery is 12 + 8 per empty slot', () => {
  const S = mk(); S.stress = 60; S.slots.content = 2;
  let log = E.settleWeek(S);
  assert.strictEqual(S.band, 'hot'); assert.ok(log.feed.some(f => /running hot/.test(f.text)), 'normal→hot logged');
  assert.strictEqual(S.stress, 60 - E.CONFIG.stressRecover - 2 * E.CONFIG.stressRecoverPerEmptySlot);
  S.stress = 95; S.slots.content = 0; log = E.settleWeek(S);
  assert.strictEqual(S.band, 'redline'); assert.strictEqual(S.redlineStreak, 1);
  assert.ok(log.feed.some(f => /REDLINE/.test(f.text)), 'hot→redline logged');
  assert.strictEqual(S.stress, 95 - E.CONFIG.stressRecover);
  S.stress = 100; E.settleWeek(S); assert.strictEqual(S.redlineStreak, 2);
  S.stress = 60; E.settleWeek(S); assert.strictEqual(S.redlineStreak, 0, 'streak resets'); assert.strictEqual(S.band, 'hot');
  S.stress = 30; log = E.settleWeek(S); assert.strictEqual(S.band, 'normal'); assert.ok(log.feed.some(f => /under control/.test(f.text)), 'hot→normal logged');
});

// ---------------------------------------------------------------- runner
let failed = 0;
for (const [name, fn] of tests) {
  try { E.setRng(seeded(42)); fn(); console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed ? 1 : 0);
