#!/usr/bin/env node
/*
 * 80% OF YOUR COMMENTS ARE ROBOTS: engine tests. Plain Node asserts, no deps.
 * Run: npm run test:rc
 */
const assert = require('assert');
const E = require('../robot-comments-engine.js');
const D = require('../robot-comments-data.js');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const ARCH = Object.keys(D.ARCHETYPES);

// ---------------------------------------------------------------- helpers
// Scripted players. Deterministic: no randomness beyond the engine's own seeding.
const cheapest = (S, hand) => {
  const k = hand.filter(k => E.canAfford(S, k, 'none')).sort((a, b) => E.cardCost(a) - E.cardCost(b))[0];
  return k ? { card: k.id, engagement: 'none' } : { skip: true };
};
const firstAffordable = (S, hand) => {
  const k = hand.find(k => E.canAfford(S, k, 'cluster'));
  return k ? { card: k.id, engagement: 'cluster' } : cheapest(S, hand);
};
function playScript(setup, pick, stopAfter = Infinity) {
  const S = E.newGame(setup);
  for (let steps = 0; !S.done && steps < stopAfter; steps++) {
    if (E.weekKind(S) === 'event') E.resolveEvent(S);
    else E.resolveWeek(S, pick(S, E.deal(S)));
  }
  return S;
}

// ---------------------------------------------------------------- core
test('hashStr and rng are deterministic', () => {
  assert.strictEqual(E.hashStr('abc'), E.hashStr('abc'));
  assert.notStrictEqual(E.hashStr('abc'), E.hashStr('abd'));
  const a = E.rng(42), b = E.rng(42);
  for (let i = 0; i < 5; i++) assert.strictEqual(a(), b());
});

test('newGame validates setup and sets the anchor from connections', () => {
  const S = E.newGame({ archetype: 'seriesb', budget: 3 });
  assert.ok(Math.abs(S.anchor - 4000 * 0.12) < 1e-9);
  assert.strictEqual(S.anchorStart, S.anchor);
  assert.strictEqual(S.week, 1);
  assert.strictEqual(E.weekKind(S), 'decision');
  assert.throws(() => E.newGame({ archetype: 'nope', budget: 3 }), /archetype/);
  assert.throws(() => E.newGame({ archetype: 'seed', budget: 2 }), /budget/);
});

test('card pool matches the spec: 40 regular, 7 bait, valid dimensions', () => {
  const reg = D.CARDS.filter(k => !k.bait), bait = D.CARDS.filter(k => k.bait);
  assert.strictEqual(reg.length, 40);
  assert.strictEqual(bait.length, 7);
  assert.strictEqual(new Set(D.CARDS.map(k => k.id)).size, 47);
  for (const k of D.CARDS) {
    assert.ok(E.CONFIG.formats[k.fmt], k.id);
    assert.ok(['on', 'adj', 'off'].includes(k.topic), k.id);
    assert.ok(E.CONFIG.hooks[k.hook], k.id);
    assert.ok(E.CONFIG.substance[k.sub], k.id);
    assert.ok(E.CONFIG.cta[k.cta], k.id);
  }
  assert.ok(reg.filter(k => E.cardCost(k) <= 1).length >= 15, 'need enough 1h-affordable cards');
});

test('every stamped value resolves to a source', () => {
  const TIERS = ['proven', 'measured', 'disputed', 'invented', 'ours'];
  const entries = E.stampEntries();
  assert.ok(entries.length > 50);
  for (const e of entries) {
    assert.ok(TIERS.includes(e.stamp), JSON.stringify(e));
    if (e.stamp !== 'ours') assert.ok(D.SOURCES[e.src], 'missing source ' + e.src);
  }
  for (const k of D.CARDS.filter(k => k.bait)) {
    assert.ok(TIERS.slice(0, 4).includes(k.stamp), k.id);
    assert.ok(D.SOURCES[k.src], k.id);
  }
});

test('deal is pure, returns 3 cards, at most one bait', () => {
  const S = E.newGame({ archetype: 'seed', budget: 3 });
  const h1 = E.deal(S).map(k => k.id), h2 = E.deal(S).map(k => k.id);
  assert.deepStrictEqual(h1, h2);
  assert.strictEqual(h1.length, 3);
  assert.ok(E.deal(S).filter(k => k.bait).length <= 1);
});

// ---------------------------------------------------------------- runner
let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.message)); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
