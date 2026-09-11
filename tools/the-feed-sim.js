#!/usr/bin/env node
/*
 * THE FEED — balance simulator
 * ------------------------------------------------------------------
 * Runs thousands of playthroughs driven by different player "personas"
 * and reports how the balance lands. All game mechanics live in the
 * shared engine (../the-feed-engine.js) — the SAME file the browser game
 * imports — so the sim and the game can never drift. This file only adds
 * the personas, the runner, and the report.
 *
 * Run:   npm run sim                        (500 games per persona)
 *        node tools/the-feed-sim.js 2000    (override games per persona)
 *        node tools/the-feed-sim.js 500 report.html   (also write a dashboard)
 *        SEED=7 npm run sim                 (reproducible run)
 *
 * To change balance, edit CONFIG in ../the-feed-engine.js and re-run.
 * The "BALANCE TARGETS" section at the bottom encodes the spec's exit criteria.
 * ------------------------------------------------------------------
 */
const E = require('../the-feed-engine.js');
const { CONFIG, HORDER, fmt, totalFollowers, activePlats, pick } = E;

if (process.env.SEED) { let s = parseInt(process.env.SEED, 10) >>> 0; E.setRng(() => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }); }
// pick / rint / chance come from the engine so SEED= makes the whole run reproducible.

// ======================= persona helpers =======================
// A persona's act(S) returns ONE action per call; the runner keeps calling until
// the persona returns {end:true}, a slot runs out, or an action is refused.
//   {card:i} | {biz:'engage'|'deal'|'upgrade'|'paid'} | {hire:'editor'} | {fire:'editor'} | {end:true}
const H = {
  posts(S)            { return S.hand.map((c, i) => ({ c, i })).filter(x => x.c.kind === 'post' || x.c.kind === 'ride'); },
  ride(S)             { return S.hand.findIndex(c => c.kind === 'ride'); },
  cross(S)            { return S.hand.findIndex(c => c.kind === 'crosspost'); },
  start(S)            { return S.hand.findIndex(c => c.kind === 'start'); },
  byAngle(S, a)       { const x = H.posts(S).find(x => x.c.angle === a); return x ? x.i : -1; },
  heaviest(S)         { const x = H.posts(S).sort((a, b) => b.c.stress - a.c.stress)[0]; return x ? x.i : -1; },
  lightest(S)         { const x = H.posts(S).sort((a, b) => a.c.stress - b.c.stress)[0]; return x ? x.i : -1; },
  bestMod(S)          { const x = H.posts(S).sort((a, b) => (b.c.mod * (1 - b.c.fatigue / 200)) - (a.c.mod * (1 - a.c.fatigue / 200)))[0]; return x ? x.i : -1; },
  coldest(S)          { const x = H.posts(S).sort((a, b) => a.c.heat - b.c.heat)[0]; return x ? x.i : -1; },
  canPaid(S)          { return S.members === 0 && totalFollowers(S) >= CONFIG.paidUnlock; },
  canDeal(S)          { return totalFollowers(S) >= 1000; },
  nextHire(S, order)  { return order.find(r => !S.hires[r] && E.hireInfo(S, r).ok && S.cash > E.HIRES[r].sign * 4) || null; },
  upgradeOk(S, mult)  { const u = E.upgradeInfo(S); return u.ok && u.next <= 3 && S.cash > u.cost * mult; },
  studioOk(S, cash)   { const u = E.upgradeInfo(S); return u.ok && u.next === 4 && S.cash > cash; },
};
const content = S => S.slots.content > 0, business = S => S.slots.business > 0;

