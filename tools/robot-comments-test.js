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

// ---------------------------------------------------------------- resolveWeek + events
test('resolveWeek rejects bad choices without changing state', () => {
  const S = E.newGame({ archetype: 'seed', budget: 1 });
  const before = JSON.stringify(S);
  assert.throws(() => E.resolveWeek(S, { card: 'not-a-card', engagement: 'none' }), /not in hand/);
  const hand = E.deal(S);
  const pricey = hand.find(k => E.cardCost(k) > 1);
  if (pricey) assert.throws(() => E.resolveWeek(S, { card: pricey.id, engagement: 'none' }), /over budget/);
  const ok = hand.find(k => E.canAfford(S, k, 'none'));
  assert.throws(() => E.resolveWeek(S, { card: ok.id, engagement: 'bogus' }), /engagement/);
  assert.strictEqual(JSON.stringify(S), before);
});

test('every hand has a card affordable with no engagement, even at 1h', () => {
  for (const archetype of ARCH) {
    const S = E.newGame({ archetype, budget: 1 });
    while (!S.done) {
      if (E.weekKind(S) === 'event') { E.resolveEvent(S); continue; }
      const hand = E.deal(S);
      assert.ok(hand.some(k => E.canAfford(S, k, 'none')), `${archetype} week ${S.week}: ${hand.map(k => k.id)}`);
      E.resolveWeek(S, cheapest(S, hand));
    }
  }
});

test('no card is dealt twice in a game', () => {
  for (const archetype of ARCH) for (const budget of [1, 3, 6]) {
    const S = playScript({ archetype, budget }, firstAffordable);
    assert.strictEqual(S.dealt.length, 30);
    assert.strictEqual(new Set(S.dealt).size, 30);
  }
});

test('about half of hands carry a bait card, never more than one', () => {
  let hands = 0, withBait = 0;
  for (const archetype of ARCH) for (const budget of [1, 3, 6]) for (const pick of [cheapest, firstAffordable]) {
    const S = E.newGame({ archetype, budget });
    while (!S.done) {
      if (E.weekKind(S) === 'event') { E.resolveEvent(S); continue; }
      const hand = E.deal(S);
      const n = hand.filter(k => k.bait).length;
      assert.ok(n <= 1);
      hands++; withBait += n;
      E.resolveWeek(S, pick(S, hand));
    }
  }
  const rate = withBait / hands;
  assert.ok(rate > 0.3 && rate < 0.7, 'bait rate ' + rate);
});

test('identical choices give identical games; different choices do not', () => {
  const a = playScript({ archetype: 'fractional', budget: 3 }, firstAffordable);
  const b = playScript({ archetype: 'fractional', budget: 3 }, firstAffordable);
  assert.deepStrictEqual(a, b);
  const c = playScript({ archetype: 'fractional', budget: 3 }, cheapest);
  assert.notDeepStrictEqual(a.rows, c.rows);
});

test('baseline reach stays within 0.5x to 2x of the anchor', () => {
  for (const archetype of ARCH) for (const budget of [1, 3, 6]) {
    const S = E.newGame({ archetype, budget });
    while (!S.done) {
      if (E.weekKind(S) === 'event') E.resolveEvent(S);
      else E.resolveWeek(S, firstAffordable(S, E.deal(S)));
      assert.ok(S.baseline >= 0.5 * S.anchor - 1e-9 && S.baseline <= 2 * S.anchor + 1e-9, `${archetype}/${budget} w${S.week}`);
    }
  }
});

test('two consecutive skips cost 0.30 coherence once', () => {
  const S = E.newGame({ archetype: 'seed', budget: 3 });
  E.resolveWeek(S, { skip: true });
  const afterOne = S.coherence;
  E.resolveWeek(S, { skip: true });
  const decay = E.CONFIG.coherence.decay.v;
  assert.ok(Math.abs(S.coherence - Math.max(0, (afterOne - 0.30) * decay)) < 1e-9);
  assert.strictEqual(S.skips, 2);
  assert.strictEqual(S.rows[1].kind, 'skip');
});

