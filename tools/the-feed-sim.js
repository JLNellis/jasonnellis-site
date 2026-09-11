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
 * Run:   node tools/the-feed-sim.js            (500 games per persona)
 *        node tools/the-feed-sim.js 2000       (override games per persona)
 *        node tools/the-feed-sim.js 500 report.html   (also write a dashboard)
 *
 * To change balance, edit CONFIG in ../the-feed-engine.js and re-run.
 * ------------------------------------------------------------------
 */
const E = require('../the-feed-engine.js');
const { CONFIG, NICHES, PLATFORMS, PORDER, fmt } = E;
const { totalFollowers, activePlats } = E;
const pick = a => a[Math.floor(Math.random() * a.length)];

// ======================= personas =======================
// Each persona: { niche?, home?, eventPref?, act(S) -> action }
// action = {move:i} | {biz:'grind'|...} | {end:true} | {rest:true}
const H = {
  ride(S) { return S.hand.findIndex(m => m.kind === 'ride'); },
  cross(S) { return S.hand.findIndex(m => m.kind === 'crosspost'); },
  startMove(S) { return S.hand.findIndex(m => m.kind === 'start'); },
  postTo(S, key) { return S.hand.findIndex(m => m.pkey === key && (m.kind === 'post' || m.kind === 'ride')); },
  bestPost(S) { let best = -1, bv = -1; S.hand.forEach((m, i) => { if (m.kind !== 'post' && m.kind !== 'ride') return; const v = (m.mod || 1) * (1 - (m.fatigue || 0) / 200); if (v > bv) { bv = v; best = i; } }); return best; },
  coldest(S) { let best = -1, bv = 1e9; S.hand.forEach((m, i) => { if (m.kind !== 'post') return; if ((m.heat || 0) < bv) { bv = m.heat || 0; best = i; } }); return best; },
  can(S, i) { return i >= 0 && S.hand[i] && S.hand[i].energy <= S.energy; },
};

const PERSONAS = {
  'The Grinder': { home: 'longform', eventPref: ['neutral', 'repair', 'escalate'], act(S) {
    if (S.skill < 30 && !S._studied && S.energy >= 15) return { biz: 'grind' };
    let i = H.postTo(S, 'longform'); if (!H.can(S, i)) i = H.bestPost(S);
    if (H.can(S, i)) return { move: i };
    return { end: true };
  } },
  'The Viral Chaser': { home: 'shortform', eventPref: ['escalate', 'neutral', 'repair'], act(S) {
    const st = H.startMove(S); if ((st >= 0 && S.hand[st].pkey === 'shortform') || (st >= 0 && S.hand[st].pkey === 'micro')) if (H.can(S, st)) return { move: st };
    let r = H.ride(S); if (H.can(S, r)) return { move: r };
    let i = H.postTo(S, 'shortform'); if (!H.can(S, i)) i = H.postTo(S, 'micro'); if (!H.can(S, i)) i = H.bestPost(S);
    if (H.can(S, i)) return { move: i };
    return { end: true };
  } },
  'The Diversifier': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    const st = H.startMove(S); if (H.can(S, st)) return { move: st };
    if (S.energy < 30) return { rest: true };
    if (S.members === 0 && totalFollowers(S) >= CONFIG.paidUnlock && S.energy >= 12) return { biz: 'paid' };
    if (S.rep < 55 && S.energy >= 10 && Math.random() < .4) return { biz: 'engage' };
    let i = H.coldest(S); if (!H.can(S, i)) i = H.bestPost(S);
    if (H.can(S, i)) return { move: i };
    return { end: true };
  } },
  'The Hustler': { home: 'micro', eventPref: ['escalate', 'neutral', 'repair'], act(S) {
    if (totalFollowers(S) >= 1000 && S.energy >= 10 && S.deals < 8) return { biz: 'deal' };
    if (S.gear < 3 && S.cash > CONFIG.gearCost[S.gear + 1] * 2) return { biz: 'upgrade' };
    let i = H.postTo(S, 'micro'); if (!H.can(S, i)) i = H.bestPost(S);
    if (H.can(S, i) && Math.random() < .6) return { move: i };
    return { end: true };
  } },
  'The Sustainable': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    if (S.energy < 40) return { rest: true };
    if (S.members === 0 && totalFollowers(S) >= CONFIG.paidUnlock && S.energy >= 12) return { biz: 'paid' };
    if (S.rep < 62 && S.energy >= 10) return { biz: 'engage' };
    if (S.skill < 40 && !S._studied && S.energy >= 15) return { biz: 'grind' };
    const st = H.startMove(S); if (H.can(S, st) && activePlats(S).length < 3) return { move: st };
    let r = H.ride(S); if (H.can(S, r)) return { move: r };
    let i = H.postTo(S, 'longform'); if (!H.can(S, i)) i = H.postTo(S, 'writing'); if (!H.can(S, i)) i = H.bestPost(S);
    if (H.can(S, i)) return { move: i };
    return { end: true };
  } },
  'The Chaos Gremlin': { eventPref: null, act(S) {
    const opts = [];
    S.hand.forEach((m, i) => { if (m.energy <= S.energy) opts.push({ move: i }); });
    if (S.energy >= 15) opts.push({ biz: 'grind' }); if (S.energy >= 10) opts.push({ biz: 'engage' });
    if (totalFollowers(S) >= 1000 && S.energy >= 10) opts.push({ biz: 'deal' });
    opts.push({ rest: true }, { end: true }, { end: true });
    return pick(opts);
  } },
  'The Optimizer': { home: 'longform', eventPref: ['repair', 'neutral', 'escalate'], act(S) {
    if (S.energy < 25) return { rest: true };
    let r = H.ride(S); if (H.can(S, r)) return { move: r };
    let c = H.cross(S); if (H.can(S, c)) return { move: c };
    if (S.members === 0 && totalFollowers(S) >= CONFIG.paidUnlock && S.energy >= 12) return { biz: 'paid' };
    if (S.skill < 35 && !S._studied && S.energy >= 15) return { biz: 'grind' };
    if (S.rep < 50 && S.energy >= 10) return { biz: 'engage' };
    const st = H.startMove(S); if (H.can(S, st) && activePlats(S).length < 4) return { move: st };
    if (S.cash < 250 && totalFollowers(S) >= 1000 && S.energy >= 10) return { biz: 'deal' };
    if (S.gear < 3 && S.cash > CONFIG.gearCost[S.gear + 1] * 2.5) return { biz: 'upgrade' };
    let i = H.bestPost(S);
    if (H.can(S, i)) return { move: i };
    return { end: true };
  } },
};

