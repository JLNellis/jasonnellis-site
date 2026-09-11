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
 * ('cash' | 'rep' | 'plat:<key>') so the engine stays DOM-free.
 *
 * Weekly orchestration (both consumers follow the same sequence):
 *   buildHand(S)               deal this week's content cards
 *   applyMove(S, card) / biz.* up to 2 content + 1 business action (slots)
 *   log = settleWeek(S)        tails, membership, overhead, churn, stress bands
 *   ev = rollEvent(S)          maybe draw an event (or null)
 *     if ev: applyEventChoice(S, ev, i) -> log   (browser shows card first)
 *   advanceWeek(S)             week++, slots reset
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
    // Tuned so two heavy posts (longform ×2 = 26) net +3/week over stressRecover — sustained max
    // output redlines ~w16 and burns out ~w18 — while one empty slot (23 + 18 − 13) nets −28.
    // The Grinder persona = that ramp + engageStress every week; target 1 needs it to last ≥15w,
    // which is why engageStress is 1 (at 2 the Grinder burns out at ~12w).
    stressRecover: 23, stressRecoverPerEmptySlot: 18,
    engageStress: 1, dealStress: 4,
    bandHot: 50, bandFumes: 70, bandRedline: 90, fumesViewsMult: 0.85,
    burnoutStreak: 3,
    // overhead (replaces rent): flat + per platform + payroll + studio lease
    overheadBase: 60, overheadPerPlatform: 10, studioLease: 3000,
    // post math
    viewsK: 160, baseConv: 0.02, sizeSat: 55000, sizeMax: 6,
    // churn
    churnBase: 0.006, churnTrend: 0.012, churnIdle: 0.02, idleWeeks: 3,
    // evergreen tail
    tailWeeks: 4, tailRate: 0.15,
    topicCooldown: 8,
    // money
    bankruptFloor: -2500,
    dealBase: 150, dealScale: 0.018, dealRepBase: 0.6,
    paidUnlock: 1500, memberRate: 4, memberConvMin: 0.02, memberConvMax: 0.045,
    memberNewConv: 0.025, memberChurn: 0.04, memberChurnIdle: 0.12,
    // gear: tiers 1-3 are kit, tier 4 is the Studio
    gearCost: [0, 350, 800, 1700, 12000], gearViewsMult: 1.10,
    studioUnlockFollowers: 25000, studioViewsMult: 2.8, studioStressRelief: 6,
    hireCapBase: 2, hireCapStudio: 4,
    // endings
    goatAt: 200000, starAt: 70000, legendAt: 37000, legendRep: 55,
    sellDeals: 6, sellRepUnder: 45, sellCashOver: 1800,
    eventChance: 0.55,
    // event deck: phase bands (weeks) + tax rate on gross earned since last tax event
    phases: { earlyEnd: 17, midEnd: 35 }, // early 2–17 · mid 18–35 · late 36–52
    taxRate: 0.22,
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
    gaming:  { label: 'Gaming',    emoji: '🎮', rep0: 52, viral: 1.15, deal: 1.0,  skill: 1.1,  blurb: 'loud, then gone' },
    beauty:  { label: 'Beauty',    emoji: '💄', rep0: 58, viral: 1.0,  deal: 1.35, skill: 1.0,  blurb: 'brands will call' },
    edu:     { label: 'Education', emoji: '📚', rep0: 70, viral: 0.82, deal: 0.9,  skill: 1.15, blurb: 'slow, then loyal' },
    comedy:  { label: 'Comedy',    emoji: '🤡', rep0: 54, viral: 1.3,  deal: 0.95, skill: 1.0,  blurb: 'viral or cancelled' },
    fitness: { label: 'Fitness',   emoji: '💪', rep0: 60, viral: 1.05, deal: 1.2,  skill: 1.0,  blurb: 'show up every day' },
    music:   { label: 'Music',     emoji: '🎧', rep0: 60, viral: 1.2,  deal: 0.9,  skill: 1.2,  blurb: 'the long way round' },
  };
  // Platform accent colors map onto the site's Bolt OS status palette:
  // green (hero), blue (info), slate (muted), amber (warning), red (live).
  // `stress` = stress cost per post. `rpm` = ad revenue per VIEW.
  const PLATFORMS = {
    longform:  { name: 'Longform Video', tag: 'YT-style',       emoji: '🎬', color: '#00E676', stress: 13, rpm: .0045, viral: 1.0,  loyal: 1.25, unlock: 0,    fmt: 'a deep-dive video' },
    shortform: { name: 'Short Video',    tag: 'vertical clips',  emoji: '📱', color: '#3B82F6', stress: 10, rpm: .0006, viral: 1.6,  loyal: .6,   unlock: 0,    fmt: 'a batch of shorts' },
    micro:     { name: 'Microblog',      tag: 'text posts',      emoji: '💬', color: '#94A3B8', stress: 6,  rpm: .0003, viral: 1.25, loyal: .8,   unlock: 0,    fmt: 'a hot take' },
    writing:   { name: 'Newsletter',     tag: 'long writing',    emoji: '📰', color: '#F59E0B', stress: 12, rpm: .006,  viral: .75,  loyal: 1.5,  unlock: 1200, fmt: 'a longform essay' },
    live:      { name: 'Live Stream',    tag: 'live',            emoji: '🔴', color: '#EF4444', stress: 16, rpm: .003,  viral: .9,   loyal: 1.6,  unlock: 2500, fmt: 'a live stream' },
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
  // Content angles. Multipliers on the post math; the trade-offs are the lesson.
  //   views: reach multiplier · conv: follower conversion · heatHit: heat gain on a hit
  //   stress: extra stress · rep: passive rep gain · badChance/badRep: chance + size of a rep hit
  //   tail: evergreen keeps earning for CONFIG.tailWeeks · cohort: followers churn 2x
  const ANGLES = {
    trend:     { label: 'Trend',     emoji: '📈', views: 1.6, conv: 0.5, heatHit: [12, 20], stress: 0, badChance: 0.04, badRep: [3, 8],  cohort: true,
                 tag: 'chase what\'s hot', bad: 'aged badly. The take didn\'t hold up.' },
    evergreen: { label: 'Evergreen', emoji: '🌲', views: 0.8, conv: 1.3, heatHit: [4, 8],   stress: 0, tail: true,
                 tag: 'built to last' },
    personal:  { label: 'Personal',  emoji: '🫀', views: 1.0, conv: 1.1, heatHit: [8, 14],  stress: 6, rep: [2, 4], badChance: 0.08, badRep: [6, 12],
                 tag: 'you, on camera', bad: 'was too much for some people.' },
  };
  const AORDER = ['trend', 'evergreen', 'personal'];

  // Topic lines: written like real titles. 5 per niche per angle. Dealt with an 8-week cooldown.
  const TOPICS = {
    gaming: {
      trend:     ['I tried the patch everyone\'s furious about', 'Ranking every announcement from the showcase', 'The speedrun record just got destroyed', 'This game is dying and nobody will say it', 'Reacting to the most cursed clip of the week'],
      evergreen: ['The complete beginner\'s guide to speedrunning', 'Every setting you should change on day one', 'How matchmaking actually works', 'The best games nobody played this year', 'A beginner build that still wins'],
      personal:  ['Why I almost quit streaming', 'What 1,000 hours in one game did to me', 'My setup tour, the honest version', 'The DM that changed how I read chat', 'I got banned for this'],
    },
    beauty: {
      trend:     ['Testing the viral $9 dupe', 'Trying the routine that\'s all over my feed', 'Is this brand actually cancelled? The receipts', 'First impressions: the launch everyone\'s mad about', 'The clean-girl look in five minutes'],
      evergreen: ['Skincare basics I wish someone told me at 20', 'How to actually match your foundation', 'Everything in my bag, ranked by cost per wear', 'The 10-minute face for people who hate makeup', 'Reading an ingredients list without panicking'],
      personal:  ['Why I stopped hiding my skin', 'The brand deal I turned down', 'Getting ready with me on a bad day', 'My face at 30 vs 20, no filter', 'The comment that made me stop posting for a month'],
    },
    edu: {
      trend:     ['That viral stat is wrong. Here\'s the math', 'The news story everyone got wrong', 'Reacting to the study that broke the internet', 'Debunking the thread with 40 million views', 'Why the exam is trending, and what it means'],
      evergreen: ['The complete beginner\'s guide to compound interest', 'Every logical fallacy in 12 minutes', 'How to learn anything in 20 hours', 'The history nobody teaches in school', 'How the internet actually works, from first principles'],
      personal:  ['I failed out. Here\'s what actually happened.', 'What ten years of teaching taught me', 'The student question I couldn\'t answer', 'My study routine, the honest version', 'Why I left academia'],
    },
    comedy: {
      trend:     ['Every reply guy, ranked', 'Doing the trend but wrong on purpose', 'Live-reacting to the worst take of the week', 'The group chat when the drama drops', 'If the algorithm were a person'],
      evergreen: ['Types of people at every airport', 'The customer who\'s "just looking"', 'Every family dinner, condensed', 'The universal experience of a bad haircut', 'How to lose an argument you were winning'],
      personal:  ['The set that bombed so badly I rewrote everything', 'Why I stopped doing crowd work', 'My worst DM, read aloud', 'Getting sober on the internet', 'What my mom thinks I do for a living'],
    },
    fitness: {
      trend:     ['Testing the 75-day challenge everyone\'s doing', 'That viral workout is going to hurt you', 'Reacting to the celebrity\'s "routine"', 'The supplement everyone\'s mad about, tested', '30 days on the trending diet'],
      evergreen: ['The complete beginner\'s guide to the gym', 'Form check: five lifts you\'re doing wrong', 'How to actually build a habit', 'Eating enough: the guide nobody asked for', 'A home workout that isn\'t a scam'],
      personal:  ['The injury that took a year off my life', 'What I eat in a day, no lies this time', 'Why I deleted my progress photos', 'Training through a breakup', 'The DM from someone who started because of me'],
    },
    music: {
      trend:     ['Breaking down the song everyone\'s fighting about', 'Producing the trending sound in 10 minutes', 'Reacting to the award-show performance', 'This sample is about to blow up', 'Remixing the meme before it dies'],
      evergreen: ['Music theory in 15 minutes, no jargon', 'How a hit is actually built, layer by layer', 'Every chord progression you already know', 'Mixing for people with cheap headphones', 'The gear you actually need to start'],
      personal:  ['The label email I never answered', 'Why I stopped chasing playlists', 'Playing my first song again, five years later', 'Stage fright, on camera', 'The song I wrote about my dad'],
    },
  };
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
      seenEvents: [], grossEarned: 0, taxedThrough: 0,
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
    if (hireCount(S) >= hireCap(S)) return { ok: false, reason: hasStudio(S) ? 'Team is full.' : 'No room. You need the Studio to hold more than two people.' };
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
    const band = stressBand(S); if (band === 'fumes' || band === 'redline') m *= CONFIG.fumesViewsMult;
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
    if (nx > 4) return { next: null, cost: 0, ok: false, reason: 'Full rig and a studio. Nothing left to buy.' };
    const cost = CONFIG.gearCost[nx];
    // nx === 4 only when S.gear === 3 — the Studio needs the full kit first.
    if (nx === 4 && totalFollowers(S) < CONFIG.studioUnlockFollowers) return { next: nx, cost, ok: false, reason: 'The Studio unlocks at ' + fmt(CONFIG.studioUnlockFollowers) + ' followers.' };
    if (S.cash < cost) return { next: nx, cost, ok: false, reason: 'Costs ' + money(cost) + '.' };
    if (S.slots.business <= 0) return { next: nx, cost, ok: false, reason: 'No business slot left this week.' };
    return { next: nx, cost, ok: true, reason: '' };
  }

  // --- damage helpers used by events; the community mod softens both ---
  function repHit(S, lo, hi) { const n = Math.round(rint(lo, hi) * (S.hires.mod ? 0.67 : 1)); S.rep = clamp(S.rep - n, 0, 100); return n; }
  function loseFollowers(S, fracLo, fracHi) {
    const p = strongest(S); if (!p) return 0;
    const n = Math.round(p.followers * rnd(fracLo, fracHi) * (S.hires.mod ? 0.5 : 1));
    const cohortShare = p.followers ? p.trendFollowers / p.followers : 0;
    p.followers -= n; p.trendFollowers = Math.max(0, Math.round(p.trendFollowers - n * cohortShare));
    return n;
  }

  const L = () => ({ floats: [], feed: [], bump: [] });

  // ======================= the dealt hand =======================
  function pickTopic(S, angleKey) {
    const all = TOPICS[S.niche][angleKey];
    const recent = new Set(S.usedTopics.filter(u => S.week - u.week < CONFIG.topicCooldown).map(u => u.topic));
    const fresh = all.filter(t => !recent.has(t));
    return pick(fresh.length ? fresh : all);
  }
  function postCard(S, p, angleKey, ride) {
    let mod = 1;
    if (p.heat >= 52) mod *= 1.35;
    if (p.proven && p.fatigue < 45) mod *= 1.12;
    if (p.fatigue >= 52) mod *= 0.55;
    if (ride) mod *= 1.6;
    // keep the topic the player already saw this week for this platform+angle
    const prev = (S.hand || []).find(c => c.pkey === p.key && c.angle === angleKey && c.topic);
    return { kind: ride ? 'ride' : 'post', pkey: p.key, angle: angleKey, topic: prev ? prev.topic : pickTopic(S, angleKey),
             mod, stress: stressCost(S, p.key, angleKey), special: !!ride, ride: !!ride, heat: p.heat, fatigue: p.fatigue, proven: p.proven };
  }
  function buildHand(S) {
    const hand = [], act = activePlats(S);
    let personalUsed = false;
    act.forEach(p => {
      const ride = !!(S.lastHit && S.lastHit.key === p.key && S.week - S.lastHit.week <= 1);
      let angle = 'evergreen';
      if (ride || p.heat >= 40) angle = 'trend';
      else if (S.rep < 50 && !personalUsed) { angle = 'personal'; personalUsed = true; }
      hand.push(postCard(S, p, angle, ride));
    });
    // With ≤3 platforms, add a second angle on the strongest so there's usually a second angle to weigh against the first.
    const top = strongest(S);
    if (top && hand.length <= 3) {
      const have = hand.find(c => c.pkey === top.key);
      hand.push(postCard(S, top, have.angle === 'trend' ? 'evergreen' : 'trend', false));
    }
    if (act.length >= 2) {
      const src = act.slice().sort((a, b) => b.followers - a.followers)[0];
      const dst = act.slice().sort((a, b) => a.followers - b.followers)[0];
      if (src.key !== dst.key && src.followers > 500 && src.heat > 25)
        hand.push({ kind: 'crosspost', src: src.key, dst: dst.key, special: true, stress: 4 });
    }
    const locked = PORDER.map(k => S.plats[k]).filter(p => !p.active && totalFollowers(S) >= PLATFORMS[p.key].unlock);
    if (locked.length) hand.push({ kind: 'start', pkey: locked[0].key, special: true, stress: 8 });
    S.hand = hand;
    return hand;
  }

  // ======================= applying content moves =======================
  // views -> followers -> money. Views are the per-post output (shown in the feed,
  // summed into S.totalViews); followers are the persistent number; ad revenue is views × rpm.
  function doPost(S, k, angleKey, topic, mod) {
    const p = S.plats[k], pf = PLATFORMS[k], A = ANGLES[angleKey], before = platTier(S, p);
    const q = 22 + rnd(4, 18);
    const heatF = 1 + p.heat / 45, luck = rnd(.55, 1.6);
    const sizeF = 1 + CONFIG.sizeMax * p.followers / (p.followers + CONFIG.sizeSat); // saturating, no runaway
    const views = Math.max(1, Math.round(q * heatF * sizeF * pf.viral * NICHES[S.niche].viral * A.views * (mod ?? 1)
                  * clamp(1 - p.fatigue / 160, .5, 1) * luck * CONFIG.viewsK * viewsMult(S, k)));
    const gain = Math.round(views * CONFIG.baseConv * pf.loyal * A.conv);
    const rev = Math.round(views * pf.rpm);
    p.followers += gain; if (A.cohort) p.trendFollowers += gain;
    S.newFollowers += gain; S.totalViews += views; S.cash += rev; S.grossEarned += rev;
    p.posts++; p.lastPost = S.week; p.fatigue = clamp(p.fatigue + rint(10, 20), 0, 100);
    const hit = luck > 1.12;
    p.heat = clamp(p.heat + (hit ? rint(A.heatHit[0], A.heatHit[1]) : -rint(0, 3)), 0, 100);
    if (hit) { p.proven = true; S.lastHit = { key: k, week: S.week }; }
    if (A.rep) S.rep = clamp(S.rep + rint(A.rep[0], A.rep[1]), 0, 100);
    let repHit = 0;
    if (A.badChance && chance(A.badChance)) { repHit = rint(A.badRep[0], A.badRep[1]); S.rep = clamp(S.rep - repHit, 0, 100); }
    if (A.tail) S.tails.push({ pkey: k, topic, views, weeksLeft: CONFIG.tailWeeks });
    S.usedTopics.push({ topic, week: S.week });

    const log = L();
    log.floats.push({ anchor: 'plat:' + k, text: '+' + fmt(gain), tone: hit ? 'hit' : 'gain' });
    if (rev > 0) log.floats.push({ anchor: 'cash', text: '+' + money(rev), tone: 'cash' });
    log.feed.push({ emoji: pf.emoji, text: `‘${topic}’ did ${fmt(views)} views on ${pf.name}. +${fmt(gain)} followers${rev > 0 ? ', +' + money(rev) : ''}.${hit ? ' It took off.' : ''}`, kind: hit ? 'good' : '' });
    if (hit) log.feed.push({ emoji: '🔥', text: `${pf.name} is hot. Ride it next week or lose it.`, kind: 'big' });
    if (repHit) { log.floats.push({ anchor: 'rep', text: '-' + repHit, tone: 'loss' }); log.feed.push({ emoji: '😬', text: `‘${topic}’ ${A.bad} Rep −${repHit}.`, kind: 'bad' }); }
    log.bump.push(k);
    if (platTier(S, p) > before) log.feed.push({ emoji: '📈', text: `${pf.name} is ${TIERS[platTier(S, p)]} tier now. It looks like someone means it.`, kind: 'good' });
    return log;
  }
  function startPlatform(S, k) {
    const p = S.plats[k], pf = PLATFORMS[k];
    p.active = true; p.followers = Math.round(totalFollowers(S) * 0.02 + 20); p.lastPost = S.week; p.posts = 1;
    const log = L(); log.bump.push(k);
    log.feed.push({ emoji: '✨', text: `${pf.name} is live. Nobody’s there yet.`, kind: 'good' });
    return log;
  }
  function crosspost(S, sk, dk) {
    const src = S.plats[sk], dst = S.plats[dk];
    const moved = Math.round(src.followers * rnd(.02, .06) * (1 + src.heat / 100));
    dst.followers += moved; dst.heat = clamp(dst.heat + 12, 0, 100); dst.lastPost = S.week;
    S.newFollowers += moved;
    const log = L(); log.bump.push(dk);
    log.floats.push({ anchor: 'plat:' + dk, text: '+' + fmt(moved), tone: 'gain' });
    log.feed.push({ emoji: '🔗', text: `Cross-posted to ${PLATFORMS[dk].name}. ${fmt(moved)} of them followed you over.`, kind: 'good' });
    return log;
  }
  function applyMove(S, m) {
    if (!useSlot(S, 'content')) return L();
    addStress(S, m.stress);
    if (m.kind === 'start') return startPlatform(S, m.pkey);
    if (m.kind === 'crosspost') return crosspost(S, m.src, m.dst);
    return doPost(S, m.pkey, m.angle, m.topic, m.mod);
  }

  // ======================= business actions (one per week) =======================
  const biz = {
    engage(S) { if (!useSlot(S, 'business')) return L(); addStress(S, CONFIG.engageStress); const r = rnd(2, 5); S.rep = clamp(S.rep + r, 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat + rint(1, 4), 0, 100));
      const log = L(); log.floats.push({ anchor: 'rep', text: '+' + r.toFixed(1), tone: 'up' });
      log.feed.push({ emoji: '💬', text: 'Showed up in the comments and DMs. The core crowd feels seen.', kind: 'good' }); return log; },
    deal(S) { if (totalFollowers(S) < 1000 || !useSlot(S, 'business')) return L(); addStress(S, CONFIG.dealStress);
      const repMult = CONFIG.dealRepBase + S.rep / 100, mgr = S.hires.manager;
      const pay = Math.round((CONFIG.dealBase + totalFollowers(S) * CONFIG.dealScale) * NICHES[S.niche].deal * repMult * (mgr ? 1.3 : 1));
      const h = rnd(4, 9) * (mgr ? 0.6 : 1);
      S.cash += pay; S.grossEarned += pay; S.rep = clamp(S.rep - h, 0, 100); S.deals++;
      const log = L(); log.floats.push({ anchor: 'cash', text: '+' + money(pay), tone: 'cash' }); log.floats.push({ anchor: 'rep', text: '-' + h.toFixed(0), tone: 'loss' });
      log.feed.push({ emoji: '🤝', text: `Ran a sponsored segment for ${money(pay)}${mgr ? '; your manager did the talking' : ''}. A few fans noticed the ad read.`, kind: '' }); return log; },
    upgrade(S) { const u = upgradeInfo(S); if (!u.ok || !useSlot(S, 'business')) return L();
      S.cash -= u.cost; S.gear = u.next;
      const log = L(); log.floats.push({ anchor: 'cash', text: '-' + money(u.cost), tone: 'loss' }); log.bump = PORDER.slice();
      if (u.next === 4) log.feed.push({ emoji: '🏢', text: `You signed the lease. Every post gets bigger. Every week costs ${money(CONFIG.studioLease)} more. No pressure.`, kind: 'big' });
      else log.feed.push({ emoji: '🛠️', text: `New kit, tier ${u.next}. Everything looks a little more expensive now.`, kind: 'good' });
      return log; },
    paid(S) { if (S.members > 0 || totalFollowers(S) < CONFIG.paidUnlock || !useSlot(S, 'business')) return L();
      S.members = Math.round(totalFollowers(S) * rnd(CONFIG.memberConvMin, CONFIG.memberConvMax));
      const log = L(); log.feed.push({ emoji: '⭐', text: `Membership is live. ${fmt(S.members)} people are paying you every month now. Keep showing up.`, kind: 'good' }); return log; },
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
  // a "bad" outcome that also costs followers on your biggest channel (anchor captured BEFORE the loss shrinks it)
  const hurt = (S, e, t, fracLo, fracHi) => { const key = strongest(S).key; const n = loseFollowers(S, fracLo, fracHi); const log = fed(e, n ? `${t} −${fmt(n)} followers.` : t, 'bad'); if (n) log.floats.push({ anchor: 'plat:' + key, text: '-' + fmt(n), tone: 'loss' }); return log; };
  // event apply-helpers for cash effects (float on the cash meter + a feed line)
  const spend = (S, e, t, amount, kind) => { const n = Math.max(0, Math.round(amount)); S.cash -= n; const log = fed(e, t, kind == null ? 'bad' : kind); log.floats.push({ anchor: 'cash', text: '-' + money(n), tone: 'loss' }); return log; };
  const gift  = (S, e, t, amount, kind) => { const n = Math.max(0, Math.round(amount)); S.cash += n; const log = fed(e, t, kind == null ? 'good' : kind); log.floats.push({ anchor: 'cash', text: '+' + money(n), tone: 'cash' }); return log; };
  const taxBill = S => { const taxable = Math.max(0, S.grossEarned - S.taxedThrough); S.taxedThrough = S.grossEarned; return Math.round(taxable * CONFIG.taxRate); };
  const EVENTS = [
    { id: 'viral-moment', repeatable: true, kind: 'neutral', emoji: '🚀', title: 'A post is going viral right now.', badge: 'Momentum', cond: () => true,
      text: 'One upload is spiking with strangers. The window is open.',
      choices: [
        { t: 'repair', ci: '🌊', label: 'Ride it across every platform', desc: 'Cross-promote hard. Costs stress, huge upside.',
          apply: S => { const g = Math.round(rnd(2000, 8000) * (1 + totalFollowers(S) / 40000)); const p = strongest(S); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 22, 0, 100); addStress(S, 10); S.lastHit = { key: p.key, week: S.week };
            const log = fed('🚀', `You rode it. +${fmt(g)} followers and the buzz is loud.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } },
        { t: 'neutral', ci: '😌', label: 'Let it breathe', desc: 'Take the smaller bump, keep your head.',
          apply: S => { const p = strongest(S); const g = Math.round(rnd(600, 2000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 8, 0, 100);
            const log = fed('🌊', `Didn't force it. +${fmt(g)} followers, stress intact.`, 'good'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'gain' }); log.bump.push(p.key); return log; } },
      ] },
    { id: 'algo-shift', repeatable: true, kind: 'neutral', emoji: '🔄', title: 'The platform changed its algorithm overnight.', badge: 'Platform shift', cond: () => true,
      text: 'The rules just changed. Nobody knows what the feed rewards anymore.',
      choices: [
        { t: 'repair', ci: '📡', label: 'Chase the new format fast', desc: 'Adapt aggressively. Coin flip.',
          apply: S => { if (chance(.55)) { activePlats(S).forEach(p => p.heat = clamp(p.heat + 16, 0, 100)); return fed('📡', 'You cracked the new format first. Everything’s loud.', 'big'); } activePlats(S).forEach(p => p.heat = clamp(p.heat - 13, 0, 100)); return fed('📉', 'Guessed wrong. Reach cratered across the board this week.', 'bad'); } },
        { t: 'neutral', ci: '🎯', label: 'Keep doing your thing', desc: 'Stay the course.',
          apply: S => { activePlats(S).forEach(p => p.heat = clamp(p.heat - 7, 0, 100)); S.rep = clamp(S.rep + 3, 0, 100); return fed('🎯', "Didn't chase it. Reach dipped, but the loyal ones stayed.", ''); } },
      ] },
    { id: 'fan-gift', kind: 'neutral', emoji: '🎁', title: 'A fan sends $500 and a note.', badge: 'Wholesome', cond: () => true,
      text: '"Your stuff got me through a hard year." You read it three times.',
      choices: [
        { t: 'repair', ci: '💖', label: 'Shout them out', desc: 'Feature the note. The community glows.',
          apply: S => { S.cash += 500; S.rep = clamp(S.rep + rint(4, 9), 0, 100); addStress(S, -5); const log = fed('💖', 'You shared it. +$500, and the comments went soft for a day.', 'good'); log.floats.push({ anchor: 'cash', text: '+$500', tone: 'cash' }); return log; } },
        { t: 'neutral', ci: '🙏', label: 'Thank them privately', desc: 'Keep it personal.',
          apply: S => { S.cash += 500; S.rep = clamp(S.rep + 3, 0, 100); const log = fed('🙏', 'A quiet thank-you. +$500 and a good night’s sleep.', 'good'); log.floats.push({ anchor: 'cash', text: '+$500', tone: 'cash' }); return log; } },
      ] },
    { id: 'crypto-dm', kind: 'neutral', emoji: '💸', title: 'A crypto brand slides into your DMs.', badge: 'Sponsor', cond: () => true,
      text: '"$$$ for one video. No disclosure needed 😉." Big bag, bad vibe.',
      choices: [
        { t: 'escalate', ci: '💰', label: 'Take the bag', desc: "Cash now. Your audience won't forget.",
          apply: S => { const p = Math.round(rnd(900, 2400)); S.cash += p; const r = repHit(S, 12, 22); S.deals++; const log = hurt(S, '💸', `Cashed it: +${money(p)}. The comments are rough. Rep −${r}.`, .01, .03); log.floats.push({ anchor: 'cash', text: '+' + money(p), tone: 'cash' }); return log; } },
        { t: 'repair', ci: '🛡️', label: 'Decline on camera', desc: 'Fans respect the integrity.',
          apply: S => { S.rep = clamp(S.rep + rint(6, 12), 0, 100); return fed('🛡️', 'You read the DM out on camera. Reputation up.', 'good'); } },
      ] },
    // ---- hostile sub-deck: repair / neutral / escalate ----
    { id: 'troll-swarm', repeatable: true, kind: 'hostile', emoji: '👹', title: 'A troll swarm hit your comments.', badge: 'Coordinated trolling', cond: () => true,
      text: 'A pile-on is filling every thread with bad-faith garbage. Newcomers see it first.',
      choices: [
        { t: 'repair', ci: '🧹', label: 'Moderate & set boundaries', desc: 'Clean it up, pin a calm reply.',
          apply: S => { addStress(S, 4); S.rep = clamp(S.rep + rint(2, 6), 0, 100); return fed('🧹', 'You cleaned house and stayed measured. The real audience exhaled.', 'good'); } },
        { t: 'neutral', ci: '😐', label: "Ignore, don't feed them", desc: 'Say nothing, keep posting.',
          apply: S => { if (chance(.6)) return fed('😐', 'You starved the trolls. They got bored and left.', ''); const r = repHit(S, 3, 7); return hurt(S, '😕', `Ignoring it let the narrative set in. Rep −${r}.`, .005, .015); } },
        { t: 'escalate', ci: '🤬', label: 'Roast them publicly', desc: 'Clap back hard. High variance.',
          apply: S => { if (chance(.45)) { const p = strongest(S); const g = Math.round(rnd(1200, 5000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 16, 0, 100); const log = fed('🔥', `The roast went viral. +${fmt(g)} followers came for the show.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } const r = repHit(S, 10, 18); return hurt(S, '💀', `It read as punching down. Screenshots everywhere. Rep −${r}.`, .02, .05); } },
      ] },
    { id: 'cancel-clip', kind: 'hostile', emoji: '⚖️', title: "You're being cancelled over a misread clip.", badge: 'Cancel attempt', cond: S => S.rep > 25,
      text: 'A 12-second clip is circulating out of context. People who never watched you are furious. It\'s trending.',
      choices: [
        { t: 'repair', ci: '🎥', label: 'Post a calm clarification', desc: 'Show the full context, own any real mistake.',
          apply: S => { if (S.rep > 50 || chance(.7)) { S.rep = clamp(S.rep + rint(3, 8), 0, 100); return fed('✅', 'The full context defused it. Level-headed fans defended you.', 'good'); } const r = repHit(S, 4, 9); return hurt(S, '😬', `The clarification helped some, but the clip travelled further than the context. Rep −${r}.`, .01, .02); } },
        { t: 'neutral', ci: '🤐', label: 'Go quiet and wait it out', desc: 'Let the cycle move on.',
          apply: S => { if (chance(.5)) { repHit(S, 2, 6); return fed('🤐', 'You waited. The mob found a new target in a few days.', ''); } const r = repHit(S, 10, 20); activePlats(S).forEach(p => p.heat = clamp(p.heat - 10, 0, 100)); return hurt(S, '📉', `Silence read as guilt. It festered. Rep −${r}.`, .02, .04); } },
        { t: 'escalate', ci: '🗯️', label: 'Deny everything, attack the accusers', desc: 'Refuse to engage in good faith.',
          apply: S => { const r = repHit(S, 14, 26); activePlats(S).forEach(p => p.heat = clamp(p.heat - 8, 0, 100)); return hurt(S, '🌋', `Defiance poured fuel on it. The pile-on doubled. This is how creators get cancelled for real. Rep −${r}.`, .03, .06); } },
      ] },
    { id: 'review-bomb', kind: 'hostile', emoji: '⭐', title: "You're getting review-bombed.", badge: 'Brigade', cond: S => totalFollowers(S) > 2000,
      text: 'A brigade from another community is mass-downvoting and one-star-reviewing everything you post.',
      choices: [
        { t: 'repair', ci: '📣', label: 'Rally your real community', desc: 'Ask loyal fans to drown out the noise.',
          apply: S => { addStress(S, 3); const p = strongest(S); p.heat = clamp(p.heat + 8, 0, 100); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('📣', 'Your community showed up and buried the brigade. Solidarity win.', 'good'); } },
        { t: 'neutral', ci: '⏳', label: 'Report and wait', desc: 'Trust the platform to sort it.',
          apply: S => { if (chance(.55)) return fed('⏳', 'Platform caught the coordinated abuse and reversed it. No lasting harm.', ''); const p = strongest(S); p.heat = clamp(p.heat - 9, 0, 100); return hurt(S, '😑', 'The reports went nowhere for now. Reach took a hit.', .005, .015); } },
        { t: 'escalate', ci: '🎯', label: 'Name and target their community', desc: 'Point your audience at them. Starts a war.',
          apply: S => { const r = repHit(S, 8, 16); if (chance(.4)) { const p = strongest(S); const g = Math.round(rnd(800, 3000)); p.followers += g; S.newFollowers += g; const log = fed('⚔️', `Started an all-out war. Messy, but +${fmt(g)} rubberneckers subscribed. Rep −${r}.`, 'bad'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } return hurt(S, '🔥', `The feud spiralled. Both sides look bad; you look worse. Rep −${r}.`, .02, .04); } },
      ] },
    { id: 'receipts', kind: 'hostile', emoji: '🕵️', title: 'A "receipts" account is digging through your old posts.', badge: 'Callout', cond: S => S.week > 8,
      text: 'Someone is building a thread of your worst old takes, screenshotting everything from years ago.',
      choices: [
        { t: 'repair', ci: '🌱', label: 'Get ahead of it. Address the old stuff', desc: 'Acknowledge growth, delete nothing quietly.',
          apply: S => { S.rep = clamp(S.rep + rint(2, 7), 0, 100); return fed('🌱', 'You owned your growth before they could frame it. Mature move, mostly respected.', 'good'); } },
        { t: 'neutral', ci: '😶', label: "Don't dignify it", desc: 'Keep posting like nothing happened.',
          apply: S => { if (chance(.5)) return fed('😶', 'The thread got some traction, then faded. No real damage.', ''); const r = repHit(S, 5, 11); return hurt(S, '🗂️', `The receipts thread stuck around and got quoted. Rep −${r}.`, .01, .02); } },
        { t: 'escalate', ci: '🚫', label: "Mass-delete and deny it's you", desc: 'Scrub everything, gaslight the thread.',
          apply: S => { const r = repHit(S, 12, 22); return hurt(S, '🧨', `People screenshot faster than you can delete. The cover-up became the story. Rep −${r}.`, .02, .05); } },
      ] },
    { id: 'parasocial', kind: 'hostile', emoji: '💔', title: 'A parasocial superfan turned on you.', badge: 'Parasocial', cond: S => totalFollowers(S) > 4000,
      text: "A former top supporter feels personally betrayed you didn't reply, and is now your loudest hater.",
      choices: [
        { t: 'repair', ci: '🫶', label: 'Reach out privately, set kind boundaries', desc: 'Human, but firm about limits.',
          apply: S => { addStress(S, 3); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('🫶', "A gentle, firm DM cooled it. You can't save everyone, but you handled it with grace.", 'good'); } },
        { t: 'neutral', ci: '🚪', label: 'Quietly block and move on', desc: 'Protect your peace.',
          apply: S => fed('🚪', 'You blocked and moved on. A little noise, but your headspace is safer.', '') },
        { t: 'escalate', ci: '📸', label: 'Expose their DMs publicly', desc: 'Post the receipts to humiliate them.',
          apply: S => { if (chance(.5)) { const r = repHit(S, 8, 15); return hurt(S, '😖', `Airing a fan's private breakdown looked cruel. Rep −${r}.`, .01, .03); } const r = repHit(S, 3, 7); return hurt(S, '😐', `Some cheered, many winced. A wash that left a bad taste. Rep −${r}.`, .005, .015); } },
      ] },
    { id: 'sleepless', repeatable: true, kind: 'neutral', emoji: '🥵', title: "You haven't slept in days.", badge: 'Health', cond: S => S.stress >= 60,
      text: 'The grind is catching up. Your body is sending invoices.',
      choices: [
        { t: 'escalate', ci: '⛽', label: 'Push through it', desc: 'Keep the streak alive. Risky.',
          apply: S => { addStress(S, 12); activePlats(S).forEach(p => p.heat = clamp(p.heat + 5, 0, 100)); return fed('⛽', 'You pushed through. The feed got fed. You didn’t.', 'bad'); } },
        { t: 'repair', ci: '🛌', label: 'Log off and recover', desc: 'Reset stress, lose momentum.',
          apply: S => { addStress(S, -30); activePlats(S).forEach(p => p.heat = clamp(p.heat - 10, 0, 100)); return fed('🛌', 'You logged off for real. Stress dropped, buzz cooled.', 'good'); } },
      ] },
    // ---- cash-sink sub-deck (the balance fix) ----
    { id: 'tax-bill', kind: 'neutral', emoji: '🧾', title: 'The tax bill came due.', badge: 'Taxes', minWeek: 18, maxWeek: 36,
      text: 'Quarterly estimate. The number at the bottom is bigger than you told yourself it would be.',
      choices: [
        { t: 'repair', ci: '💳', label: 'Pay it clean', desc: 'Settle in full. Done is done.',
          apply: S => { const bill = taxBill(S); addStress(S, 4); return spend(S, '🧾', `Paid the estimate: −${money(bill)}. No letters coming.`, bill); } },
        { t: 'escalate', ci: '🧮', label: 'Get creative with it', desc: 'Write off everything. Coin flip.',
          apply: S => { const bill = taxBill(S); if (chance(.5)) { const paid = Math.round(bill * 0.5); return spend(S, '🧮', `The deductions held. Only −${money(paid)} this quarter.`, paid, ''); } const owed = Math.round(bill * 1.5); const r = repHit(S, 3, 8); addStress(S, 8); return spend(S, '📛', `Flagged for review. Back taxes and penalties: −${money(owed)}. Rep −${r}.`, owed); } },
      ] },
    { id: 'tax-year-end', kind: 'neutral', emoji: '🧾', title: 'Year-end taxes hit.', badge: 'Taxes', minWeek: 45,
      text: 'Everything you made since the last reckoning, all on one line.',
      choices: [
        { t: 'repair', ci: '💳', label: 'Pay it and move on', desc: 'Close the year clean.',
          apply: S => { const bill = taxBill(S); addStress(S, 4); return spend(S, '🧾', `Squared up for the year: −${money(bill)}.`, bill); } },
        { t: 'escalate', ci: '⏳', label: 'Set up a payment plan', desc: 'Spread it, eat the interest.',
          apply: S => { const bill = Math.round(taxBill(S) * 1.2); addStress(S, 6); return spend(S, '⏳', `On a plan now, with interest: −${money(bill)} this pass.`, bill); } },
      ] },
    { id: 'demonetization', kind: 'neutral', emoji: '🚫', title: 'Your account got demonetized.', badge: 'Strike', minWeek: 10,
      text: 'A blanket policy sweep caught you in it. The revenue dashboard just flatlined.',
      choices: [
        { t: 'repair', ci: '📩', label: 'Appeal and wait', desc: 'File it, lose the month either way.',
          apply: S => { const gap = Math.round(1200 + totalFollowers(S) * 0.04); addStress(S, 6); return spend(S, '🚫', `Ad money frozen while you appeal: −${money(gap)} this month.`, gap); } },
        { t: 'escalate', ci: '📢', label: 'Make it public and loud', desc: 'Post about it. Sympathy or noise.',
          apply: S => { const gap = Math.round(1200 + totalFollowers(S) * 0.04); if (chance(.5)) { const p = strongest(S); const ggn = Math.round(rnd(800, 2600)); p.followers += ggn; S.newFollowers += ggn; const log = spend(S, '📢', `The callout landed. Still down ${money(gap)}, but +${fmt(ggn)} showed up angry on your behalf.`, gap, ''); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(ggn), tone: 'gain' }); log.bump.push(p.key); return log; } const r = repHit(S, 2, 6); return spend(S, '📉', `Read as whining. Down ${money(gap)} and Rep −${r}.`, gap); } },
      ] },
    { id: 'gear-dies', kind: 'neutral', emoji: '🎥', title: 'Your main rig just died.', badge: 'Equipment', cond: S => S.gear >= 1 && S.gear <= 3,
      text: 'Mid-shoot, the whole setup gave up. You are not making anything good on a phone.',
      choices: [
        { t: 'repair', ci: '🛒', label: 'Replace it now', desc: 'Buy back the tier you were on.',
          apply: S => { const cost = CONFIG.gearCost[S.gear]; return spend(S, '🎥', `Bought the replacement: −${money(cost)}. Back in business.`, cost); } },
        { t: 'escalate', ci: '📵', label: 'Limp along without it', desc: 'Save the cash, lose the quality.',
          apply: S => { S.gear = Math.max(0, S.gear - 1); activePlats(S).forEach(p => p.heat = clamp(p.heat - 8, 0, 100)); return fed('📵', 'Downgraded to whatever still works. Everything looks cheaper now.', 'bad'); } },
      ] },
    { id: 'sponsor-clawback', kind: 'neutral', emoji: '💼', title: 'A past sponsor wants their money back.', badge: 'Clawback', cond: S => S.deals >= 2, minWeek: 12,
      text: 'The brand you ran got caught in its own scandal, and the contract had a morality clause pointed the wrong way.',
      choices: [
        { t: 'repair', ci: '✍️', label: 'Honor the clause', desc: 'Pay it back, keep your name clean.',
          apply: S => { const amt = Math.round(900 + totalFollowers(S) * 0.02); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return spend(S, '💼', `Refunded the fee: −${money(amt)}. The lawyers went quiet.`, amt); } },
        { t: 'escalate', ci: '⚖️', label: 'Fight it', desc: 'Refuse. Legal fees either way.',
          apply: S => { const fees = Math.round(700 + totalFollowers(S) * 0.03); const r = repHit(S, 2, 6); return spend(S, '⚖️', `Dragged it out. Legal fees anyway: −${money(fees)}. Rep −${r}.`, fees); } },
      ] },
    { id: 'surprise-expense', kind: 'neutral', emoji: '💥', title: 'Something expensive just broke.', badge: 'Life', minWeek: 6,
      text: 'Not the content. Life. The kind of bill that does not care about your posting schedule.',
      choices: [
        { t: 'repair', ci: '💸', label: 'Just handle it', desc: 'Pay and keep moving.',
          apply: S => { const amt = Math.round(600 + totalFollowers(S) * 0.015); addStress(S, 3); return spend(S, '💥', `Handled it: −${money(amt)}. Onward.`, amt); } },
        { t: 'escalate', ci: '🩹', label: 'Put it off', desc: 'Ignore it. It gets worse.',
          apply: S => { const amt = Math.round((600 + totalFollowers(S) * 0.015) * 1.6); addStress(S, 9); return spend(S, '🩹', `Let it fester. Now it is −${money(amt)} and a worse week.`, amt); } },
      ] },
  ];

  // ======================= weekly orchestration =======================
  const BAND_MSG = {
    normal:  { emoji: '😮‍💨', text: 'Stress is back under control. Good.', kind: 'good' },
    hot:     { emoji: '🌡️', text: 'Running hot. Fine for a week or two. Not a month.', kind: '' },
    fumes:   { emoji: '🥵', text: 'On fumes. Everything you make is 15% worse, and you can feel it.', kind: 'bad' },
    redline: { emoji: '🚨', text: 'Redline. Three weeks of this and it\'s over. Leave a slot empty.', kind: 'bad' },
  };
  function settleWeek(S) {
    const log = L();
    let passive = 0;
    // evergreen tails keep earning
    S.tails.forEach(t => {
      const pf = PLATFORMS[t.pkey], p = S.plats[t.pkey];
      const v = Math.round(t.views * CONFIG.tailRate), g = Math.round(v * CONFIG.baseConv * pf.loyal * ANGLES.evergreen.conv);
      p.followers += g; S.newFollowers += g; S.totalViews += v; passive += v * pf.rpm; t.weeksLeft--;
      log.feed.push({ emoji: '🌲', text: `‘${t.topic}’ is still getting found. +${fmt(v)} views this week.`, kind: '' });
    });
    S.tails = S.tails.filter(t => t.weeksLeft > 0);
    // membership: recomputed every week
    if (S.members > 0) {
      const posted = activePlats(S).some(p => p.lastPost === S.week);
      S.members = Math.max(0, Math.round(S.members + S.newFollowers * CONFIG.memberNewConv - S.members * (posted ? CONFIG.memberChurn : CONFIG.memberChurnIdle)));
      passive += S.members * CONFIG.memberRate;
    }
    const oh = overhead(S);
    const passiveR = Math.round(passive); S.cash += passiveR; S.grossEarned += passiveR;
    S.cash -= oh; S.peakOverhead = Math.max(S.peakOverhead, oh);
    // churn
    let lost = 0;
    activePlats(S).forEach(p => {
      const idle = S.week - p.lastPost >= CONFIG.idleWeeks;
      const trendLoss = Math.round(p.trendFollowers * (idle ? CONFIG.churnIdle : CONFIG.churnTrend));
      const baseLoss = Math.round((p.followers - p.trendFollowers) * (idle ? CONFIG.churnIdle : CONFIG.churnBase));
      p.trendFollowers = Math.max(0, p.trendFollowers - trendLoss);
      p.followers = Math.max(0, p.followers - trendLoss - baseLoss);
      lost += trendLoss + baseLoss;
    });
    if (lost > totalFollowers(S) * 0.01) log.feed.push({ emoji: '👋', text: `${fmt(lost)} people left this week. Trend-chasers go first; silence pushes out the rest.`, kind: 'bad' });
    // heat / fatigue decay
    PORDER.forEach(k => { const p = S.plats[k]; p.heat = clamp(Math.round(p.heat * 0.82) - 2, 0, 100); if (p.lastPost < S.week) p.fatigue = clamp(p.fatigue - 14, 0, 100); });
    // stress: judge the band + burnout streak on the stress you ended the week's work at,
    // THEN recover. (Judging after recovery would make redline unreachable: 100 - 12 < 90.)
    const band = stressBand(S);
    if (band !== S.band) { log.feed.push({ ...BAND_MSG[band] }); S.band = band; }
    S.redlineStreak = band === 'redline' ? S.redlineStreak + 1 : 0;
    addStress(S, -(CONFIG.stressRecover + S.slots.content * CONFIG.stressRecoverPerEmptySlot));
    S.newFollowers = 0;
    return log;
  }
  function drawEvent(S) {
    const deck = EVENTS.filter(e =>
         (!e.cond || e.cond(S))
      && (e.minWeek == null || S.week >= e.minWeek)
      && (e.maxWeek == null || S.week <= e.maxWeek)
      && (e.repeatable || !S.seenEvents.includes(e.id)));
    return deck.length ? pick(deck) : null;
  }
  function rollEvent(S) {
    if (!(S.week >= 2 && chance(CONFIG.eventChance))) return null;
    const ev = drawEvent(S);
    if (ev && !ev.repeatable && !S.seenEvents.includes(ev.id)) S.seenEvents.push(ev.id);
    return ev;
  }
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
    cancelled: { emoji: '📛', kicker: 'Cancelled', title: 'The internet turned on you.', blurb: 'Reputation hit zero. Sponsors ghosted, fans left, and your name is trending for all the wrong reasons.', lesson: 'Followers came fast. Trust left faster. Nobody screenshots the apology.' },
    bankrupt: { emoji: '💸', kicker: 'Broke', title: 'You ran out of runway.', blurb: "The overdraft won. Overhead doesn't care how good last week's video was. You got a day job.", lesson: "An audience isn't an income. Reach pays rent the day somebody chooses to pay you." },
    burnout: { emoji: '🕯️', kicker: 'Burnout', title: 'You burned all the way out.', blurb: 'The stress redlined and stayed there. Feeding {n} platform{s} at once, you stopped being able to make anything at all.', lesson: 'You can feed every platform, or you can last. The ones still here took the week off.' },
    sellout: { emoji: '🤑', kicker: 'Sold out', title: 'You became an ad in human form.', blurb: 'The bag got too tempting, too often. Rich and technically famous, but nobody remembers what you actually make.', lesson: 'Every deal was a withdrawal from trust. You overdrew, and the only product left was you.' },
    star: { emoji: '🌟', kicker: 'Viral star', title: 'You went fully mainstream.', blurb: '{star}-plus and climbing across platforms. Brands, press, maybe a Netflix producer in your DMs.', lesson: 'You did the work, then the algorithm did you a favor. Talent loads the dice. Luck rolls them.' },
    goat: { emoji: '👑', kicker: 'G.O.A.T.', title: 'Biggest creator on the planet.', blurb: '{goat}-plus followers and a footprint on every surface. You didn\'t win the game. You became it.', lesson: 'Stamina, taste, and an absurd amount of luck. Almost nobody gets here. Run it again and watch it not happen.' },
    legend: { emoji: '🏆', kicker: 'Niche legend', title: 'You built something that lasts.', blurb: "Not the biggest. Beloved, paid, and still sleeping at night. A loyal audience and a life you didn't have to torch to keep it.", lesson: "This is the good ending. It just doesn't trend." },
    faded: { emoji: '🌫️', kicker: 'Faded out', title: 'You slowly faded into the feed.', blurb: 'A year in, the numbers never took off. Not a disaster, not a triumph. The algorithm just stopped mentioning you.', lesson: 'This is the ending most people get. Nobody writes about it, which is the whole point.' },
  };

  // Ending copy with the run's numbers filled in.
  function endingText(S, key) { const e = ENDINGS[key]; const n = activePlats(S).length; return Object.assign({}, e, { blurb: e.blurb.replace('{n}', n).replace('{s}', n === 1 ? '' : 's').replace('{star}', fmt(CONFIG.starAt)).replace('{goat}', fmt(CONFIG.goatAt)) }); }

  return {
    CONFIG, NICHES, PLATFORMS, PORDER, TIERS, TIERCUT, ANGLES, AORDER, TOPICS, HIRES, HORDER, ENDINGS, EVENTS,
    setRng, rnd, rint, clamp, chance, pick, fmt, money,
    newState, activePlats, totalFollowers, strongest, platTier,
    useSlot, addStress, stressBand, hasStudio, hireCount, hireCap, payroll, overhead, overheadBreakdown, hireInfo,
    viewsMult, stressCost, upgradeInfo, repHit, loseFollowers,
    pickTopic, buildHand, applyMove, doPost, startPlatform, crosspost, biz,
    settleWeek, drawEvent, rollEvent, applyEventChoice, advanceWeek, checkEndings, endingText,
  };
});