test('pod suppresses the next two decision weeks, skipping event weeks', () => {
  let found = false;
  for (const archetype of ARCH) for (const budget of [1, 3, 6]) {
    const S = E.newGame({ archetype, budget });
    while (!S.done && !found) {
      if (E.weekKind(S) === 'event') { E.resolveEvent(S); continue; }
      const hand = E.deal(S);
      const pod = hand.find(k => k.id === 'bait-pod');
      if (pod) {
        const w = S.week;
        E.resolveWeek(S, { card: pod.id, engagement: 'none' });
        const next = E.nextDecisionWeeks(w, 2);
        assert.ok(next.every(n => !E.CONFIG.eventWeeks.includes(n)));
        for (const n of next) assert.ok(S.suppress[n] <= 0.5 + 1e-9, `week ${n}: ${S.suppress[n]}`);
        found = true;
      } else E.resolveWeek(S, firstAffordable(S, hand));
    }
  }
  assert.ok(found, 'pod never dealt in the scripted games');
});

test('folklore tax counts bait cards except the gated game', () => {
  const played = [];
  const S = E.newGame({ archetype: 'seed', budget: 6 });
  while (!S.done) {
    if (E.weekKind(S) === 'event') { E.resolveEvent(S); continue; }
    const hand = E.deal(S);
    const b = hand.find(k => k.bait);
    if (b) played.push(b.id);
    E.resolveWeek(S, b ? { card: b.id, engagement: 'none' } : firstAffordable(S, hand));
  }
  assert.ok(played.length >= 2, 'expected some bait in a 6h game');
  assert.strictEqual(S.tax, played.filter(id => id !== 'bait-gatedgame').length);
  assert.strictEqual(S.playedGated, played.includes('bait-gatedgame'));
});

test('every card reveals one of the four public stamps', () => {
  for (const k of D.CARDS) {
    const l = E.leverFor(k, { supp: 1, cadence: 1 });
    assert.ok(['proven', 'measured', 'disputed', 'invented'].includes(l.stamp), k.id + ' -> ' + l.stamp);
    assert.ok(D.SOURCES[l.src], k.id);
  }
  const t = D.CARDS.find(k => k.id === 't01');
  assert.strictEqual(E.leverFor(t, { supp: 0.5, cadence: 1 }).key, 'suppressed');
});

// ---------------------------------------------------------------- events + scoring
const STUB = { pipeline: [10, 20, 30], reachTop: 1.2 };
const STUB_BANDS = { seed: STUB, seriesb: STUB, second: STUB, fractional: STUB };
const ended = () => {
  const S = E.newGame({ archetype: 'seed', budget: 3 });
  S.done = true; S.week = 13;
  S.totalImpressions = S.anchorStart * 10; // reach multiple 1.0
  S.pipeline = 25; S.coherence = 0.5;
  return S;
};

test('events land on weeks 5 and 9, two distinct', () => {
  const S = playScript({ archetype: 'seriesb', budget: 3 }, firstAffordable);
  const ev = S.rows.filter(r => r.kind === 'event');
  assert.deepStrictEqual(ev.map(r => r.week), [5, 9]);
  assert.notStrictEqual(ev[0].event, ev[1].event);
  assert.strictEqual(S.rows.length, 12);
  assert.ok(S.done);
});

test('outcome archetype follows the spec rule order', () => {
  let S = ended(); S.tax = 3; S.skips = 2; assert.strictEqual(E.finish(S, STUB_BANDS).archetype, 'pod-casualty');
  S = ended(); S.skips = 2; S.coherence = 0.1; assert.strictEqual(E.finish(S, STUB_BANDS).archetype, 'ghost');
  S = ended(); S.coherence = 0.2; assert.strictEqual(E.finish(S, STUB_BANDS).archetype, 'generalist');
  S = ended(); S.totalImpressions = S.anchorStart * 13; S.pipeline = 15; assert.strictEqual(E.finish(S, STUB_BANDS).archetype, 'broadcaster');
  S = ended(); S.coherence = 0.7; S.pipeline = 31; assert.strictEqual(E.finish(S, STUB_BANDS).archetype, 'fingerprinted-founder');
  S = ended(); S.coherence = 0.7; S.pipeline = 25; assert.strictEqual(E.finish(S, STUB_BANDS).archetype, 'control-group');
  S = ended(); assert.strictEqual(E.finish(S, STUB_BANDS).archetype, 'control-group');
});

