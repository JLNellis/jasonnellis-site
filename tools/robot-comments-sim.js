#!/usr/bin/env node
/*
 * 80% OF YOUR COMMENTS ARE ROBOTS: balance simulator (spec §11)
 *   npm run sim:rc              run the calibration targets; exit 1 if any fails
 *   npm run sim:rc -- --bands   regenerate robot-comments-bands.js from the random-policy population
 * Policies draw from their own seeded RNG, so every run prints the same numbers.
 * Tune only CONFIG entries stamped 'ours'. Never tune measured, proven or disputed values.
 */
const fs = require('fs');
const path = require('path');
const E = require('../robot-comments-engine.js');
const D = require('../robot-comments-data.js');
const ARCH = Object.keys(D.ARCHETYPES);

const pickBest = scored => scored.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
const affordableIn = (S, hand) => hand.filter(k => E.canAfford(S, k, 'none'));
const taxBait = k => k.bait && k.id !== 'bait-gatedgame';

// Deterministic players would make 200 runs about four distinct games (hands are seeded from
// setup + choices), so the sensible and reach players take their second-best card in ~20% of
// decision weeks, unless the second-best is a card the policy never plays (`avoid`).
const VARY = 0.2;
function pickVaried(scored, r, avoid) {
  const ranked = scored.slice().sort((a, b) => b[1] - a[1]);
  const roll = r();
  if (roll < VARY && ranked.length > 1 && !avoid(ranked[1][0])) return ranked[1][0];
  return ranked[0][0];
}

const POLICIES = {
  // On-cluster, claim-first, a document every third decision week, no bait, in-cluster comments.
  // Varied: second-best card in ~20% of weeks; in ~20% of weeks it could comment in-cluster it doesn't.
  sensible(S, hand, r) {
    const options = affordableIn(S, hand);
    if (!options.length) return { skip: true };
    const docWeek = S.posted.length % 3 === 2;
    const card = pickVaried(options.map(k => {
      let s = r();
      if (k.bait) s += k.id === 'bait-gatedgame' ? -1 : -100;
      s += k.topic === 'on' ? 10 : k.topic === 'adj' ? 3 : -10;
      s += k.hook === 'claim' ? 3 : k.hook === 'scene' ? -2 : 0;
      s += k.cta === 'question' ? 2 : (k.cta === 'bait' || k.cta === 'linkbody') ? -5 : 0;
      s += (k.sub === 'named' || k.sub === 'personal') ? 2 : k.sub === 'promo' ? -3 : 0;
      s += (k.fmt === 'poll' || k.fmt === 'reshare') ? -4 : 0;
      if (docWeek && k.fmt === 'document') s += 8;
      return [k, s];
    }), r, taxBait);
    const lazy = r() < VARY;
    return { card: card.id, engagement: E.canAfford(S, card, 'cluster') && !lazy ? 'cluster' : 'none' };
  },
  // The reach chaser. Within its own topic it takes the format with the highest measured reach
  // multiplier (poll 1.78 > document 1.39 > image 1.20 > text 1.07 > long video > short video >
  // article > reshare); it writes for everyone (generic over named specifics); it never plays a
  // bait card or an engagement-bait CTA (the CTA cuts reach); it comments on popular posts whenever
  // it can afford to and the post is on-cluster; it never skips. Same ~20% second-best variation.
  // Calibration (2026-09-28): the first draft (format-first, mild topic preference, popular comments
  // every week) never reached The Broadcaster: weekly popular comments pinned coherence under 0.35,
  // so every run was The Generalist. The topic and comment preferences above are the adjustment.
  reach(S, hand, r) {
    const options = affordableIn(S, hand);
    if (!options.length) return { skip: true };
    const card = pickVaried(options.map(k => {
      let s = r() * 0.1;
      if (k.bait) s -= 100;
      if (k.cta === 'bait') s -= 10;
      s += 10 * E.CONFIG.formats[k.fmt].reach.v;
      s += k.topic === 'on' ? 10 : k.topic === 'adj' ? 3 : 0;
      if (k.sub === 'generic') s += 5;
      return [k, s];
    }), r, k => k.bait);
    const popular = card.topic === 'on' && E.canAfford(S, card, 'popular');
    return { card: card.id, engagement: popular ? 'popular' : 'none' };
  },
  // Polls, pods, six hashtags, link in body, popular comments, always take the bait.
  vendor(S, hand, r) {
    const options = affordableIn(S, hand);
    if (!options.length) return { skip: true };
    const card = pickBest(options.map(k => {
      let s = r();
      if (k.bait) s += 100;
      if (k.fmt === 'poll') s += 20;
      if (k.cta === 'bait') s += 10;
      if (k.cta === 'linkbody') s += 5;
      if (k.topic === 'off') s += 2;
      return [k, s];
    }));
    return { card: card.id, engagement: E.canAfford(S, card, 'popular') ? 'popular' : 'none' };
  },
  // Uniform over affordable choices, 5% skip.
  random(S, hand, r) {
    if (r() < 0.05) return { skip: true };
    const options = affordableIn(S, hand);
    if (!options.length) return { skip: true };
    const card = options[Math.floor(r() * options.length)];
    const engs = E.CONFIG.engagements.filter(e => E.canAfford(S, card, e));
    return { card: card.id, engagement: engs[Math.floor(r() * engs.length)] };
  },
};