// ======================= personas =======================
const PERSONAS = {
  // Two heavy posts every week, never hires, never rests. Should burn out — but not before ~15 weeks.
  'The Grinder': { home: 'longform', eventPref: ['neutral', 'repair', 'escalate'], act(S) {
    if (content(S)) { const i = H.heaviest(S); if (i >= 0) return { card: i }; }
    if (business(S)) { if (H.upgradeOk(S, 1.2)) return { biz: 'upgrade' }; return { biz: 'engage' }; }
    return { end: true };
  } },
  // One light post a week. Never hires, never deals. Should mostly Fade, rarely go Broke.
  'The Minimalist': { home: 'micro', eventPref: ['neutral', 'repair', 'escalate'], act(S) {
    if (S.slots.content === CONFIG.slotsContent) { const i = H.lightest(S); if (i >= 0) return { card: i }; }
    return { end: true };
  } },
  // Launches every platform it can, spreads posts to the coldest channels.
  'The Diversifier': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    if (content(S)) { const st = H.start(S); if (st >= 0) return { card: st }; if (S.stress < 70) { const i = H.coldest(S); if (i >= 0) return { card: i }; } }
    if (business(S)) { if (H.canPaid(S)) return { biz: 'paid' }; if (S.rep < 55) return { biz: 'engage' }; }
    return { end: true };
  } },
  // Deals every week it can, chases trends, buys gear early. Should Sell Out / get Cancelled a lot.
  'The Hustler': { home: 'shortform', eventPref: ['escalate', 'neutral', 'repair'], act(S) {
    if (business(S)) { if (H.canDeal(S)) return { biz: 'deal' }; if (H.upgradeOk(S, 1.5)) return { biz: 'upgrade' }; }
    if (content(S)) { let i = H.byAngle(S, 'trend'); if (i < 0) i = H.bestMod(S); if (i >= 0) return { card: i }; }
    return { end: true };
  } },
  // Watches stress, favours evergreen, hires an editor + mod, never buys the Studio. Target: Niche Legend.
  'The Sustainable': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    if (content(S)) {
      const st = H.start(S); if (st >= 0 && activePlats(S).length < 2 && S.stress < 40) return { card: st };
      const heavyOk = S.stress < 50, anyOk = S.stress < 65;
      if (S.slots.content === CONFIG.slotsContent || heavyOk) {
        if (anyOk) { const r = H.ride(S); if (r >= 0) return { card: r }; let i = H.byAngle(S, 'evergreen'); if (i < 0) i = H.lightest(S); if (i >= 0 && (heavyOk || S.hand[i].stress <= 10)) return { card: i }; }
      }
    }
    if (business(S)) {
      if (H.canPaid(S)) return { biz: 'paid' };
      if (S.rep < 62) return { biz: 'engage' };
      const h = H.nextHire(S, ['editor', 'mod']); if (h) return { hire: h };
      if (H.upgradeOk(S, 3)) return { biz: 'upgrade' };
    }
    return { end: true };
  } },
  // Random legal actions.
  'The Chaos Gremlin': { eventPref: null, act(S) {
    const opts = [{ end: true }, { end: true }];
    if (content(S)) S.hand.forEach((c, i) => opts.push({ card: i }));
    if (business(S)) { opts.push({ biz: 'engage' }); if (H.canDeal(S)) opts.push({ biz: 'deal' }); if (E.upgradeInfo(S).ok) opts.push({ biz: 'upgrade' }); if (H.canPaid(S)) opts.push({ biz: 'paid' }); const h = HORDER.find(r => E.hireInfo(S, r).ok); if (h) opts.push({ hire: h }); }
    return pick(opts);
  } },
  // Plays well: rides hits, manages stress, hires everyone, buys the Studio. Target: Star/GOAT.
  'The Optimizer': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    if (content(S)) {
      const budget = S.stress >= 80 ? 0 : S.stress >= 60 ? 1 : 2;
      if (CONFIG.slotsContent - S.slots.content < budget) {
        const r = H.ride(S); if (r >= 0) return { card: r };
        const x = H.cross(S); if (x >= 0) return { card: x };
        const st = H.start(S); if (st >= 0 && activePlats(S).length < 4) return { card: st };
        const i = H.bestMod(S); if (i >= 0) return { card: i };
      }
    }
    if (business(S)) {
      if (H.canPaid(S)) return { biz: 'paid' };
      if (S.cash < 300 && H.canDeal(S)) return { biz: 'deal' };
      if (H.studioOk(S, 20000)) return { biz: 'upgrade' };
      const h = H.nextHire(S, ['editor', 'designer', 'manager', 'mod']); if (h) return { hire: h };
      if (H.upgradeOk(S, 2.5)) return { biz: 'upgrade' };
      if (S.rep < 50) return { biz: 'engage' };
      // fire the most expensive hire if the lease is drowning us
      if (S.cash < -600 && E.hireCount(S) > 0) return { fire: HORDER.filter(r => S.hires[r]).sort((a, b) => E.HIRES[b].weekly - E.HIRES[a].weekly)[0] };
    }
    return { end: true };
  } },
};

