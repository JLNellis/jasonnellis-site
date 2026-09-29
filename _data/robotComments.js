// Eleventy global data (robotComments): the evidence page and the share pages are
// built from the same files the game runs on, so they cannot drift (spec §10a).
const D = require('../robot-comments-data.js');
const E = require('../robot-comments-engine.js');
const C = require('../robot-comments-copy.js');

const L = C.labels;
const TIERS = ['proven', 'measured', 'disputed', 'invented'];

const source = id => ({ id, cite: D.SOURCES[id].cite, url: D.SOURCES[id].url });
const row = (key, label, entry) => ({
  key, label,
  stamp: entry.stamp, stampLabel: L.stamps[entry.stamp],
  ours: entry.mag === 'ours',
  why: C.why[key],
  source: source(entry.src),
});

// One row per lever the game can reveal, using the same stamped entries the engine's leverFor uses.
function levers() {
  const F = E.CONFIG.formats, H = E.CONFIG.hooks, SB = E.CONFIG.substance, CT = E.CONFIG.cta, EV = E.CONFIG.events;
  const rows = [];
  for (const f of Object.keys(F)) rows.push(row('format:' + f, L.formats[f], F[f].reach));
  for (const h of ['claim', 'scene']) rows.push(row('hook:' + h, L.hooks[h], H[h]));
  for (const s of ['named', 'personal', 'promo']) rows.push(row('sub:' + s, L.substance[s], SB[s].contrib));
  rows.push(row('cta:question', L.cta.question, CT.question.contrib));
  rows.push(row('cta:linkbody', L.cta.linkbody, CT.linkbody.dwell));
  rows.push(row('cta:linkcomment', L.cta.linkcomment, CT.linkcomment.dwell));
  rows.push(row('cta:bait', L.cta.bait, CT.bait.reach));
  rows.push(row('suppressed', C.evidence.suppressedLabel, { stamp: 'proven', src: 'jurka26', mag: 'ours' }));
  for (const k of D.CARDS.filter(k => k.bait)) rows.push(row(k.id, k.title, k));
  for (const e of D.EVENTS) rows.push(row('event:' + e.id, C.events[e.id].name, EV[e.id].lever));
  return rows;
}

module.exports = () => {
  const rows = levers();
  return {
    title: C.title,
    tagline: C.tagline,
    evidence: C.evidence,
    oursNote: C.week.oursNote,
    sourceLink: C.week.sourceLink,
    titleStamp: Object.assign({}, C.titleStamp, { stampLabel: L.stamps[C.titleStamp.stamp], source: source(C.titleStamp.src) }),
    tiers: TIERS.map(t => ({ tier: t, label: L.stamps[t], meaning: L.stampMeaning[t], rows: rows.filter(r => r.stamp === t) }))
      .filter(g => g.rows.length),
    rows,
    outcomes: Object.keys(D.OUTCOMES).map(slug => ({
      slug, name: C.outcomes[slug].name, tagline: C.outcomes[slug].tagline, image: '/og-robot-comments-' + slug + '.jpg',
    })),
  };
};