function runGame(setup, policy, seed) {
  const r = E.rng(seed);
  const S = E.newGame(setup);
  while (!S.done) {
    if (E.weekKind(S) === 'event') E.resolveEvent(S);
    else E.resolveWeek(S, policy(S, E.deal(S), r));
  }
  return S;
}

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const round3 = x => Math.round(x * 1000) / 1000;

function bandsSource(bands, date) {
  return `/* GENERATED by tools/robot-comments-sim.js --bands on ${date}. Do not hand-edit.
 * Per-archetype cut points from 3,000 seeded random-policy games (budgets 1/3/6).
 * pipeline: [p25, p60, p85] -> cold | warm | working | hot. reachTop: p75 of reach multiple. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RobotBands = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return ${JSON.stringify(bands, null, 2).replace(/\n/g, '\n  ')};
});
`;
}

function writeBands() {
  const bands = {};
  for (const archetype of ARCH) {
    const pipes = [], reach = [];
    for (let i = 0; i < 3000; i++) {
      const S = runGame({ archetype, budget: E.CONFIG.budgets[i % 3] }, POLICIES.random, 50000 + i);
      pipes.push(Math.round(S.pipeline * 10) / 10); // same rounding finish() bands on
      reach.push(S.totalImpressions / (S.anchorStart * 10));
    }
    bands[archetype] = { pipeline: [pct(pipes, 0.25), pct(pipes, 0.6), pct(pipes, 0.85)].map(round3), reachTop: round3(pct(reach, 0.75)) };
  }
  const file = path.join(__dirname, '..', 'robot-comments-bands.js');
  fs.writeFileSync(file, bandsSource(bands, new Date().toISOString().slice(0, 10)));
  console.log('wrote ' + file);
  console.log(JSON.stringify(bands, null, 2));
}

function population(policy, budget, n = 200) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(E.finish(runGame({ archetype: ARCH[i % ARCH.length], budget }, POLICIES[policy], 1000 + i)));
  return out;
}
const share = (xs, f) => xs.filter(f).length / xs.length;
const hotish = x => x.band === 'working' || x.band === 'hot';
const counts = xs => xs.reduce((m, x) => ((m[x.archetype] = (m[x.archetype] || 0) + 1), m), {});

const median = xs => pct(xs, 0.5);

function runTargets() {
  const pops = {
    'sensible 3h': population('sensible', 3), 'sensible 1h': population('sensible', 1),
    'vendor 3h': population('vendor', 3), 'reach 3h': population('reach', 3),
  };
  for (const b of E.CONFIG.budgets) pops[`random ${b}h`] = population('random', b);
  const sens3 = pops['sensible 3h'], sens1 = pops['sensible 1h'], vend3 = pops['vendor 3h'], reach3 = pops['reach 3h'];
  const is = a => x => x.archetype === a;
  const T = [
    ['sensible 3h: working or hot >= 80%', share(sens3, hotish), v => v >= 0.8],
    ['sensible 3h: Fingerprinted Founder 40-60%', share(sens3, is('fingerprinted-founder')), v => v >= 0.4 && v <= 0.6],
    ['sensible 1h: working or hot <= 40%', share(sens1, hotish), v => v <= 0.4],
    ['vendor 3h: Broadcaster or Pod Casualty >= 80%', share(vend3, x => x.archetype === 'broadcaster' || x.archetype === 'pod-casualty'), v => v >= 0.8],
  ];
  // Reachability: every archetype is reached by at least one population (>= 3% of its runs).
  for (const a of Object.keys(D.OUTCOMES)) {
    const [best, v] = Object.entries(pops).map(([n, xs]) => [n, share(xs, is(a))]).reduce((m, x) => (x[1] > m[1] ? x : m));
    T.push([`${a} reachable >= 3% (best: ${best})`, v, x => x >= 0.03]);
  }
  let fail = 0;
  for (const [name, v, ok] of T) {
    const pass = ok(v);
    if (!pass) fail++;
    console.log(`${pass ? '  ok ' : ' FAIL'}  ${name.padEnd(58)} ${(v * 100).toFixed(1)}%`);
  }
  console.log(`\nsensible 3h median final coherence ${median(sens3.map(x => x.coherence)).toFixed(2)} (aim 0.70-0.90)`);
  console.log(`distinct sensible 3h outcomes: ${new Set(sens3.map(x => x.pipelineRaw.toFixed(6))).size}/200`);
  console.log('');
  for (const [n, xs] of Object.entries(pops)) console.log(n.padEnd(12), JSON.stringify(counts(xs)));
  process.exit(fail ? 1 : 0);
}

if (process.argv.includes('--bands')) writeBands();
else runTargets();