test('finish reports band, clarity word, rounded pipeline', () => {
  const at = (pipeline, coherence) => { const S = ended(); S.pipeline = pipeline; S.coherence = coherence; return E.finish(S, STUB_BANDS); };
  assert.strictEqual(at(5, 0.5).band, 'cold');
  assert.strictEqual(at(15, 0.5).band, 'warm');
  assert.strictEqual(at(25, 0.5).band, 'working');
  assert.strictEqual(at(31, 0.5).band, 'hot');
  assert.strictEqual(at(25, 0.3).clarity, 'Blurred');
  assert.strictEqual(at(25, 0.4).clarity, 'Faint');
  assert.strictEqual(at(25, 0.6).clarity, 'Legible');
  assert.strictEqual(at(25, 0.7).clarity, 'Sharp');
  assert.strictEqual(at(25.44, 0.5).pipeline, 25.4);
  assert.strictEqual(at(29.96, 0.5).band, 'hot'); // band uses the displayed (rounded) value
});

test('finish refuses to score without generated bands', () => {
  assert.throws(() => E.finish(ended(), { seed: null }), /sim:rc -- --bands/);
});

// ---------------------------------------------------------------- resume (spec §5a)
test('replay reproduces the live state after every week', () => {
  for (const [archetype, budget] of [['second', 6], ['seed', 1]]) {
    const live = E.newGame({ archetype, budget });
    while (!live.done) {
      if (E.weekKind(live) === 'event') E.resolveEvent(live);
      else E.resolveWeek(live, firstAffordable(live, E.deal(live)));
      const copy = E.replay(JSON.parse(JSON.stringify(E.serialize(live))));
      assert.deepStrictEqual(copy, live, `${archetype} after week ${live.week - 1}`);
    }
  }
});

test('replay of a mid-week save deals the same hand', () => {
  const S = playScript({ archetype: 'seriesb', budget: 3 }, firstAffordable, 3);
  const again = E.replay(E.serialize(S));
  assert.deepStrictEqual(E.deal(again).map(k => k.id), E.deal(S).map(k => k.id));
});

test('replay discards stale versions and corrupted saves', () => {
  const S = playScript({ archetype: 'seed', budget: 3 }, firstAffordable, 4);
  const save = E.serialize(S);
  assert.ok(E.replay(save));
  assert.strictEqual(E.replay({ ...save, v: save.v + 1 }), null);
  assert.strictEqual(E.replay({ ...save, choices: [{ card: 'nope', engagement: 'none' }] }), null);
  assert.strictEqual(E.replay({ ...save, choices: [{ event: true }] }), null);
  assert.strictEqual(E.replay({ v: save.v, setup: { archetype: 'x', budget: 3 }, choices: [] }), null);
  assert.strictEqual(E.replay(null), null);
  assert.strictEqual(E.replay('garbage'), null);
});

// ---------------------------------------------------------------- review fixes (task 5b)
test('engine version is derived from the model, so a rebalance invalidates saves', () => {
  assert.strictEqual(typeof E.ENGINE_VERSION, 'number');
  assert.strictEqual(E.ENGINE_VERSION, E.versionOf(E.CONFIG, D.CARDS));
  const tweaked = JSON.parse(JSON.stringify(E.CONFIG));
  tweaked.coherence.on.v += 0.01;
  assert.notStrictEqual(E.versionOf(tweaked, D.CARDS), E.ENGINE_VERSION);
});

test('card data and CONFIG are frozen so the UI cannot corrupt them', () => {
  assert.ok(Object.isFrozen(D.CARDS) && Object.isFrozen(D.CARDS[0]));
  assert.ok(Object.isFrozen(E.CONFIG.formats.text.reach));
  assert.throws(() => { 'use strict'; D.CARDS[0].title = 'x'; });
});