// ======================= run one game =======================
function resolveEvent(S, ev, persona) {
  const prefs = persona.eventPref || ['repair', 'neutral', 'escalate'];
  let idx = -1;
  for (const tag of prefs) { idx = ev.choices.findIndex(c => c.t === tag); if (idx >= 0) break; }
  if (idx < 0) idx = E.rint(0, ev.choices.length - 1);
  E.applyEventChoice(S, ev, idx);
}
function playWeek(S, persona) {
  E.buildHand(S);
  for (let t = 0; t < 8; t++) {
    const a = persona.act(S);
    if (!a || a.end) break;
    const before = S.slots.content + S.slots.business;
    if (a.card != null) { const c = S.hand[a.card]; if (!c) break; E.applyMove(S, c); }
    else if (a.biz) E.biz[a.biz](S);
    else if (a.hire) E.biz.hire(S, a.hire);
    else if (a.fire) E.biz.fire(S, a.fire);
    if (S.slots.content + S.slots.business === before) break; // refused → persona is stuck, end the week
    E.buildHand(S);
  }
  E.settleWeek(S);
  const ev = E.rollEvent(S);
  if (ev) resolveEvent(S, ev, persona);
  E.advanceWeek(S);
  E.checkEndings(S);
}
function playGame(persona) {
  const niche = persona.niche || pick(Object.keys(E.NICHES));
  const home = persona.home || pick(['longform', 'shortform', 'micro']);
  const S = E.newState(niche, home);
  let safety = 0;
  while (!S.over && safety++ < 200) playWeek(S, persona);
  const weeks = Math.min(S.week - 1, CONFIG.years);
  return { end: S.endKey || 'faded', week: weeks, followers: totalFollowers(S), views: S.totalViews, viewsPerWeek: Math.round(S.totalViews / Math.max(1, weeks)),
           cash: S.cash, rep: Math.round(S.rep), deals: S.deals, platforms: activePlats(S).length, members: S.members,
           hires: E.hireCount(S), studio: E.hasStudio(S), peakOverhead: S.peakOverhead };
}

// ======================= aggregation & report =======================
const ENDING_ORDER = ['goat', 'star', 'legend', 'faded', 'sellout', 'burnout', 'bankrupt', 'cancelled'];
const ENDING_LABEL = { goat: '👑 GOAT', star: '🌟 Viral Star', legend: '🏆 Niche Legend', faded: '🌫️ Faded Out',
  sellout: '🤑 Sold Out', burnout: '🕯️ Burnout', bankrupt: '💸 Broke', cancelled: '📛 Cancelled' };
const median = arr => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const pct = (n, d) => d ? 100 * n / d : 0;

function runSuite(N) {
  const results = {};
  for (const [name, persona] of Object.entries(PERSONAS)) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(playGame(persona));
    const dist = {}; ENDING_ORDER.forEach(k => dist[k] = 0);
    runs.forEach(r => dist[r.end]++);
    results[name] = { runs, dist,
      medFollowers: median(runs.map(r => r.followers)), medCash: median(runs.map(r => r.cash)), medWeek: median(runs.map(r => r.week)),
      medRep: median(runs.map(r => r.rep)), medPlatforms: median(runs.map(r => r.platforms)), medViewsWk: median(runs.map(r => r.viewsPerWeek)),
      medHires: median(runs.map(r => r.hires)), studioPct: pct(runs.filter(r => r.studio).length, N) };
  }
  return results;
}

