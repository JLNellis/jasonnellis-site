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

// ---------------------------------------------------------------- runner
let failed = 0;
for (const [name, fn] of tests) {
  try { E.setRng(seeded(42)); fn(); console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed ? 1 : 0);