test('every stamp matches the tier of the source it cites', () => {
  const allowed = new Set(['disputed:vdb']); // vdB's -16% is one side of the disputed link effect
  const check = (stamp, src, what) => {
    if (stamp === 'ours') return;
    const tier = D.SOURCES[src].tier;
    assert.ok(tier === stamp || allowed.has(stamp + ':' + src), `${what}: ${stamp} cites ${src} (${tier})`);
  };
  for (const e of E.stampEntries()) check(e.stamp, e.src, JSON.stringify(e));
  for (const k of D.CARDS.filter(k => k.bait)) check(k.stamp, k.src, k.id);
});

test('replay matches live play under a random policy with skips and bait', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const r = E.rng(seed);
    const live = E.newGame({ archetype: ARCH[seed % 4], budget: [1, 3, 6][seed % 3] });
    while (!live.done) {
      if (E.weekKind(live) === 'event') { E.resolveEvent(live); continue; }
      const hand = E.deal(live);
      const opts = hand.filter(k => E.canAfford(live, k, 'none'));
      if (r() < 0.2 || !opts.length) { E.resolveWeek(live, { skip: true }); continue; }
      const k = opts[Math.floor(r() * opts.length)];
      const engs = E.CONFIG.engagements.filter(e => E.canAfford(live, k, e));
      E.resolveWeek(live, { card: k.id, engagement: engs[Math.floor(r() * engs.length)] });
    }
    assert.deepStrictEqual(E.replay(JSON.parse(JSON.stringify(E.serialize(live)))), live, 'seed ' + seed);
  }
});

test('the reset lowers anchor but not anchorStart', () => {
  let found = false;
  for (const archetype of ARCH) for (const budget of [1, 3, 6]) {
    if (found) break;
    const S = playScript({ archetype, budget }, firstAffordable);
    if (S.events.includes('reset')) {
      assert.ok(Math.abs(S.anchor - S.anchorStart * E.CONFIG.events.reset.permanent.v) < 1e-9);
      found = true;
    }
  }
  assert.ok(found, 'reset never drawn in the scripted games');
});

test('a second bait CTA within three weeks suppresses the next decision week', () => {
  let found = false;
  for (const archetype of ARCH) for (const budget of [1, 3, 6]) {
    const S = E.newGame({ archetype, budget });
    while (!S.done && !found) {
      if (E.weekKind(S) === 'event') { E.resolveEvent(S); continue; }
      const hand = E.deal(S);
      const baitCta = hand.find(k => !k.bait && k.cta === 'bait' && E.canAfford(S, k, 'none'));
      if (baitCta && S.week > 1) {
        const w = S.week;
        S.baitCtaWeeks.push(w - 1);
        E.resolveWeek(S, { card: baitCta.id, engagement: 'none' });
        const next = E.nextDecisionWeeks(w, 1)[0];
        if (next) assert.ok(S.suppress[next] <= E.CONFIG.baitCta.suppression.v + 1e-9);
        found = true;
      } else E.resolveWeek(S, firstAffordable(S, hand));
    }
  }
  assert.ok(found, 'no bait-CTA card dealt in the scripted games');
});

test('a popular-comments boost does not survive an event week', () => {
  const S = playScript({ archetype: 'seriesb', budget: 3 }, firstAffordable, 3);
  const hand = E.deal(S);
  const k = hand.find(k => E.canAfford(S, k, 'popular'));
  assert.ok(k, 'expected a card affordable with popular comments at 3h');
  E.resolveWeek(S, { card: k.id, engagement: 'popular' });
  assert.strictEqual(E.weekKind(S), 'event');
  E.resolveEvent(S);
  const g = E.CONFIG.events.gravity.boost.v;
  assert.ok(S.nextReachMult === 1 || Math.abs(S.nextReachMult - g) < 1e-12, 'nextReachMult ' + S.nextReachMult);
});

// ---------------------------------------------------------------- runner
let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.message)); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
