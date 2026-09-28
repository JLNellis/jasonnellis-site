/*
 * 80% OF YOUR COMMENTS ARE ROBOTS: engine (pure, no DOM, no Node specifics)
 * ------------------------------------------------------------------
 * Single source of truth for the model. Consumers:
 *   robot-comments.html            (browser, <script> after data + bands)
 *   tools/robot-comments-sim.js    (Node, balance runner)
 *   tools/robot-comments-test.js   (Node, tests)
 *
 * Every coefficient is c(value, stamp, source, mag):
 *   stamp: 'proven' | 'measured' | 'disputed' | 'invented' | 'ours'
 *   source: a key of RobotData.SOURCES (null only for 'ours')
 *   mag: 'ours' when the mechanism is sourced but the magnitude is ours
 * Only 'ours' values may be tuned. Run `npm run sim:rc` after any change.
 *
 * Determinism: the game is a pure function of setup + the ordered choice
 * list. Hands, event draws and noise are seeded from that list, so a save is
 * just { v, setup, choices } and resume is replay().
 *
 * Weekly orchestration (UI and sim follow the same sequence):
 *   weekKind(S) === 'event'    -> resolveEvent(S)
 *   weekKind(S) === 'decision' -> hand = deal(S); resolveWeek(S, choice)
 *   S.done                     -> finish(S)
 * Spec: docs/superpowers/specs/2026-09-28-robot-comments-design.md
 * ------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./robot-comments-data.js'), require('./robot-comments-bands.js'));
  else root.RobotEngine = factory(root.RobotData, root.RobotBands);
})(typeof self !== 'undefined' ? self : this, function (D, BANDS) {
  'use strict';

  // Bump whenever a change would make an old save replay into a different game.
  const ENGINE_VERSION = 1;

  const P = 'proven', M = 'measured', X = 'disputed', O = 'ours';
  const c = (v, stamp, src = null, mag = null) => ({ v, stamp, src, mag });

  // ======================= MODEL (spec §7) =======================
  const CONFIG = {
    weeks: 12,
    eventWeeks: [5, 9],
    budgets: [1, 3, 6],
    engagements: ['none', 'cluster', 'popular'],
    engagementCost: 0.5,
    reachPerConnection: c(0.12, O),
    startCoherence: c(0.5, O),
    // Mechanism proven (headline is in every post's text); the four values are ours.
    headlineFit: {
      seed: c(1.0, P, 'danchev', O), seriesb: c(0.8, P, 'danchev', O),
      second: c(0.6, P, 'danchev', O), fractional: c(0.5, P, 'danchev', O),
    },
    // reach and contrib (engagement / reach, per impression) from AuthoredUp; dwell is ours.
    formats: {
      text:       { cost: 1,    reach: c(1.07, M, 'authoredup'), dwell: c(1.0, O), contrib: c(0.73, M, 'authoredup') },
      image:      { cost: 1.5,  reach: c(1.20, M, 'authoredup'), dwell: c(1.0, O), contrib: c(1.11, M, 'authoredup') },
      document:   { cost: 3,    reach: c(1.39, M, 'authoredup'), dwell: c(1.3, O), contrib: c(0.94, M, 'authoredup') },
      shortvideo: { cost: 2,    reach: c(0.83, M, 'authoredup'), dwell: c(0.9, O), contrib: c(1.08, M, 'authoredup') },
      longvideo:  { cost: 4,    reach: c(1.04, M, 'authoredup'), dwell: c(1.2, O), contrib: c(1.05, M, 'authoredup') },
      poll:       { cost: 0.5,  reach: c(1.78, M, 'authoredup'), dwell: c(0.6, O), contrib: c(0.21, M, 'authoredup') },
      article:    { cost: 3,    reach: c(0.69, M, 'authoredup'), dwell: c(1.1, O), contrib: c(0.64, M, 'authoredup') },
      reshare:    { cost: 0.25, reach: c(0.29, M, 'authoredup'), dwell: c(0.5, O), contrib: c(0.76, M, 'authoredup') },
    },
    // Applied to both dwell and contribution (Jason's data is an engagement ratio).
    hooks: { claim: c(1.10, M, 'jason107'), scene: c(0.90, M, 'jason107'), question: c(0.95, O), listicle: c(1.0, O) },
    substance: {
      named:    { dwell: c(1.05, O), contrib: c(1.2, M, 'jason107') },
      generic:  { dwell: c(1.0, O),  contrib: c(1.0, O) },
      personal: { dwell: c(1.1, O),  contrib: c(2.0, M, 'jason107'), offClusterFit: c(0.9, O) },
      promo:    { dwell: c(0.8, O),  contrib: c(0.75, M, 'jason107') },
    },
    cta: {
      question:    { reach: c(1, O), dwell: c(1, O), contrib: c(1.5, M, 'jason107'), click: c(0.03, O) },
      none:        { reach: c(1, O), dwell: c(1, O), contrib: c(1, O), click: c(0.03, O) },
      linkbody:    { reach: c(1, O), dwell: c(0.84, X, 'vdb'), contrib: c(1, O), click: c(0.08, O) },
      linkcomment: { reach: c(1, O), dwell: c(0.95, X, 'ordinal'), contrib: c(1, O), click: c(0.05, O) },
      bait:        { reach: c(0.6, P, 'jurka26', O), dwell: c(1, O), contrib: c(1.1, O), click: c(0.03, O) },
    },
    base: { dwell: c(0.30, O), contrib: c(0.02, O), cap: c(0.95, O) },
    // Distribution loop: baseline *= 1 + a*dwell + b*contrib - c*scroll, clamped to [lo, hi] x anchor.
    loop: { a: c(0.15, O), b: c(0.20, O), c: c(0.10, O), lo: c(0.5, O), hi: c(2.0, O) },
    noise: c(0.08, O),
    skipDecay: c(0.95, O),
    cadenceOne: c(0.9, O), // one post in the last two decision weeks; why-line quotes vdB's "two to three a week"
    engagement: { popularNextReach: c(1.06, O), popularVisits: c(1.10, O), clusterVisits: c(1.05, O) },
    coherence: {
      on: c(0.12, O), adj: c(0.03, O), off: c(-0.15, O),
      cluster: c(0.05, O), popular: c(-0.08, O),
      silentPenalty: c(0.30, O), decay: c(0.94, O),
    },
    // visits = reach * dwell * (base + specific + doc); dms = visits * fit * dmRate
    pipeline: { visitsBase: c(0.07, O), visitsSpecific: c(0.10, O), visitsDoc: c(0.07, O), dmRate: c(0.04, O) },
    baitRate: c(0.5, O),
    baitCta: { window: 3, suppression: c(0.5, P, 'jurka26', O) },
    bait: {
      'bait-hashtags6': { reach: c(0.85, M, 'authoredup', O) },
      'bait-pod': { contribDisplay: c(1.5, O), suppression: c(0.5, P, 'jurka26', O), weeks: 2 },
      'bait-gatedgame': { startRate: c(0.05, O), startToLead: c(0.401, M, 'interact') },
    },
    events: {
      swarm:   { lever: c(null, P, 'jurka26'), contribDisplay: 40 },
      reset:   { lever: c(null, M, 'vdb'), permanent: c(0.85, O) },
      gravity: { lever: c(null, P, 'danchev', O), threshold: 0.5, boost: c(1.08, O) },
      audit:   { lever: c(null, P, 'danchev', O), low: c(-0.10, O), high: c(0.05, O) },
    },
    clarity: [[0.35, 'Blurred'], [0.5, 'Faint'], [0.65, 'Legible'], [Infinity, 'Sharp']],
  };

  // ======================= RNG =======================
  // cyrb53 string hash -> 53-bit int; mulberry32 PRNG.
  function hashStr(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const choiceKey = ch => (ch.event ? 'ev' : ch.skip ? 'skip' : ch.card + ':' + ch.engagement);
  const seedFor = (S, salt) =>
    hashStr([S.setup.archetype, S.setup.budget, S.choices.map(choiceKey).join(','), salt].join('|'));
  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // ======================= GAME =======================
  const BY_ID = {};
  for (const k of D.CARDS) BY_ID[k.id] = k;

  function newGame(setup) {
    const A = setup && D.ARCHETYPES[setup.archetype];
    if (!A) throw new Error('unknown archetype ' + (setup && setup.archetype));
    if (!CONFIG.budgets.includes(setup.budget)) throw new Error('bad budget ' + setup.budget);
    const anchor = A.connections * CONFIG.reachPerConnection.v;
    return {
      v: ENGINE_VERSION,
      setup: { archetype: setup.archetype, budget: setup.budget },
      week: 1, done: false,
      anchor, anchorStart: anchor, baseline: anchor,
      coherence: CONFIG.startCoherence.v,
      headlineFit: CONFIG.headlineFit[setup.archetype].v,
      pipeline: 0, tax: 0, playedGated: false,
      weeksSilent: 0, skips: 0,
      choices: [], dealt: [], posted: [], events: [], rows: [],
      suppress: {}, nextReachMult: 1, baitCtaWeeks: [],
      totalImpressions: 0, best: null,
    };
  }

  function weekKind(S) {
    if (S.done || S.week > CONFIG.weeks) return 'done';
    return CONFIG.eventWeeks.includes(S.week) ? 'event' : 'decision';
  }

  const cardCost = k => CONFIG.formats[k.fmt].cost + (k.extraCost || 0);
  const engagementCost = e => (e === 'none' ? 0 : CONFIG.engagementCost);
  const canAfford = (S, k, e) => cardCost(k) + engagementCost(e || 'none') <= S.setup.budget + 1e-9;

  // Pure: same state, same hand. Nothing is recorded until resolveWeek.
  function deal(S) {
    if (weekKind(S) !== 'decision') return [];
    const r = rng(seedFor(S, 'deal'));
    const used = new Set(S.dealt);
    const regular = shuffle(D.CARDS.filter(k => !k.bait && !used.has(k.id)), r);
    const bait = shuffle(D.CARDS.filter(k => k.bait && !used.has(k.id)), r);
    const hand = regular.slice(0, 3);
    if (bait.length && r() < CONFIG.baitRate.v) hand[2] = bait[0];
    if (!hand.some(k => cardCost(k) <= S.setup.budget)) {
      const cheap = regular.slice(3).find(k => cardCost(k) <= S.setup.budget);
      if (cheap) hand[0] = cheap;
    }
    return shuffle(hand, r);
  }

  function stampEntries() {
    const out = [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if ('stamp' in o) { out.push(o); return; }
      for (const k of Object.keys(o)) walk(o[k]);
    })(CONFIG);
    return out;
  }

  return { ENGINE_VERSION, CONFIG, hashStr, rng, newGame, weekKind, deal, cardCost, canAfford, stampEntries };
});