// ======================= run one game =======================
function resolveEvent(S, ev, persona) {
  const prefs = persona.eventPref || ['repair', 'neutral', 'escalate'];
  let idx = -1;
  for (const tag of prefs) { idx = ev.choices.findIndex(c => c.t === tag); if (idx >= 0) break; }
  if (idx < 0) idx = Math.floor(Math.random() * ev.choices.length);
  E.applyEventChoice(S, ev, idx);
}
function endWeek(S, persona) {
  E.settleWeek(S);
  const ev = E.rollEvent(S);
  if (ev) resolveEvent(S, ev, persona);
  E.advanceWeek(S);
  E.checkEndings(S);
}
function playGame(persona) {
  const niche = persona.niche || pick(Object.keys(NICHES));
  const home = persona.home || pick(['longform', 'shortform', 'micro']);
  const S = E.newState(niche, home);
  let safety = 0;
  while (!S.over && safety++ < 3000) {
    E.buildHand(S);
    let ended = false, turns = 0;
    while (!S.over && !ended && turns++ < 16) {
      const a = persona.act(S);
      if (a.rest) { E.biz.rest(S); endWeek(S, persona); ended = true; break; }
      if (a.end) { endWeek(S, persona); ended = true; break; }
      if (a.biz) { E.biz[a.biz](S); E.buildHand(S); continue; }
      if (a.move != null && a.move >= 0 && S.hand[a.move] && S.hand[a.move].energy <= S.energy) { E.applyMove(S, S.hand[a.move]); E.buildHand(S); continue; }
      endWeek(S, persona); ended = true; break;
    }
    if (!ended && !S.over) endWeek(S, persona);
  }
  return { end: S.endKey || 'faded', week: Math.min(S.week - 1, CONFIG.years), followers: totalFollowers(S),
           cash: S.cash, rep: Math.round(S.rep), deals: S.deals, platforms: activePlats(S).length, members: S.members };
}

// ======================= aggregation & report =======================
const ENDING_ORDER = ['goat', 'star', 'legend', 'faded', 'sellout', 'burnout', 'bankrupt', 'cancelled'];
const ENDING_LABEL = { goat: '👑 GOAT', star: '🌟 Viral Star', legend: '🏆 Niche Legend', faded: '🌫️ Faded Out',
  sellout: '🤑 Sold Out', burnout: '🕯️ Burnout', bankrupt: '💸 Broke', cancelled: '📛 Cancelled' };
const median = arr => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

function runSuite(N) {
  const results = {};
  for (const [name, persona] of Object.entries(PERSONAS)) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(playGame(persona));
    const dist = {}; ENDING_ORDER.forEach(k => dist[k] = 0);
    runs.forEach(r => dist[r.end]++);
    results[name] = { runs, dist,
      medFollowers: median(runs.map(r => r.followers)), medCash: median(runs.map(r => r.cash)),
      medWeek: median(runs.map(r => r.week)), medRep: median(runs.map(r => r.rep)), medPlatforms: median(runs.map(r => r.platforms)) };
  }
  return results;
}