function printReport(results, N) {
  const bar = p => { const n = Math.round(p / 5); return '█'.repeat(n) + '·'.repeat(20 - n); };
  console.log('\n' + '='.repeat(78));
  console.log(`  THE FEED — balance report   (${N} games per persona, ${N * Object.keys(PERSONAS).length} total)`);
  console.log('='.repeat(78));
  for (const [name, r] of Object.entries(results)) {
    console.log(`\n▓ ${name}`);
    console.log(`  median: ${fmt(r.medFollowers)} followers · ${fmt(r.medViewsWk)} views/wk · $${r.medCash.toLocaleString()} · rep ${r.medRep} · ${r.medPlatforms} plat · ${r.medHires} hires · studio ${r.studioPct.toFixed(0)}% · ${r.medWeek}w`);
    ENDING_ORDER.forEach(k => { const p = pct(r.dist[k], N); if (p > 0) console.log(`    ${ENDING_LABEL[k].padEnd(16)} ${bar(p)} ${p.toFixed(1)}%`); });
  }
  console.log('\n' + '-'.repeat(78));
  console.log('  OVERALL ending mix (all personas pooled)');
  const total = {}; ENDING_ORDER.forEach(k => total[k] = 0); let grand = 0;
  for (const r of Object.values(results)) ENDING_ORDER.forEach(k => { total[k] += r.dist[k]; grand += r.dist[k]; });
  ENDING_ORDER.forEach(k => console.log(`    ${ENDING_LABEL[k].padEnd(16)} ${bar(pct(total[k], grand))} ${pct(total[k], grand).toFixed(1)}%`));

  // ---- BALANCE TARGETS (spec §5) ----
  console.log('\n' + '-'.repeat(78));
  console.log('  ⚑ BALANCE TARGETS');
  const checks = [];
  const R = n => results[n];
  const top = r => ENDING_ORDER.reduce((a, k) => r.dist[k] > r.dist[a] ? k : a, ENDING_ORDER[0]);
  const g = R('The Grinder');
  checks.push([top(g) === 'burnout' && g.medWeek >= 15, `1. Grinder → Burnout (top: ${ENDING_LABEL[top(g)]}), median survival ${g.medWeek}w (need ≥15)`]);
  const m = R('The Minimalist');
  checks.push([pct(m.dist.faded, N) >= 60 && pct(m.dist.bankrupt, N) <= 15, `2. Minimalist → Faded ${pct(m.dist.faded, N).toFixed(0)}% (need ≥60), Broke ${pct(m.dist.bankrupt, N).toFixed(0)}% (need ≤15)`]);
  const s = R('The Sustainable');
  checks.push([pct(s.dist.legend, N) >= 50 && pct(s.dist.legend, N) <= 70, `3. Sustainable → Niche Legend ${pct(s.dist.legend, N).toFixed(0)}% (need 50–70)`]);
  const o = R('The Optimizer');
  checks.push([pct(o.dist.star, N) >= 50 && pct(o.dist.goat, N) >= 10 && pct(o.dist.goat, N) <= 25 && pct(total.goat, grand) <= 5,
    `4. Optimizer → Star ${pct(o.dist.star, N).toFixed(0)}% (need ≥50), GOAT ${pct(o.dist.goat, N).toFixed(0)}% (need 10–25); pooled GOAT ${pct(total.goat, grand).toFixed(1)}% (need ≤5)`]);
  // Grinder and Minimalist are deterministic by design (target 1 REQUIRES the Grinder to burn out), so target 5 covers the strategic personas.
  const DETERMINISTIC = ['The Grinder', 'The Minimalist'];
  const funnels = Object.entries(results).filter(([n, r]) => !DETERMINISTIC.includes(n) && pct(r.dist[top(r)], N) > 85).map(([n, r]) => `${n} ${pct(r.dist[top(r)], N).toFixed(0)}% ${ENDING_LABEL[top(r)]}`);
  checks.push([funnels.length === 0, `5. No strategic persona >85% into one ending${funnels.length ? ' — ' + funnels.join('; ') : ''}`]);
  const lateBroke = Object.values(results).flatMap(r => r.runs).filter(r => r.end === 'bankrupt' && r.week > 20);
  const studioShare = pct(lateBroke.filter(r => r.studio).length, lateBroke.length);
  checks.push([lateBroke.length === 0 || studioShare > 50, `6. Late (>20w) Broke endings caused by the Studio: ${studioShare.toFixed(0)}% of ${lateBroke.length} (need >50)`]);
  checks.forEach(([ok, msg]) => console.log(`    ${ok ? '✓' : '✗'} ${msg}`));
  console.log(`\n  ${checks.filter(c => c[0]).length}/${checks.length} targets met`);
  console.log('\n' + '='.repeat(78) + '\n');
  return checks.every(c => c[0]);
}

