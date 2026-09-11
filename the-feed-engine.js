/*
 * THE FEED — game engine (shared, pure, no DOM / no Node specifics)
 * ------------------------------------------------------------------
 * Single source of truth for the game's mechanics, economy, events and
 * balance. Both consumers import THIS file so they can never drift:
 *   • the-feed.html          (browser — adds rendering + the feedback layer)
 *   • tools/the-feed-sim.js  (Node    — adds personas + the balance runner)
 *
 * State-mutating actions return an effect "log":
 *   { floats:[{anchor,text,tone}], feed:[{emoji,text,kind}], bump:[platformKey] }
 * The browser turns floats into number-pops, feed into the activity feed,
 * and bump into the channel-card level-up animation. The sim ignores logs
 * and only reads the resulting state. Anchors are SEMANTIC
 * ('cash' | 'rep' | 'skill' | 'plat:<key>') so the engine stays DOM-free.
 *
 * Weekly orchestration (both consumers follow the same sequence):
 *   settleWeek(S)              costs, revenue, decay, exhaustion streak
 *   ev = rollEvent(S)          maybe draw an event (or null)
 *     if ev: applyEventChoice(S, ev, i) -> log   (browser shows card first)
 *   advanceWeek(S)             week++, energy recovery
 *   checkEndings(S)            sets S.over / S.endKey, returns key|null
 * ------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FeedEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ======================= TUNING KNOBS =======================
  // To rebalance: edit here, run `npm run sim`. Both game and sim read this block.
  const CONFIG = {
    startCash: 900, startStress: 20,
    slotsContent: 2, slotsBusiness: 1,
    // stress: recovery per week, extra per empty content slot, band thresholds
    stressRecover: 12, stressRecoverPerEmptySlot: 8,
    bandHot: 50, bandFumes: 70, bandRedline: 90, fumesViewsMult: 0.85,
    burnoutStreak: 3,
    // overhead (replaces rent): flat + per platform + payroll + studio lease
    overheadBase: 140, overheadPerPlatform: 10, studioLease: 350,
    // post math
    viewsK: 160, baseConv: 0.02, sizeSat: 55000, sizeMax: 4.5,
    // churn
    churnBase: 0.006, churnTrend: 0.012, churnIdle: 0.02, idleWeeks: 3,
    // evergreen tail
    tailWeeks: 4, tailRate: 0.15,
    topicCooldown: 8,
    // money
    bankruptFloor: -1500,
    dealBase: 90, dealScale: 0.018,
    paidUnlock: 1500, memberRate: 6, memberConvMin: 0.02, memberConvMax: 0.045,
    memberNewConv: 0.025, memberChurn: 0.03, memberChurnIdle: 0.06,
    // gear: tiers 1-3 are kit, tier 4 is the Studio
    gearCost: [0, 350, 800, 1700, 12000], gearViewsMult: 1.10,
    studioUnlockFollowers: 25000, studioViewsMult: 1.3, studioStressRelief: 6,
    hireCapBase: 2, hireCapStudio: 4,
    // endings
    goatAt: 1200000, starAt: 300000, legendAt: 40000, legendRep: 55,
    sellDeals: 6, sellRepUnder: 45, sellCashOver: 1800,
    eventChance: 0.55,
    years: 52,
  };

  // ======================= RNG helpers =======================
  // Injectable so the tests and the sim can be reproducible. Defaults to Math.random.
  let rng = Math.random;
  const setRng = fn => { rng = fn || Math.random; };
  const rnd = (a, b) => a + rng() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chance = p => rng() < p;
  const pick = a => a[Math.floor(rng() * a.length)];

  function fmt(n) { n = Math.round(n); const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(a % 1e6 === 0 ? 0 : 1) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(a % 1e3 === 0 ? 0 : 1) + 'K';
    return '' + n; }
  function money(n) { n = Math.round(n); return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString(); }

  // ======================= game data =======================
  const NICHES = {
    gaming:  { label: 'Gaming',    emoji: '🎮', rep0: 52, viral: 1.15, deal: 1.0,  skill: 1.1,  blurb: 'high buzz, fickle' },
    beauty:  { label: 'Beauty',    emoji: '💄', rep0: 58, viral: 1.0,  deal: 1.35, skill: 1.0,  blurb: 'sponsors love you' },
    edu:     { label: 'Education', emoji: '📚', rep0: 70, viral: 0.82, deal: 0.9,  skill: 1.15, blurb: 'slow but sticky' },
    comedy:  { label: 'Comedy',    emoji: '🤡', rep0: 54, viral: 1.3,  deal: 0.95, skill: 1.0,  blurb: 'viral or cancelled' },
    fitness: { label: 'Fitness',   emoji: '💪', rep0: 60, viral: 1.05, deal: 1.2,  skill: 1.0,  blurb: 'steady grind' },
    music:   { label: 'Music',     emoji: '🎧', rep0: 60, viral: 1.2,  deal: 0.9,  skill: 1.2,  blurb: 'talent scales slow' },
  };
  // Platform accent colors map onto the site's Bolt OS status palette:
  // green (hero), blue (info), slate (muted), amber (warning), red (live).
  // `stress` = stress cost per post. `rpm` = ad revenue per VIEW.
  const PLATFORMS = {
    longform:  { name: 'Longform Video', tag: 'YT-style',       emoji: '🎬', color: '#00E676', stress: 18, rpm: .0045, viral: 1.0,  loyal: 1.25, unlock: 0,    fmt: 'a deep-dive video' },
    shortform: { name: 'Short Video',    tag: 'vertical clips',  emoji: '📱', color: '#3B82F6', stress: 10, rpm: .0006, viral: 1.6,  loyal: .6,   unlock: 0,    fmt: 'a batch of shorts' },
    micro:     { name: 'Microblog',      tag: 'text posts',      emoji: '💬', color: '#94A3B8', stress: 6,  rpm: .0003, viral: 1.25, loyal: .8,   unlock: 0,    fmt: 'a hot take' },
    writing:   { name: 'Newsletter',     tag: 'long writing',    emoji: '📰', color: '#F59E0B', stress: 14, rpm: .006,  viral: .75,  loyal: 1.5,  unlock: 1200, fmt: 'a longform essay' },
    live:      { name: 'Live Stream',    tag: 'live',            emoji: '🔴', color: '#EF4444', stress: 20, rpm: .003,  viral: .9,   loyal: 1.6,  unlock: 2500, fmt: 'a live stream' },
  };
  const PORDER = ['longform', 'shortform', 'micro', 'writing', 'live'];
  // Team. Each role is a one-line modifier applied at exactly one site in the engine.
  const HIRES = {
    editor:   { label: 'Editor',        emoji: '✂️', sign: 600, weekly: 110, blurb: 'Cuts the grind out of longform and live.' },
    manager:  { label: 'Manager',       emoji: '📞', sign: 500, weekly: 90,  blurb: 'Better deals, less of the sellout smell.' },
    mod:      { label: 'Community mod', emoji: '🛡️', sign: 400, weekly: 60,  blurb: 'Keeps the comments from becoming the story.' },
    designer: { label: 'Designer',      emoji: '🎨', sign: 800, weekly: 140, blurb: 'Packaging and thumbnails. More clicks everywhere.' },
  };
  const HORDER = ['editor', 'manager', 'mod', 'designer'];
  const ANGLES = { trend: { stress: 0 }, evergreen: { stress: 0 }, personal: { stress: 6 } }; // replaced in Task 5
  const TIERS = ['Amateur', 'Scrappy', 'Rising', 'Established', 'Icon'];
  const TIERCUT = [0, 18, 40, 70, 110];

  // ======================= state =======================
  function newState(niche, home) {
    const n = NICHES[niche];
    const S = {
      name: '', niche, week: 1, phase: 'play',
      cash: CONFIG.startCash, stress: CONFIG.startStress, rep: n.rep0,
      gear: 0, deals: 0, members: 0,
      band: 'normal', redlineStreak: 0,
      slots: { content: CONFIG.slotsContent, business: CONFIG.slotsBusiness },
      hires: { editor: false, manager: false, mod: false, designer: false },
      tails: [], usedTopics: [], totalViews: 0, peakOverhead: 0, newFollowers: 0,
      lastHit: null, over: false, endKey: null, plats: {}, hand: [],
    };
    PORDER.forEach(k => { S.plats[k] = { key: k, followers: 0, trendFollowers: 0, heat: 0, fatigue: 0, posts: 0, active: false, proven: false, lastPost: -9 }; });
    S.plats[home].active = true;
    S.plats[home].followers = 40;
    return S;
  }
  const activePlats = S => PORDER.map(k => S.plats[k]).filter(p => p.active);
  const totalFollowers = S => PORDER.reduce((s, k) => s + S.plats[k].followers, 0);
  const strongest = S => activePlats(S).sort((a, b) => b.followers - a.followers)[0];
  // Tier is cosmetic polish on the channel card: posts + gear.
  function platTier(S, p) { const pol = p.posts * 3 + S.gear * 9; let t = 0; for (let i = 0; i < TIERCUT.length; i++) if (pol >= TIERCUT[i]) t = i; return t; }

  // --- slots & stress ---
  function useSlot(S, kind) { if (S.slots[kind] <= 0) return false; S.slots[kind]--; return true; }
  function addStress(S, n) { S.stress = clamp(S.stress + n, 0, 100); }
  function stressBand(S) {
    if (S.stress >= CONFIG.bandRedline) return 'redline';
    if (S.stress >= CONFIG.bandFumes) return 'fumes';
    if (S.stress >= CONFIG.bandHot) return 'hot';
    return 'normal';
  }

  // --- team, overhead ---
  const hasStudio = S => S.gear >= 4;
  const hireCount = S => HORDER.filter(k => S.hires[k]).length;
  const hireCap = S => hasStudio(S) ? CONFIG.hireCapStudio : CONFIG.hireCapBase;
  const payroll = S => HORDER.reduce((s, k) => s + (S.hires[k] ? HIRES[k].weekly : 0), 0);
  function overheadBreakdown(S) {
    const b = { base: CONFIG.overheadBase, platforms: activePlats(S).length * CONFIG.overheadPerPlatform, payroll: payroll(S), lease: hasStudio(S) ? CONFIG.studioLease : 0 };
    b.total = b.base + b.platforms + b.payroll + b.lease; return b;
  }
  const overhead = S => overheadBreakdown(S).total;
  function hireInfo(S, role) {
    const h = HIRES[role];
    if (S.hires[role]) return { ok: false, reason: 'Already on the team.' };
    if (hireCount(S) >= hireCap(S)) return { ok: false, reason: hasStudio(S) ? 'Team is full.' : 'No room — you need the Studio to hold more than two people.' };
    if (S.cash < h.sign) return { ok: false, reason: 'Signing costs ' + money(h.sign) + '.' };
    if (S.slots.business <= 0) return { ok: false, reason: 'No business slot left this week.' };
    return { ok: true, reason: '' };
  }

  // --- multipliers: every hire/gear/stress effect on output lives here ---
  function viewsMult(S, pkey) {
    let m = Math.pow(CONFIG.gearViewsMult, Math.min(S.gear, 3));
    if (hasStudio(S)) m *= CONFIG.studioViewsMult;
    if (S.hires.designer) m *= 1.15;
    if (S.hires.editor && (pkey === 'longform' || pkey === 'live')) m *= 1.05;
    if (stressBand(S) === 'fumes' || stressBand(S) === 'redline') m *= CONFIG.fumesViewsMult;
    return m;
  }
  function stressCost(S, pkey, angleKey) {
    let c = PLATFORMS[pkey].stress + (ANGLES[angleKey] ? ANGLES[angleKey].stress : 0);
    if (S.hires.editor && (pkey === 'longform' || pkey === 'live')) c -= 8;
    if (hasStudio(S)) c -= CONFIG.studioStressRelief;
    return Math.max(1, c);
  }
  function upgradeInfo(S) {
    const nx = S.gear + 1;
    if (nx > 4) return { next: null, cost: 0, ok: false, reason: 'Full rig and a studio — nothing left to buy.' };
    const cost = CONFIG.gearCost[nx];
    if (nx === 4 && totalFollowers(S) < CONFIG.studioUnlockFollowers) return { next: nx, cost, ok: false, reason: 'The Studio unlocks at ' + fmt(CONFIG.studioUnlockFollowers) + ' followers.' };
    if (S.cash < cost) return { next: nx, cost, ok: false, reason: 'Costs ' + money(cost) + '.' };
    if (S.slots.business <= 0) return { next: nx, cost, ok: false, reason: 'No business slot left this week.' };
    return { next: nx, cost, ok: true, reason: '' };
  }

  const L = () => ({ floats: [], feed: [], bump: [] });

  // ======================= the adaptive hand =======================
  function buildHand(S) {
    const hand = [];
    activePlats(S).forEach(p => {
      const pf = PLATFORMS[p.key]; let mod = 1, special = false, kind = 'post';
      if (p.heat >= 52) mod *= 1.35;
      if (p.proven && p.fatigue < 45) mod *= 1.12;
      if (p.fatigue >= 52) mod *= 0.55;
      let ride = false;
      if (S.lastHit && S.lastHit.key === p.key && S.week - S.lastHit.week <= 1) { special = true; mod *= 1.7; kind = 'ride'; ride = true; }
      hand.push({ kind, pkey: p.key, mod, energy: pf.energy, special, heat: p.heat, fatigue: p.fatigue, proven: p.proven, ride });
    });
    const act = activePlats(S);
    if (act.length >= 2) {
      const src = act.slice().sort((a, b) => b.followers - a.followers)[0];
      const dst = act.slice().sort((a, b) => a.followers - b.followers)[0];
      if (src.key !== dst.key && src.followers > 500 && src.heat > 25)
        hand.push({ kind: 'crosspost', src: src.key, dst: dst.key, special: true, energy: 8 });
    }
    act.forEach(p => {
      if (S.week - p.lastPost >= 3 && p.heat < 15 && p.followers > 200)
        hand.push({ kind: 'post', pkey: p.key, special: true, revive: true, mod: 1.1, energy: PLATFORMS[p.key].energy });
    });
    const locked = PORDER.map(k => S.plats[k]).filter(p => !p.active && totalFollowers(S) >= PLATFORMS[p.key].unlock);
    if (locked.length) hand.push({ kind: 'start', pkey: locked[0].key, special: true, energy: PLATFORMS[locked[0].key].energy });
    S.hand = hand;
    return hand;
  }

  // ======================= applying content moves =======================
  function doPost(S, k, mod) {
    const p = S.plats[k], pf = PLATFORMS[k], before = platTier(S, p);
    const q = S.skill * 0.5 + S.gear * 8 + (S.energy / 100) * 16 + rnd(4, 18);
    const heatF = 1 + p.heat / 45, luck = rnd(.55, 1.6);
    const sizeF = 1 + CONFIG.sizeMax * p.followers / (p.followers + CONFIG.sizeSat); // saturating, no runaway
    const gain = Math.round(q * heatF * sizeF * pf.viral * NICHES[S.niche].viral * (mod || 1) * clamp(1 - p.fatigue / 160, .5, 1) * luck * CONFIG.postK);
    const rev = Math.round(p.followers * pf.rpm * (.4 + p.heat / 160) * rnd(.7, 1.3));
    p.followers += gain; S.cash += rev; p.posts++; p.lastPost = S.week; p.fatigue = clamp(p.fatigue + rint(10, 20), 0, 100);
    const hit = luck > 1.12;
    p.heat = clamp(p.heat + (hit ? rint(9, 18) : -rint(0, 3)), 0, 100);
    if (hit) { p.proven = true; S.lastHit = { key: k, week: S.week }; }
    S.rep = clamp(S.rep + rnd(-.4, 1.2), 0, 100);
    const log = L();
    log.floats.push({ anchor: 'plat:' + k, text: '+' + fmt(gain), tone: hit ? 'hit' : 'gain' });
    if (rev > 0) log.floats.push({ anchor: 'cash', text: '+' + money(rev), tone: 'cash' });
    log.feed.push({ emoji: pf.emoji, text: `Posted ${pf.fmt} on ${pf.name} — ${hit ? 'it took off!' : 'modest numbers'}. +${fmt(gain)} followers${rev > 0 ? ', +' + money(rev) : ''}.`, kind: hit ? 'good' : '' });
    if (hit) log.feed.push({ emoji: '🔥', text: `${pf.name} is hot right now — ride it next week before it cools.`, kind: 'big' });
    log.bump.push(k);
    if (platTier(S, p) > before) log.feed.push({ emoji: '📈', text: `Your ${pf.name} leveled up to ${TIERS[platTier(S, p)]} — it looks more professional now.`, kind: 'good' });
    return log;
  }
  function startPlatform(S, k) {
    const p = S.plats[k], pf = PLATFORMS[k];
    p.active = true; p.followers = Math.round(totalFollowers(S) * 0.02 + 20); p.lastPost = S.week; p.posts = 1;
    const log = L(); log.bump.push(k);
    log.feed.push({ emoji: '✨', text: `Launched on ${pf.name}. A fresh channel, a blank slate.`, kind: 'good' });
    return log;
  }
  function crosspost(S, sk, dk) {
    const src = S.plats[sk], dst = S.plats[dk];
    const moved = Math.round(src.followers * rnd(.02, .06) * (1 + src.heat / 100));
    dst.followers += moved; dst.heat = clamp(dst.heat + 12, 0, 100); dst.lastPost = S.week;
    const log = L(); log.bump.push(dk);
    log.floats.push({ anchor: 'plat:' + dk, text: '+' + fmt(moved), tone: 'gain' });
    log.feed.push({ emoji: '🔗', text: `Cross-posted to ${PLATFORMS[dk].name}. +${fmt(moved)} followers followed you over.`, kind: 'good' });
    return log;
  }
  function applyMove(S, m) {
    S.energy = clamp(S.energy - m.energy, 0, 100);
    if (m.kind === 'start') return startPlatform(S, m.pkey);
    if (m.kind === 'crosspost') return crosspost(S, m.src, m.dst);
    return doPost(S, m.pkey, m.mod);
  }

  // ======================= business actions =======================
  const biz = {
    grind(S) { S.energy = clamp(S.energy - 15, 0, 100); const g = rnd(2, 5) * NICHES[S.niche].skill; S.skill = clamp(S.skill + g, 0, skillCap(S)); S._studied = true;
      const log = L(); log.floats.push({ anchor: 'skill', text: '+' + g.toFixed(1), tone: 'up' });
      log.feed.push({ emoji: '🎓', text: `Studied the craft. Skill ${S.skill >= skillCap(S) - 1 ? 'is maxed for your gear' : 'went up'}.`, kind: '' }); return log; },
    engage(S) { S.energy = clamp(S.energy - 10, 0, 100); const r = rnd(2, 5); S.rep = clamp(S.rep + r, 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat + rint(1, 4), 0, 100));
      const log = L(); log.floats.push({ anchor: 'rep', text: '+' + r.toFixed(1), tone: 'up' });
      log.feed.push({ emoji: '💬', text: 'Showed up in the comments and DMs. The core crowd feels seen.', kind: 'good' }); return log; },
    deal(S) { S.energy = clamp(S.energy - 10, 0, 100); const pay = Math.round((CONFIG.dealBase + totalFollowers(S) * CONFIG.dealScale) * NICHES[S.niche].deal); const h = rnd(4, 9);
      S.cash += pay; S.rep = clamp(S.rep - h, 0, 100); S.deals++;
      const log = L(); log.floats.push({ anchor: 'cash', text: '+' + money(pay), tone: 'cash' }); log.floats.push({ anchor: 'rep', text: '-' + h.toFixed(0), tone: 'loss' });
      log.feed.push({ emoji: '🤝', text: `Ran a sponsored segment. +${money(pay)} — some fans smell the sellout.`, kind: '' }); return log; },
    upgrade(S) { const u = upgradeInfo(S); if (!u.ok || !useSlot(S, 'business')) return L();
      S.cash -= u.cost; S.gear = u.next;
      const log = L(); log.floats.push({ anchor: 'cash', text: '-' + money(u.cost), tone: 'loss' }); log.bump = PORDER.slice();
      if (u.next === 4) log.feed.push({ emoji: '🏢', text: `You signed the lease. The Studio is yours — every post gets bigger, every week costs ${money(CONFIG.studioLease)} more. No pressure.`, kind: 'big' });
      else log.feed.push({ emoji: '🛠️', text: `Upgraded your kit (tier ${u.next}). Every channel just got more polished.`, kind: 'good' });
      return log; },
    paid(S) { if (S.members > 0 || totalFollowers(S) < CONFIG.paidUnlock) return L(); S.energy = clamp(S.energy - 12, 0, 100);
      S.members = Math.round(totalFollowers(S) * rnd(CONFIG.memberConvMin, CONFIG.memberConvMax));
      const log = L(); log.feed.push({ emoji: '⭐', text: `Launched a paid membership. ${fmt(S.members)} true fans signed up — recurring income at last.`, kind: 'good' }); return log; },
    rest(S) { S.energy = clamp(S.energy + rint(28, 44), 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat - rint(4, 9), 0, 100));
      const log = L(); log.feed.push({ emoji: '😌', text: 'Took real time off. Rested up — the feed forgot you a little.', kind: '' }); return log; },
    hire(S, role) { const h = HIRES[role]; if (!h || !hireInfo(S, role).ok || !useSlot(S, 'business')) return L();
      S.cash -= h.sign; S.hires[role] = true;
      const log = L(); log.floats.push({ anchor: 'cash', text: '-' + money(h.sign), tone: 'loss' });
      log.feed.push({ emoji: h.emoji, text: `Hired a ${h.label.toLowerCase()}. Payroll is now ${money(payroll(S))}/week.`, kind: 'good' }); return log; },
    fire(S, role) { const h = HIRES[role]; if (!h || !S.hires[role] || !useSlot(S, 'business')) return L();
      S.hires[role] = false;
      const log = L(); log.feed.push({ emoji: '👋', text: `You let your ${h.label.toLowerCase()} go. Payroll −${money(h.weekly)}/week.`, kind: '' }); return log; },
  };

  // ======================= events (single deck: display + effect) =======================
  // choice.t ∈ repair | neutral | escalate  (personas pick by this tag)
  // choice.apply(S) -> effect log
  const fed = (e, t, k) => { const log = L(); log.feed.push({ emoji: e, text: t, kind: k || '' }); return log; };
  const EVENTS = [
    { kind: 'neutral', emoji: '🚀', title: 'A post is going viral right now.', badge: 'Momentum', cond: () => true,
      text: 'One upload is spiking to people who have never heard of you. The window is open.',
      choices: [
        { t: 'repair', ci: '🌊', label: 'Ride it across every platform', desc: 'Cross-promote hard. Costs energy, huge upside.',
          apply: S => { const g = Math.round(rnd(2000, 8000) * (1 + totalFollowers(S) / 40000)); const p = strongest(S); p.followers += g; p.heat = clamp(p.heat + 22, 0, 100); S.energy = clamp(S.energy - 18, 0, 100); S.lastHit = { key: p.key, week: S.week };
            const log = fed('🚀', `You rode it hard. +${fmt(g)} followers and the buzz is roaring.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } },
        { t: 'neutral', ci: '😌', label: 'Let it breathe', desc: 'Take the smaller bump, keep your energy.',
          apply: S => { const p = strongest(S); const g = Math.round(rnd(600, 2000)); p.followers += g; p.heat = clamp(p.heat + 8, 0, 100);
            const log = fed('🌊', `Didn't force it. +${fmt(g)} followers, energy intact.`, 'good'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'gain' }); log.bump.push(p.key); return log; } },
      ] },
    { kind: 'neutral', emoji: '🔄', title: 'The platform changed its algorithm overnight.', badge: 'Platform shift', cond: () => true,
      text: 'The rules just changed. Nobody knows what the feed rewards anymore.',
      choices: [
        { t: 'repair', ci: '📡', label: 'Chase the new format fast', desc: 'Adapt aggressively. Coin flip.',
          apply: S => { if (chance(.55)) { activePlats(S).forEach(p => p.heat = clamp(p.heat + 16, 0, 100)); return fed('📡', 'You cracked the new format early. Buzz surged everywhere.', 'big'); } activePlats(S).forEach(p => p.heat = clamp(p.heat - 13, 0, 100)); return fed('📉', 'Guessed wrong. Reach cratered across the board this week.', 'bad'); } },
        { t: 'neutral', ci: '🎯', label: 'Keep doing your thing', desc: 'Stay the course.',
          apply: S => { activePlats(S).forEach(p => p.heat = clamp(p.heat - 7, 0, 100)); S.rep = clamp(S.rep + 3, 0, 100); return fed('🎯', "Didn't chase it. Reach dipped, but the loyal ones stayed.", ''); } },
      ] },
    { kind: 'neutral', emoji: '🎁', title: 'A fan sends $500 and a note.', badge: 'Wholesome', cond: () => true,
      text: '"Your stuff got me through a hard year." It lands harder than any metric.',
      choices: [
        { t: 'repair', ci: '💖', label: 'Shout them out', desc: 'Feature the note. The community glows.',
          apply: S => { S.cash += 500; S.rep = clamp(S.rep + rint(4, 9), 0, 100); S.energy = clamp(S.energy + 8, 0, 100); const log = fed('💖', 'You shared it. +$500 and a wave of goodwill.', 'good'); log.floats.push({ anchor: 'cash', text: '+$500', tone: 'cash' }); return log; } },
        { t: 'neutral', ci: '🙏', label: 'Thank them privately', desc: 'Keep it personal.',
          apply: S => { S.cash += 500; S.rep = clamp(S.rep + 3, 0, 100); const log = fed('🙏', 'A quiet thank-you DM. +$500 and a warm feeling.', 'good'); log.floats.push({ anchor: 'cash', text: '+$500', tone: 'cash' }); return log; } },
      ] },
    { kind: 'neutral', emoji: '💸', title: 'A crypto brand slides into your DMs.', badge: 'Sponsor', cond: () => true,
      text: '"$$$ for one video. No disclosure needed 😉." Big bag, bad vibe.',
      choices: [
        { t: 'escalate', ci: '💰', label: 'Take the bag', desc: "Cash now. Your audience won't forget.",
          apply: S => { const p = Math.round(rnd(900, 2400)); S.cash += p; S.rep = clamp(S.rep - rint(12, 22), 0, 100); S.deals++; const log = fed('💸', `Cashed it: +${money(p)}. The comments are rough.`, 'bad'); log.floats.push({ anchor: 'cash', text: '+' + money(p), tone: 'cash' }); return log; } },
        { t: 'repair', ci: '🛡️', label: 'Decline on camera', desc: 'Fans respect the integrity.',
          apply: S => { S.rep = clamp(S.rep + rint(6, 12), 0, 100); return fed('🛡️', 'You called it out publicly. Reputation up.', 'good'); } },
      ] },
    // ---- hostile sub-deck: repair / neutral / escalate ----
    { kind: 'hostile', emoji: '👹', title: 'A troll swarm hit your comments.', badge: 'Coordinated trolling', cond: () => true,
      text: 'A pile-on is filling every thread with bad-faith garbage. Newcomers see it first.',
      choices: [
        { t: 'repair', ci: '🧹', label: 'Moderate & set boundaries', desc: 'Clean it up, pin a calm reply.',
          apply: S => { S.energy = clamp(S.energy - 8, 0, 100); S.rep = clamp(S.rep + rint(2, 6), 0, 100); return fed('🧹', 'You cleaned house and stayed measured. The real audience exhaled.', 'good'); } },
        { t: 'neutral', ci: '😐', label: "Ignore, don't feed them", desc: 'Say nothing, keep posting.',
          apply: S => { if (chance(.6)) return fed('😐', 'You starved the trolls. They got bored and left.', ''); S.rep = clamp(S.rep - rint(3, 7), 0, 100); return fed('😕', 'Ignoring it let the narrative set in a bit. Small rep hit.', 'bad'); } },
        { t: 'escalate', ci: '🤬', label: 'Roast them publicly', desc: 'Clap back hard. High variance.',
          apply: S => { if (chance(.45)) { const p = strongest(S); const g = Math.round(rnd(1200, 5000)); p.followers += g; p.heat = clamp(p.heat + 16, 0, 100); const log = fed('🔥', `The roast went viral. +${fmt(g)} followers came for the show.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } S.rep = clamp(S.rep - rint(10, 18), 0, 100); return fed('💀', 'It read as punching down. Screenshots everywhere. Rep dropped.', 'bad'); } },
      ] },
    { kind: 'hostile', emoji: '⚖️', title: "You're being cancelled over a misread clip.", badge: 'Cancel attempt', cond: S => S.rep > 25,
      text: 'A 12-second clip is circulating out of context. People who never watched you are furious. It\'s trending.',
      choices: [
        { t: 'repair', ci: '🎥', label: 'Post a calm clarification', desc: 'Show the full context, own any real mistake.',
          apply: S => { if (S.rep > 50 || chance(.7)) { S.rep = clamp(S.rep + rint(3, 8), 0, 100); return fed('✅', 'The full context defused it. Level-headed fans defended you.', 'good'); } S.rep = clamp(S.rep - rint(4, 9), 0, 100); return fed('😬', 'The clarification helped some, but the clip travelled further than the context.', 'bad'); } },
        { t: 'neutral', ci: '🤐', label: 'Go quiet and wait it out', desc: 'Let the cycle move on.',
          apply: S => { if (chance(.5)) { S.rep = clamp(S.rep - rint(2, 6), 0, 100); return fed('🤐', 'You waited. The mob found a new target in a few days.', ''); } S.rep = clamp(S.rep - rint(10, 20), 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat - 10, 0, 100)); return fed('📉', 'Silence read as guilt. It festered — rep and reach both dropped.', 'bad'); } },
        { t: 'escalate', ci: '🗯️', label: 'Deny everything, attack the accusers', desc: 'Refuse to engage in good faith.',
          apply: S => { S.rep = clamp(S.rep - rint(14, 26), 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat - 8, 0, 100)); return fed('🌋', 'Defiance poured fuel on it. The pile-on doubled. This is how creators get cancelled for real.', 'bad'); } },
      ] },
    { kind: 'hostile', emoji: '⭐', title: "You're getting review-bombed.", badge: 'Brigade', cond: S => totalFollowers(S) > 2000,
      text: 'A brigade from another community is mass-downvoting and one-star-reviewing everything you post.',
      choices: [
        { t: 'repair', ci: '📣', label: 'Rally your real community', desc: 'Ask loyal fans to drown out the noise.',
          apply: S => { S.energy = clamp(S.energy - 6, 0, 100); const p = strongest(S); p.heat = clamp(p.heat + 8, 0, 100); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('📣', 'Your community showed up and buried the brigade. Solidarity win.', 'good'); } },
        { t: 'neutral', ci: '⏳', label: 'Report and wait', desc: 'Trust the platform to sort it.',
          apply: S => { if (chance(.55)) return fed('⏳', 'Platform caught the coordinated abuse and reversed it. No lasting harm.', ''); const p = strongest(S); p.heat = clamp(p.heat - 9, 0, 100); return fed('😑', 'The reports went nowhere for now. Reach took a temporary hit.', 'bad'); } },
        { t: 'escalate', ci: '🎯', label: 'Name and target their community', desc: 'Point your audience at them. Starts a war.',
          apply: S => { S.rep = clamp(S.rep - rint(8, 16), 0, 100); if (chance(.4)) { const p = strongest(S); const g = Math.round(rnd(800, 3000)); p.followers += g; const log = fed('⚔️', `Started an all-out war. Messy — but +${fmt(g)} rubberneckers subscribed.`, 'bad'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } return fed('🔥', 'The feud spiralled. Both sides look bad; you look worse. Rep dropped.', 'bad'); } },
      ] },
    { kind: 'hostile', emoji: '🕵️', title: 'A "receipts" account is digging through your old posts.', badge: 'Callout', cond: S => S.week > 8,
      text: 'Someone is building a thread of your worst old takes, screenshotting everything from years ago.',
      choices: [
        { t: 'repair', ci: '🌱', label: 'Get ahead of it — address the old stuff', desc: 'Acknowledge growth, delete nothing quietly.',
          apply: S => { S.rep = clamp(S.rep + rint(2, 7), 0, 100); return fed('🌱', 'You owned your growth before they could frame it. Mature move, mostly respected.', 'good'); } },
        { t: 'neutral', ci: '😶', label: "Don't dignify it", desc: 'Keep posting like nothing happened.',
          apply: S => { if (chance(.5)) return fed('😶', 'The thread got some traction, then faded. No real damage.', ''); S.rep = clamp(S.rep - rint(5, 11), 0, 100); return fed('🗂️', 'The receipts thread stuck around and got quoted. Slow rep bleed.', 'bad'); } },
        { t: 'escalate', ci: '🚫', label: "Mass-delete and deny it's you", desc: 'Scrub everything, gaslight the thread.',
          apply: S => { S.rep = clamp(S.rep - rint(12, 22), 0, 100); return fed('🧨', 'People screenshot faster than you can delete. The cover-up became the story.', 'bad'); } },
      ] },
    { kind: 'hostile', emoji: '💔', title: 'A parasocial superfan turned on you.', badge: 'Parasocial', cond: S => totalFollowers(S) > 4000,
      text: "A former top supporter feels personally betrayed you didn't reply, and is now your loudest hater.",
      choices: [
        { t: 'repair', ci: '🫶', label: 'Reach out privately, set kind boundaries', desc: 'Human, but firm about limits.',
          apply: S => { S.energy = clamp(S.energy - 6, 0, 100); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('🫶', "A gentle, firm DM cooled it. You can't save everyone, but you handled it with grace.", 'good'); } },
        { t: 'neutral', ci: '🚪', label: 'Quietly block and move on', desc: 'Protect your peace.',
          apply: S => fed('🚪', 'You blocked and moved on. A little noise, but your headspace is safer.', '') },
        { t: 'escalate', ci: '📸', label: 'Expose their DMs publicly', desc: 'Post the receipts to humiliate them.',
          apply: S => { if (chance(.5)) { S.rep = clamp(S.rep - rint(8, 15), 0, 100); return fed('😖', "Airing a fan's private breakdown looked cruel. It cost you goodwill.", 'bad'); } S.rep = clamp(S.rep - rint(3, 7), 0, 100); return fed('😐', 'Some cheered, many winced. A wash that left a bad taste.', 'bad'); } },
      ] },
    { kind: 'neutral', emoji: '🥵', title: "You haven't slept in days.", badge: 'Health', cond: S => S.energy < 45,
      text: 'The grind is catching up. Your body is sending invoices.',
      choices: [
        { t: 'escalate', ci: '⛽', label: 'Push through it', desc: 'Keep the streak alive. Risky.',
          apply: S => { S.energy = clamp(S.energy - 15, 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat + 5, 0, 100)); return fed('⛽', 'You pushed through. The feed stayed fed — you did not.', 'bad'); } },
        { t: 'repair', ci: '🛌', label: 'Log off and recover', desc: 'Reset energy, lose momentum.',
          apply: S => { S.energy = clamp(S.energy + 40, 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat - 10, 0, 100)); return fed('🛌', 'You logged off for real. Energy restored, buzz cooled.', 'good'); } },
      ] },
  ];

  // ======================= weekly orchestration =======================
  function settleWeek(S) {
    let passive = 0;
    activePlats(S).forEach(p => { passive += p.followers * PLATFORMS[p.key].rpm * (0.5 + p.heat / 200); });
    passive += S.members * CONFIG.memberRate;
    S.cash += Math.round(passive); S.cash -= rent(S);
    PORDER.forEach(k => { const p = S.plats[k]; p.heat = clamp(Math.round(p.heat * 0.82) - 2, 0, 100); if (p.lastPost < S.week) p.fatigue = clamp(p.fatigue - 14, 0, 100); });
    if (S.energy <= 8) S.lowStreak = (S.lowStreak || 0) + 1; else S.lowStreak = 0;
    return Math.round(passive);
  }
  function drawEvent(S) { const deck = EVENTS.filter(e => !e.cond || e.cond(S)); return pick(deck); }
  function rollEvent(S) { return (S.week >= 2 && chance(CONFIG.eventChance)) ? drawEvent(S) : null; }
  function applyEventChoice(S, ev, i) { return ev.choices[i].apply(S); }
  function advanceWeek(S) { S.week++; S.slots = { content: CONFIG.slotsContent, business: CONFIG.slotsBusiness }; }

  function checkEndings(S) {
    const tot = totalFollowers(S); let key = null;
    if (S.rep <= 0) key = 'cancelled';
    else if (S.cash < CONFIG.bankruptFloor) key = 'bankrupt';
    else if (S.redlineStreak >= CONFIG.burnoutStreak) key = 'burnout';
    else if (S.deals >= CONFIG.sellDeals && S.rep < CONFIG.sellRepUnder && S.cash > CONFIG.sellCashOver) key = 'sellout';
    else if (S.week > CONFIG.years) {
      if (tot >= CONFIG.goatAt) key = 'goat';
      else if (tot >= CONFIG.starAt) key = 'star';
      else if (tot >= CONFIG.legendAt && S.rep >= CONFIG.legendRep) key = 'legend';
      else key = 'faded';
    }
    if (key) { S.over = true; S.endKey = key; }
    return key;
  }

  const ENDINGS = {
    cancelled: { emoji: '📛', kicker: 'Cancelled', title: 'The internet turned on you.', blurb: 'Reputation hit zero. Sponsors ghosted, fans left, and your name is trending for all the wrong reasons.', lesson: 'Reputation compounds slower than followers — and collapses faster. How you answer your haters is half the game.' },
    bankrupt: { emoji: '💸', kicker: 'Broke', title: 'You ran out of runway.', blurb: "The debt got too deep. Rent and gear and living costs don't care how good last week's video was. You got a day job.", lesson: "Audience isn't income. Diversifying platforms — and getting fans to pay you directly — is what turns reach into rent." },
    burnout: { emoji: '🕯️', kicker: 'Burnout', title: 'You burned all the way out.', blurb: 'The energy tank hit empty and stayed there. Feeding five platforms at once, you stopped being able to make anything at all.', lesson: 'You cannot feed every platform every week. The creators who last pick their surfaces and protect the one resource nobody tracks.' },
    sellout: { emoji: '🤑', kicker: 'Sold out', title: 'You became an ad in human form.', blurb: 'The bag got too tempting, too often. Rich and technically famous, but nobody remembers what you actually make.', lesson: "Every brand deal is a small withdrawal from trust. Overdraw it and there's nothing left to sell but yourself." },
    star: { emoji: '🌟', kicker: 'Viral star', title: 'You went fully mainstream.', blurb: 'A quarter-million-plus and climbing across platforms. Brands, press, maybe a Netflix producer in your DMs.', lesson: "Breaking out takes real skill AND a viral moment you can't schedule. Talent loads the dice; luck rolls them." },
    goat: { emoji: '👑', kicker: 'G.O.A.T.', title: 'Biggest creator on the planet.', blurb: 'A million-plus followers and a cultural footprint across every surface. You didn\'t just win the game — you became it.', lesson: 'The very top is skill, stamina, and an absurd amount of luck stacked together. Almost nobody reaches it. You did.' },
    legend: { emoji: '🏆', kicker: 'Niche legend', title: 'You built something that lasts.', blurb: "Not the biggest — but beloved, respected, sustainable. A loyal audience, real income, and a life you didn't have to torch to keep it.", lesson: "The healthiest ending isn't the biggest number. An audience that trusts you beats a huge one that doesn't." },
    faded: { emoji: '🌫️', kicker: 'Faded out', title: 'You slowly faded into the feed.', blurb: 'A year in, the numbers never quite took off. Not a disaster, not a triumph — just another creator the algorithm stopped recommending.', lesson: 'This is the most common ending by far. Not failure — just the quiet math of an attention economy with room for very few.' },
  };

  return {
    CONFIG, NICHES, PLATFORMS, PORDER, TIERS, TIERCUT, ANGLES, HIRES, HORDER, ENDINGS, EVENTS,
    setRng, rnd, rint, clamp, chance, pick, fmt, money,
    newState, activePlats, totalFollowers, strongest, platTier,
    useSlot, addStress, stressBand, hasStudio, hireCount, hireCap, payroll, overhead, overheadBreakdown, hireInfo,
    viewsMult, stressCost, upgradeInfo,
    buildHand, applyMove, doPost, startPlatform, crosspost, biz,
    settleWeek, drawEvent, rollEvent, applyEventChoice, advanceWeek, checkEndings,
  };
});