function printReport(results, N) {
  const bar = pct => { const n = Math.round(pct / 5); return '█'.repeat(n) + '·'.repeat(20 - n); };
  console.log('\n' + '='.repeat(74));
  console.log(`  THE FEED — balance report   (${N} games per persona, ${N * Object.keys(PERSONAS).length} total)`);
  console.log('='.repeat(74));
  for (const [name, r] of Object.entries(results)) {
    console.log(`\n▓ ${name}`);
    console.log(`  median: ${fmt(r.medFollowers)} followers · $${r.medCash.toLocaleString()} bank · rep ${r.medRep} · ${r.medPlatforms} platforms · survived ${r.medWeek}w`);
    ENDING_ORDER.forEach(k => { const pct = 100 * r.dist[k] / N; if (pct > 0) console.log(`    ${ENDING_LABEL[k].padEnd(16)} ${bar(pct)} ${pct.toFixed(1)}%`); });
  }
  console.log('\n' + '-'.repeat(74));
  console.log('  OVERALL ending mix (all personas pooled)');
  const total = {}; ENDING_ORDER.forEach(k => total[k] = 0); let grand = 0;
  for (const r of Object.values(results)) ENDING_ORDER.forEach(k => { total[k] += r.dist[k]; grand += r.dist[k]; });
  ENDING_ORDER.forEach(k => { const pct = 100 * total[k] / grand; console.log(`    ${ENDING_LABEL[k].padEnd(16)} ${bar(pct)} ${pct.toFixed(1)}%`); });

  console.log('\n' + '-'.repeat(74));
  console.log('  ⚑ AUTO-DETECTED BALANCE FLAGS');
  const flags = [];
  const bankruptRate = 100 * total.bankrupt / grand;
  if (bankruptRate < 3) flags.push(`Economy may be too forgiving — only ${bankruptRate.toFixed(1)}% go broke across ALL strategies.`);
  if (bankruptRate > 40) flags.push(`Economy may be brutal — ${bankruptRate.toFixed(1)}% go bankrupt.`);
  const goatRate = 100 * total.goat / grand;
  if (goatRate > 8) flags.push(`GOAT is too easy (${goatRate.toFixed(1)}%). The top ending should feel rare (~1-3%).`);
  if (goatRate < 0.3) flags.push(`GOAT is nearly unreachable (${goatRate.toFixed(1)}%).`);
  const opt = results['The Optimizer'];
  if (opt) { const optFade = 100 * opt.dist.faded / N; if (optFade > 55) flags.push(`Even The Optimizer fades out ${optFade.toFixed(0)}% of the time — skill ceiling may be too low.`); }
  const sus = results['The Sustainable'];
  if (sus) { const legendRate = 100 * sus.dist.legend / N; if (legendRate < 20) flags.push(`The Sustainable persona only reaches Niche Legend ${legendRate.toFixed(0)}% — the healthy path isn't rewarded enough.`); else flags.push(`✓ The Sustainable path reaches Niche Legend ${legendRate.toFixed(0)}% of the time — the intended healthy ending is working.`); }
  Object.entries(results).forEach(([name, r]) => { const top = Math.max(...ENDING_ORDER.map(k => r.dist[k])); if (top / N > 0.8) { const k = ENDING_ORDER.find(k => r.dist[k] === top); flags.push(`${name} funnels into ${ENDING_LABEL[k]} ${(100 * top / N).toFixed(0)}% of the time — low variety for that strategy.`); } });
  if (!flags.length) flags.push('No red flags — distributions look reasonably spread.');
  flags.forEach(f => console.log(`    • ${f}`));
  console.log('\n' + '='.repeat(74) + '\n');
}

function writeHTML(results, N, path) {
  const fs = require('fs');
  const COL = { goat: '#ffca4b', star: '#ff5cae', legend: '#4fd48a', faded: '#776d99', sellout: '#ff9f43', burnout: '#ffb03a', bankrupt: '#ff5b6e', cancelled: '#e0405b' };
  const stack = dist => ENDING_ORDER.map(k => { const pct = 100 * dist[k] / N; return pct > 0 ? `<span style="width:${pct}%;background:${COL[k]}" title="${ENDING_LABEL[k]} ${pct.toFixed(1)}%"></span>` : ''; }).join('');
  const rows = Object.entries(results).map(([name, r]) => `
    <div class="prow"><div class="pname">${name}<span>${fmt(r.medFollowers)} followers · $${r.medCash.toLocaleString()} · rep ${r.medRep} · ${r.medWeek}w</span></div>
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
printReport(results, N);
if (htmlPath) writeHTML(results, N, htmlPath);
console.log(`  (ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
