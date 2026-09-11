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