function writeHTML(results, N, path) {
  const fs = require('fs');
  const COL = { goat: '#ffca4b', star: '#ff5cae', legend: '#4fd48a', faded: '#776d99', sellout: '#ff9f43', burnout: '#ffb03a', bankrupt: '#ff5b6e', cancelled: '#e0405b' };
  const stack = dist => ENDING_ORDER.map(k => { const p = pct(dist[k], N); return p > 0 ? `<span style="width:${p}%;background:${COL[k]}" title="${ENDING_LABEL[k]} ${p.toFixed(1)}%"></span>` : ''; }).join('');
  const rows = Object.entries(results).map(([name, r]) => `
    <div class="prow"><div class="pname">${name}<span>${fmt(r.medFollowers)} followers · ${fmt(r.medViewsWk)} views/wk · $${r.medCash.toLocaleString()} · rep ${r.medRep} · ${r.medHires} hires · studio ${r.studioPct.toFixed(0)}% · ${r.medWeek}w</span></div>
    <div class="stack">${stack(r.dist)}</div></div>`).join('');
  const legend = ENDING_ORDER.map(k => `<span class="lg"><i style="background:${COL[k]}"></i>${ENDING_LABEL[k]}</span>`).join('');
  const html = `<!doctype html><meta charset="utf8"><title>The Feed — Balance Report</title>
<style>body{margin:0;background:#0A2540;color:#fff;font-family:system-ui,sans-serif;padding:32px}
h1{font-size:22px;margin:0 0 4px}.sub{color:#94A3B8;font-size:13px;margin-bottom:24px}
.prow{margin-bottom:16px}.pname{font-weight:700;font-size:14px;margin-bottom:6px}.pname span{display:block;font-weight:400;color:#94A3B8;font-size:11.5px;font-family:monospace}
.stack{display:flex;height:22px;border-radius:6px;overflow:hidden;background:#1E293B}.stack span{display:block}
.legend{margin:24px 0;display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#94A3B8}.lg{display:flex;align-items:center;gap:5px}.lg i{width:11px;height:11px;border-radius:3px;display:inline-block}</style>
<h1>THE FEED — balance report</h1><div class="sub">${N} playthroughs per persona · ${N * Object.keys(results).length} games total · ${new Date().toLocaleString()}</div>
${rows}<div class="legend">${legend}</div>`;
  fs.writeFileSync(path, html);
  console.log(`  HTML dashboard written to ${path}\n`);
}

// ======================= main =======================
const N = parseInt(process.argv[2], 10) || 500;
const htmlPath = process.argv[3] || null;
const t0 = Date.now();
const results = runSuite(N);
const allMet = printReport(results, N);
if (htmlPath) writeHTML(results, N, htmlPath);
console.log(`  (ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
process.exit(allMet ? 0 : 2);
