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
    // A solo creator ships 2 content + 1 business a week. The Studio (tier 4) is
    // the "you're an operation now" tier — a real space + room for a full team —
    // so it also buys a 3rd content slot: the team finally raises throughput, not
    // just quality. Kept to 3 (not more) so the forced "which posts?" scarcity —
    // the whole point of the game — survives.
    slotsContent: 2, slotsBusiness: 1,   // studio tiers set content capacity (STUDIOS.slots)
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
    overheadBase: 60, overheadPerPlatform: 10,   // studio lease comes from STUDIOS[tier].lease
    // lifestyle creep: living cost steps up with PEAK followers and never steps back down.
    // A recurring late sink that scales with exactly the players who hoard. [[peakFollowers, $/wk], ...]
    livingSteps: [[15000, 150], [25000, 400], [50000, 800], [100000, 1500]],
    // post math
    viewsK: 70, baseConv: 0.02, sizeSat: 55000, sizeMax: 6,   // viewsK 160→70 when cadence fatigue was removed (it had been scaling views ×0.3–0.5 for focused players)
    // churn
    // Silence compounds. An idle platform (idleWeeks+ without a post) churns churnIdle flat — so
    // spreading across platforms stays viable — but once the WHOLE account has been silent that long,
    // every further silent week adds churnIdleRamp, capped at churnIdleCap: weeks 3/4/5/6/7+ of
    // posting nothing anywhere → 2/4.5/7/9.5/12% on every platform.
    churnBase: 0.006, churnTrend: 0.012, churnIdle: 0.02, idleWeeks: 3, churnIdleRamp: 0.025, churnIdleCap: 0.12,
    // evergreen tail
    tailWeeks: 4, tailRate: 0.15,
    topicCooldown: 8,
    // Cadence is NOT punished (real-world data: more posting = more reach, consistency beats bursts).
    // What is: (a) a second post on the same platform in the same week competes with the first,
    // (b) repeating the same ANGLE on a platform tires the audience (the literature's actual cause),
    // (c) Newsletter is the one platform where over-sending measurably loses subscribers.
    sameWeekDilution: 0.8,
    // cross-posting: once a week, no slot, half the lift a real post would give the destination
    crossLift: [0.01, 0.03], crossHeat: 6, crossStress: 2,                                   // views × this per extra post on the platform that week
    repeatAngleGain: 20, repeatAngleRelief: 20, repeatDecay: 8, tiredAt: 52, tiredViewsMult: 0.7,
    newsletterOverSendChurn: 0.03, newsletterOverSendMemberChurn: 0.04,
    // money
    bankruptFloor: -2500,
    dealBase: 150, dealScale: 0.018, dealRepBase: 0.6,
    paidUnlock: 1500, memberRate: 4, memberConvMin: 0.02, memberConvMax: 0.045,
    memberNewConv: 0.025, memberChurn: 0.04, memberChurnIdle: 0.12,
    // gear: tiers 1-3 are kit (+10% views each, compounding); tiers 4-6 are studios (STUDIOS below).
    gearCost: [0, 350, 800, 1700, 3000, 12000, 35000], gearViewsMult: 1.10,
    // A studio is a commitment, not a reward: no follower gate. What gates it is money — the deposit plus
    // studioRunwayWeeks of the NEW weekly overhead in the bank (the landlord's guarantee).
    studioRunwayWeeks: 3,
    hireCapBase: 2,
    // endings
    goatAt: 340000, starAt: 70000, legendAt: 37000, legendRep: 55,   // goatAt 320K→340K when cross-posting stopped costing a slot (+~10% Optimizer output)
    sellDeals: 6, sellRepUnder: 45, sellCashOver: 1800,
    eventChance: 0.55,
    // event deck: phase bands (weeks) + tax rate on gross earned since last tax event
    phases: { earlyEnd: 17, midEnd: 35 }, // early 2–17 · mid 18–35 · late 36–52
    taxRate: 0.35,
    years: 52,
    exitWeek: 46,
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
    producer: { label: 'Producer',      emoji: '🎬', sign: 900, weekly: 160, blurb: 'Runs the back catalogue. Evergreen posts keep earning two weeks longer.' },
    analyst:  { label: 'Analyst',       emoji: '📊', sign: 1000, weekly: 180, blurb: 'Reads the numbers so you don’t have to. Heat fades slower.' },
  };
  const HORDER = ['editor', 'manager', 'mod', 'designer', 'producer', 'analyst'];
  // Studios: sequential steps after the kit (gear 4/5/6). views multiplies ON TOP of the kit's ×1.33.
  // slots is weekly content capacity (capped at 3 — the scarcity is the game), cap is team size.
  const STUDIOS = {
    4: { key: 'room',     name: 'The spare room', lease: 600,  views: 1.5, slots: 2, cap: 3, stress: 3,
         blurb: 'A door that closes, a light that isn’t the window, a rent that isn’t nothing.' },
    5: { key: 'lease',    name: 'The lease',      lease: 3000, views: 2.3, slots: 3, cap: 4, stress: 6,
         blurb: 'A real space. A third post every week, room for a team, and a landlord who wants it monthly.' },
    6: { key: 'building', name: 'The building',   lease: 8000, views: 3.3, slots: 3, cap: 6, stress: 10,
         blurb: 'Your name on the door and a fixed cost that does not care what kind of month you had.' },
  };
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
  // Hand-authored thumbnail "big words" per topic line (index-aligned with TOPICS), so the fake
  // YouTube thumbnail reads like a real one instead of the first 2–3 words of the title truncated
  // to nonsense. Fix 8. Keep each punchy (≤3 words) and quote-free; the chrome uppercases them.
  const THUMBS = {
    gaming: {
      trend:     ['THE PATCH', 'SHOWCASE RANKED', 'RECORD BROKEN', 'DYING GAME', 'CURSED CLIP'],
      evergreen: ['SPEEDRUN 101', 'FIX YOUR SETTINGS', 'HOW MMR WORKS', 'SLEPT-ON GAMES', 'EASY WIN BUILD'],
      personal:  ['I ALMOST QUIT', '1,000 HOURS', 'MY REAL SETUP', 'ONE DM', 'I GOT BANNED'],
    },
    beauty: {
      trend:     ['$9 DUPE', 'VIRAL ROUTINE', 'CANCELLED?', 'ANGRY LAUNCH', '5-MIN CLEAN GIRL'],
      evergreen: ['SKINCARE BASICS', 'MATCH YOUR SHADE', 'IN MY BAG', '10-MIN FACE', 'READ THE LABEL'],
      personal:  ['NO MORE HIDING', 'I SAID NO', 'GRWM BAD DAY', '30 VS 20', 'ONE COMMENT'],
    },
    edu: {
      trend:     ['STAT IS WRONG', 'GOT IT WRONG', 'THE STUDY', '40M DEBUNKED', 'THE EXAM'],
      evergreen: ['COMPOUND INTEREST', 'EVERY FALLACY', 'LEARN IN 20 HRS', 'HIDDEN HISTORY', 'THE INTERNET'],
      personal:  ['I FAILED OUT', '10 YEARS TEACHING', 'NO ANSWER', 'MY REAL ROUTINE', 'I LEFT ACADEMIA'],
    },
    comedy: {
      trend:     ['REPLY GUYS RANKED', 'THE TREND, WRONG', 'WORST TAKE', 'THE GROUP CHAT', 'ALGORITHM IRL'],
      evergreen: ['AIRPORT PEOPLE', 'JUST LOOKING', 'FAMILY DINNER', 'BAD HAIRCUT', 'LOSE THE ARGUMENT'],
      personal:  ['I BOMBED', 'NO CROWD WORK', 'MY WORST DM', 'GETTING SOBER', 'WHAT MOM THINKS'],
    },
    fitness: {
      trend:     ['75 DAYS', 'THIS WILL HURT', 'CELEB ROUTINE', 'THE SUPPLEMENT', 'TRENDING DIET'],
      evergreen: ['GYM 101', '5 LIFTS, WRONG', 'BUILD THE HABIT', 'EAT ENOUGH', 'HOME WORKOUT'],
      personal:  ['THE INJURY', 'WHAT I EAT', 'DELETED MY PROGRESS', 'TRAINING THROUGH IT', 'ONE DM'],
    },
    music: {
      trend:     ['THAT SONG', 'TRENDING SOUND', 'AWARD SHOW', 'THIS SAMPLE', 'MEME REMIX'],
      evergreen: ['THEORY IN 15', 'HOW HITS WORK', '4 CHORDS', 'MIX CHEAP', 'GEAR YOU NEED'],
      personal:  ['THE LABEL EMAIL', 'NO MORE PLAYLISTS', '5 YEARS LATER', 'STAGE FRIGHT', 'SONG FOR MY DAD'],
    },
  };
  // The authored thumbnail words for a dealt card's topic line, or null to fall back to truncation.
  function thumbFor(niche, angleKey, topic) {
    const titles = TOPICS[niche] && TOPICS[niche][angleKey];
    const thumbs = THUMBS[niche] && THUMBS[niche][angleKey];
    if (!titles || !thumbs) return null;
    const i = titles.indexOf(topic);
    return i >= 0 && thumbs[i] ? thumbs[i] : null;
  }

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
      seenEvents: [], flags: {}, grossEarned: 0, taxedThrough: 0, peakFollowers: 0, crossUsed: false,
      lastHit: null, over: false, endKey: null, plats: {}, hand: [],
    };
    PORDER.forEach(k => { S.plats[k] = { key: k, followers: 0, trendFollowers: 0, heat: 0, fatigue: 0, posts: 0, active: false, proven: false, lastPost: -9, lastAngle: null, weekPosts: 0 }; });
    S.plats[home].active = true;
    S.plats[home].followers = 40;
    return S;
  }
  const activePlats = S => PORDER.map(k => S.plats[k]).filter(p => p.active);
  // Weeks since this platform last posted (a never-posted platform counts from week 1).
  const silentWeeks = (S, p) => p.lastPost < 0 ? S.week - 1 : S.week - p.lastPost;
  // Weeks since the creator posted anywhere at all.
  const silentWeeksAll = S => Math.min(...activePlats(S).map(p => silentWeeks(S, p)));
  // Weekly churn rate an idle platform pays this week; 0 when it isn't idle. Flat per platform,
  // ramping only with account-wide silence (see CONFIG churn note).
  function idleChurnRate(S, p) {
    if (silentWeeks(S, p) < CONFIG.idleWeeks) return 0;
    const all = silentWeeksAll(S);
    return Math.min(CONFIG.churnIdleCap, CONFIG.churnIdle + CONFIG.churnIdleRamp * Math.max(0, all - CONFIG.idleWeeks));
  }
  const totalFollowers = S => PORDER.reduce((s, k) => s + S.plats[k].followers, 0);
  const strongest = S => activePlats(S).sort((a, b) => b.followers - a.followers)[0];
  // Tier is cosmetic polish on the channel card: posts + gear.
  function platPolish(S, p) { return p.posts * 3 + S.gear * 9; }   // what tiers are cut on (TIERCUT)
  function platTier(S, p) { const pol = platPolish(S, p); let t = 0; for (let i = 0; i < TIERCUT.length; i++) if (pol >= TIERCUT[i]) t = i; return t; }

  // Acts: the run's three chapters, cut on the phase boundaries that already exist.
  // 1 "Nobody's watching" (≤earlyEnd) · 2 "The business" (≤midEnd) · 3 "The ceiling".
  const ACTS = { 1: 'Nobody’s watching', 2: 'The business', 3: 'The ceiling' };
  function act(S) { const p = CONFIG.phases; return S.week <= p.earlyEnd ? 1 : S.week <= p.midEnd ? 2 : 3; }

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
  const studio = S => STUDIOS[S.gear] || null;
  const hasStudio = S => S.gear >= 4;
  // Weekly content capacity comes from the studio tier (2 without one; the lease and the building give 3).
  const contentSlots = S => { const st = studio(S); return st ? st.slots : CONFIG.slotsContent; };
  const hireCount = S => HORDER.filter(k => S.hires[k]).length;
  const hireCap = S => { const st = studio(S); return st ? st.cap : CONFIG.hireCapBase; };
  const payroll = S => HORDER.reduce((s, k) => s + (S.hires[k] ? HIRES[k].weekly : 0), 0);
  // lifestyle creep: which step of CONFIG.livingSteps the run has reached (0 = base), and the $/wk it costs
  function livingStep(S) { let i = 0; CONFIG.livingSteps.forEach((st, k) => { if ((S.peakFollowers || 0) >= st[0]) i = k + 1; }); return i; }
  const livingCost = S => { const i = livingStep(S); return i ? CONFIG.livingSteps[i - 1][1] : CONFIG.overheadBase; };
  // tax accrued since the last tax event — what the next bill would be today (read-only; taxBill settles it)
  const taxOwed = S => Math.round(Math.max(0, S.grossEarned - S.taxedThrough) * CONFIG.taxRate);
  function overheadBreakdown(S) {
    const st = studio(S);
    const b = { base: livingCost(S), livingStep: livingStep(S), platforms: activePlats(S).length * CONFIG.overheadPerPlatform, payroll: payroll(S), lease: st ? st.lease : 0 };
    b.total = b.base + b.platforms + b.payroll + b.lease; return b;
  }
  const overhead = S => overheadBreakdown(S).total;
  function hireInfo(S, role) {
    const h = HIRES[role];
    if (S.hires[role]) return { ok: false, reason: 'Already on the team.' };
    if (hireCount(S) >= hireCap(S)) return { ok: false, reason: S.gear >= 6 ? 'Team is full.' : 'No room. A bigger space holds more people.' };
    if (S.cash < h.sign) return { ok: false, reason: 'Signing costs ' + money(h.sign) + '.' };
    if (S.slots.business <= 0) return { ok: false, reason: 'No business slot left this week.' };
    return { ok: true, reason: '' };
  }

  // --- multipliers: every hire/gear/stress effect on output lives here ---
  function viewsMult(S, pkey) {
    let m = Math.pow(CONFIG.gearViewsMult, Math.min(S.gear, 3));
    const st = studio(S); if (st) m *= st.views;
    if (S.hires.designer) m *= 1.15;
    if (S.hires.editor && (pkey === 'longform' || pkey === 'live')) m *= 1.05;
    const band = stressBand(S); if (band === 'fumes' || band === 'redline') m *= CONFIG.fumesViewsMult;
    return m;
  }
  function stressCost(S, pkey, angleKey) {
    let c = PLATFORMS[pkey].stress + (ANGLES[angleKey] ? ANGLES[angleKey].stress : 0);
    if (S.hires.editor && (pkey === 'longform' || pkey === 'live')) c -= 8;
    const st = studio(S); if (st) c -= st.stress;
    return Math.max(1, c);
  }
  // Weekly overhead as it WOULD be at studio tier g (used for the runway gate and the UI's affordability read).
  function overheadAt(S, g) { const st = STUDIOS[g]; return livingCost(S) + activePlats(S).length * CONFIG.overheadPerPlatform + payroll(S) + (st ? st.lease : 0); }
  function upgradeInfo(S) {
    const nx = S.gear + 1;
    if (nx > 6) return { next: null, cost: 0, ok: false, reason: 'Full rig, the building, your name on the door. Nothing left to buy.' };
    const cost = CONFIG.gearCost[nx], st = STUDIOS[nx] || null;
    // a studio needs the deposit plus a few weeks of the new overhead in the bank — the landlord's guarantee
    const runway = st ? CONFIG.studioRunwayWeeks * overheadAt(S, nx) : 0, need = cost + runway;
    const info = { next: nx, cost, studio: st, runway, need, weeklyAfter: st ? overheadAt(S, nx) : overheadAt(S, S.gear), ok: false, reason: '' };
    if (S.cash < need) { info.reason = st ? `${money(cost)} down plus ${CONFIG.studioRunwayWeeks} weeks of the new overhead (${money(runway)}) in the bank. You have ${money(S.cash)}.` : 'Costs ' + money(cost) + '.'; return info; }
    if (S.slots.business <= 0) { info.reason = 'No business slot left this week.'; return info; }
    info.ok = true; return info;
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

  // Read-only "what will this post do" preview for the card UI. No mutation, no RNG.
  // Mirrors doPost's view math with the two random inputs pinned to their extremes —
  // q ∈ [26,40] (22 + rnd(4,18)) and luck ∈ [0.55,1.6) — so the range is the honest
  // spread of a single post. Everything else (heat, size, gear, mod, dilution) is
  // deterministic and read straight off state, so this can never drift from doPost.
  function previewPost(S, card) {
    if (!card || (card.kind !== 'post' && card.kind !== 'ride')) return null;
    const p = S.plats[card.pkey], pf = PLATFORMS[card.pkey], A = ANGLES[card.angle];
    if (!p || !pf || !A) return null;
    const heatF = 1 + p.heat / 45;
    const sizeF = 1 + CONFIG.sizeMax * p.followers / (p.followers + CONFIG.sizeSat);
    const det = heatF * sizeF * pf.viral * NICHES[S.niche].viral * A.views * (card.mod ?? 1)
              * Math.pow(CONFIG.sameWeekDilution, p.weekPosts) * CONFIG.viewsK * viewsMult(S, card.pkey);
    const viewsLo = Math.max(1, Math.round(26 * det * 0.55));
    const viewsHi = Math.max(1, Math.round(40 * det * 1.6));
    const conv = CONFIG.baseConv * pf.loyal * A.conv;
    return { viewsLo, viewsHi, followersLo: Math.round(viewsLo * conv), followersHi: Math.round(viewsHi * conv) };
  }

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
    const tired = p.fatigue >= CONFIG.tiredAt && angleKey === p.lastAngle;   // the audience is tired of THIS angle, not of you
    if (p.proven && p.fatigue < CONFIG.tiredAt) mod *= 1.12;
    if (tired) mod *= CONFIG.tiredViewsMult;
    if (ride) mod *= 1.6;
    // keep the topic the player already saw this week for this platform+angle — unless they just posted it
    const usedNow = new Set(S.usedTopics.filter(u => u.week === S.week).map(u => u.topic));
    const prev = (S.hand || []).find(c => c.pkey === p.key && c.angle === angleKey && c.topic && !usedNow.has(c.topic));
    return { kind: ride ? 'ride' : 'post', pkey: p.key, angle: angleKey, topic: prev ? prev.topic : pickTopic(S, angleKey),
             mod, stress: stressCost(S, p.key, angleKey), special: !!ride, ride: !!ride, heat: p.heat, fatigue: p.fatigue, tired, proven: p.proven };
  }
  function buildHand(S) {
    const hand = [], act = activePlats(S);
    act.forEach(p => {
      const ride = !!(S.lastHit && S.lastHit.key === p.key && S.week - S.lastHit.week <= 1);
      let angle = 'evergreen';
      if (ride || p.heat >= 40) angle = 'trend';
      hand.push(postCard(S, p, angle, ride));
    });
    // The strongest platform is where the "which angle?" choice lives. Fix 5: on a single platform the
    // hand used to equal the slots (post everything, no choice), so deal all three angles there — the
    // focused creator now picks 2 of 3 from week 1, and Personal (its +rep / oversharing trade) is on
    // offer, where it used to appear only at rep < 50. With 2+ platforms the choice already exists, so
    // keep the lighter "+1 alt angle on the strongest" so multi-platform balance is unchanged.
    const top = strongest(S);
    if (top && act.length === 1) {
      const have = new Set(hand.filter(c => c.pkey === top.key).map(c => c.angle));
      AORDER.forEach(a => { if (!have.has(a)) hand.push(postCard(S, top, a, false)); });
    } else if (top && hand.length <= 3) {
      const c0 = hand.find(c => c.pkey === top.key);
      hand.push(postCard(S, top, c0.angle === 'trend' ? 'evergreen' : 'trend', false));
    }
    // Expansion: one card, the player chooses which platform (options = every inactive platform whose
    // follower threshold is met). pkey is filled in by the chooser; applyMove falls back to options[0].
    const openable = PORDER.filter(k => !S.plats[k].active && totalFollowers(S) >= PLATFORMS[k].unlock);
    if (openable.length) hand.push({ kind: 'start', pkey: null, options: openable, special: true, stress: 8 });
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
                  * Math.pow(CONFIG.sameWeekDilution, p.weekPosts) * luck * CONFIG.viewsK * viewsMult(S, k)));
    const gain = Math.round(views * CONFIG.baseConv * pf.loyal * A.conv);
    const rev = Math.round(views * pf.rpm);
    p.followers += gain; if (A.cohort) p.trendFollowers += gain;
    S.newFollowers += gain; S.totalViews += views; S.cash += rev; S.grossEarned += rev;
    p.posts++; p.lastPost = S.week; p.weekPosts++;
    // repetition meter: same angle again on this platform builds it, switching angles relieves it
    const tiredBefore = p.fatigue >= CONFIG.tiredAt;
    p.fatigue = clamp(p.fatigue + (angleKey === p.lastAngle ? CONFIG.repeatAngleGain : -CONFIG.repeatAngleRelief), 0, 100);
    const nowTired = !tiredBefore && p.fatigue >= CONFIG.tiredAt; p.lastAngle = angleKey;
    const hit = luck > 1.12;
    p.heat = clamp(p.heat + (hit ? rint(A.heatHit[0], A.heatHit[1]) : -rint(0, 3)), 0, 100);
    if (hit) { p.proven = true; S.lastHit = { key: k, week: S.week }; }
    if (A.rep) S.rep = clamp(S.rep + rint(A.rep[0], A.rep[1]), 0, 100);
    let repHit = 0;
    if (A.badChance && chance(A.badChance)) { repHit = rint(A.badRep[0], A.badRep[1]); S.rep = clamp(S.rep - repHit, 0, 100); }
    if (A.tail) S.tails.push({ pkey: k, topic, views, weeksLeft: CONFIG.tailWeeks + (S.hires.producer ? 2 : 0) });
    S.usedTopics.push({ topic, week: S.week });

    const log = L();
    log.floats.push({ anchor: 'plat:' + k, text: '+' + fmt(gain), tone: hit ? 'hit' : 'gain' });
    if (rev > 0) log.floats.push({ anchor: 'cash', text: '+' + money(rev), tone: 'cash' });
    log.feed.push({ emoji: pf.emoji, text: `‘${topic}’ did ${fmt(views)} views on ${pf.name}. +${fmt(gain)} followers${rev > 0 ? ', +' + money(rev) : ''}.${hit ? ' It took off.' : ''}`, kind: hit ? 'good' : '' });
    if (hit) log.feed.push({ emoji: '🔥', text: `${pf.name} is hot. Heat has a shelf life of about a week.`, kind: 'big' });
    if (repHit) { log.floats.push({ anchor: 'rep', text: '-' + repHit, tone: 'loss' }); log.feed.push({ emoji: '😬', text: `‘${topic}’ ${A.bad} Rep −${repHit}.`, kind: 'bad' }); }
    log.bump.push(k);
    if (platTier(S, p) > before) log.feed.push({ emoji: '📈', text: `${pf.name} is ${TIERS[platTier(S, p)]} tier now. The channel looks like it belongs to someone with a plan.`, kind: 'good' });
    if (nowTired) log.feed.push({ emoji: '🥱', text: `Another ${A.label.toLowerCase()} post on ${pf.name}. The regulars can see the pattern, and they're starting to skip it.`, kind: 'bad' });
    return log;
  }
  function startPlatform(S, k) {
    const p = S.plats[k], pf = PLATFORMS[k];
    p.active = true; p.followers = Math.round(totalFollowers(S) * 0.02 + 20); p.lastPost = S.week; p.posts = 1;
    const log = L(); log.bump.push(k);
    log.feed.push({ emoji: '✨', text: `${pf.name} is live. Current audience: you, refreshing.`, kind: 'good' });
    return log;
  }
  // Cross-posting is repackaging something you already posted this week for another channel you run.
  // It costs no content slot (once a week, +crossStress), moves a smaller slice of the source audience
  // than a real post would earn, warms the destination a little, and resets its idle clock.
  function crossOptions(S) {
    if (S.crossUsed) return [];
    const act = activePlats(S), out = [];
    act.filter(p => p.lastPost === S.week && p.posts > 0).forEach(src => act.forEach(dst => { if (dst.key !== src.key) out.push({ src: src.key, dst: dst.key }); }));
    return out;
  }
  function crosspost(S, sk, dk) {
    if (!crossOptions(S).some(o => o.src === sk && o.dst === dk)) return L();
    const src = S.plats[sk], dst = S.plats[dk];
    S.crossUsed = true; addStress(S, CONFIG.crossStress);
    const moved = Math.round(src.followers * rnd(CONFIG.crossLift[0], CONFIG.crossLift[1]) * (1 + src.heat / 100));
    dst.followers += moved; dst.heat = clamp(dst.heat + CONFIG.crossHeat, 0, 100); dst.lastPost = S.week;
    S.newFollowers += moved;
    const log = L(); log.bump.push(dk);
    log.floats.push({ anchor: 'plat:' + dk, text: '+' + fmt(moved), tone: 'gain' });
    log.feed.push({ emoji: '🔗', text: `Cross-posted to ${PLATFORMS[dk].name}. ${fmt(moved)} of them followed you over. The rest don’t do new apps.`, kind: 'good' });
    return log;
  }
  function applyMove(S, m) {
    if (!useSlot(S, 'content')) return L();
    addStress(S, m.stress);
    if (m.kind === 'start') { const k = m.pkey && m.options && m.options.includes(m.pkey) ? m.pkey : (m.options || [m.pkey])[0]; return startPlatform(S, k); }
    return doPost(S, m.pkey, m.angle, m.topic, m.mod);
  }

  // ======================= business actions (one per week) =======================
  const biz = {
    engage(S) { if (!useSlot(S, 'business')) return L(); addStress(S, CONFIG.engageStress); const r = rnd(2, 5); S.rep = clamp(S.rep + r, 0, 100); activePlats(S).forEach(p => p.heat = clamp(p.heat + rint(1, 4), 0, 100));
      const log = L(); log.floats.push({ anchor: 'rep', text: '+' + r.toFixed(1), tone: 'up' });
      log.feed.push({ emoji: '💬', text: 'Spent the week in the comments. The regulars noticed. The regulars always notice.', kind: 'good' }); return log; },
    deal(S) { if (totalFollowers(S) < 1000 || !useSlot(S, 'business')) return L(); addStress(S, CONFIG.dealStress);
      const repMult = CONFIG.dealRepBase + S.rep / 100, mgr = S.hires.manager;
      const pay = Math.round((CONFIG.dealBase + totalFollowers(S) * CONFIG.dealScale) * NICHES[S.niche].deal * repMult * (mgr ? 1.3 : 1));
      const h = rnd(4, 9) * (mgr ? 0.6 : 1);
      S.cash += pay; S.grossEarned += pay; S.rep = clamp(S.rep - h, 0, 100); S.deals++;
      const log = L(); log.floats.push({ anchor: 'cash', text: '+' + money(pay), tone: 'cash' }); log.floats.push({ anchor: 'rep', text: '-' + h.toFixed(0), tone: 'loss' });
      log.feed.push({ emoji: '🤝', text: `Ran a sponsored segment for ${money(pay)}${mgr ? '; your manager did the talking' : ''}. You said “link in bio” like you meant it. A few fans noticed you didn’t.`, kind: '' }); return log; },
    upgrade(S) { const u = upgradeInfo(S); if (!u.ok || !useSlot(S, 'business')) return L();
      S.cash -= u.cost; S.gear = u.next;
      const log = L(); log.floats.push({ anchor: 'cash', text: '-' + money(u.cost), tone: 'loss' }); log.bump = PORDER.slice();
      const st = STUDIOS[u.next];
      if (u.next === 4) log.feed.push({ emoji: '🚪', text: `You signed for the spare room. A door that closes and ${money(st.lease)} a week that doesn’t. This is you deciding it’s the job.`, kind: 'big' });
      else if (u.next === 5) log.feed.push({ emoji: '🏢', text: `You signed the lease. Every post gets bigger, and you can ship a third thing every week now. Every week also costs ${money(st.lease)} more. No pressure.`, kind: 'big' });
      else if (u.next === 6) log.feed.push({ emoji: '🏗️', text: `You signed for the building. Your name is on the door and ${money(st.lease)} a week is on the calendar, whatever kind of month it is.`, kind: 'big' });
      else log.feed.push({ emoji: '🛠️', text: `New kit, tier ${u.next}. Your videos look more expensive. So does your bank statement.`, kind: 'good' });
      return log; },
    paid(S) { if (S.members > 0 || totalFollowers(S) < CONFIG.paidUnlock || !useSlot(S, 'business')) return L();
      S.members = Math.round(totalFollowers(S) * rnd(CONFIG.memberConvMin, CONFIG.memberConvMax));
      const log = L(); log.feed.push({ emoji: '⭐', text: `Membership is live. ${fmt(S.members)} people are paying you every month now. They will notice the week you skip.`, kind: 'good' }); return log; },
    hire(S, role) { const h = HIRES[role]; if (!h || !hireInfo(S, role).ok || !useSlot(S, 'business')) return L();
      S.cash -= h.sign; S.hires[role] = true;
      const log = L(); log.floats.push({ anchor: 'cash', text: '-' + money(h.sign), tone: 'loss' });
      log.feed.push({ emoji: h.emoji, text: `Hired a ${h.label.toLowerCase()}. Payroll is now ${money(payroll(S))}/week, due whether or not anyone watched.`, kind: 'good' }); return log; },
    fire(S, role) { const h = HIRES[role]; if (!h || !S.hires[role] || !useSlot(S, 'business')) return L();
      S.hires[role] = false;
      const log = L(); log.feed.push({ emoji: '👋', text: `Let your ${h.label.toLowerCase()} go. Payroll −${money(h.weekly)}/week. They took the good chair.`, kind: '' }); return log; },
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
  // threat sinks are capped at a fraction of cash-on-hand: they drain hoarders hard but
  // never single-handedly bankrupt a lean player (who has little cash to take).
  const bite = (S, amount, frac) => Math.round(Math.min(Math.max(0, amount), Math.max(0, S.cash) * frac));
  const taxBill = S => { const taxable = Math.max(0, S.grossEarned - S.taxedThrough); S.taxedThrough = S.grossEarned; return Math.round(taxable * CONFIG.taxRate); };
  const EVENTS = [
    { id: 'viral-moment', repeatable: true, kind: 'neutral', emoji: '🚀', title: 'A post is going viral right now.', badge: 'Momentum', cond: () => true,
      text: 'One upload is spiking with strangers. The window is open. It does not stay open.',
      choices: [
        { t: 'repair', ci: '🌊', label: 'Ride it across every platform', desc: 'Cross-promote hard. Costs stress, huge upside.', stakes: '+2K–8K followers, more at scale · heat +22 · +10 stress',
          apply: S => { const g = Math.round(rnd(2000, 8000) * (1 + totalFollowers(S) / 40000)); const p = strongest(S); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 22, 0, 100); addStress(S, 10); S.lastHit = { key: p.key, week: S.week };
            const log = fed('🚀', `You rode it. +${fmt(g)} followers, and a group chat somewhere is arguing about you.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } },
        { t: 'neutral', ci: '😌', label: 'Let it breathe', desc: 'Take the smaller bump, keep your head.', stakes: '+600–2,000 followers · heat +8 · no stress',
          apply: S => { const p = strongest(S); const g = Math.round(rnd(600, 2000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 8, 0, 100);
            const log = fed('🌊', `Didn't force it. +${fmt(g)} followers, stress intact.`, 'good'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'gain' }); log.bump.push(p.key); return log; } },
      ] },
    { id: 'algo-shift', repeatable: true, kind: 'neutral', emoji: '🔄', title: 'The platform changed its algorithm overnight.', badge: 'Platform shift', cond: () => true,
      text: 'The rules changed. The people who explain the rules for a living are guessing too.',
      choices: [
        { t: 'repair', ci: '📡', label: 'Chase the new format fast', desc: 'Adapt aggressively. Coin flip.', stakes: '55%: heat +16 everywhere · else heat −13',
          apply: S => { if (chance(.55)) { activePlats(S).forEach(p => p.heat = clamp(p.heat + 16, 0, 100)); return fed('📡', 'You cracked the new format first. Everything’s loud, and three people are already making tutorials about you.', 'big'); } activePlats(S).forEach(p => p.heat = clamp(p.heat - 13, 0, 100)); return fed('📉', 'Guessed wrong. Reach cratered. The algorithm moved on and did not leave a note.', 'bad'); } },
        { t: 'neutral', ci: '🎯', label: 'Keep doing your thing', desc: 'Stay the course.', stakes: 'heat −7 everywhere · rep +3',
          apply: S => { activePlats(S).forEach(p => p.heat = clamp(p.heat - 7, 0, 100)); S.rep = clamp(S.rep + 3, 0, 100); return fed('🎯', "Didn't chase it. Reach dipped. The loyal ones stayed, mostly out of habit.", ''); } },
      ] },
    { id: 'fan-gift', kind: 'neutral', emoji: '🎁', title: 'A fan sends $500 and a note.', badge: 'Wholesome', cond: () => true,
      text: '"Your stuff got me through a hard year." You read it three times.',
      choices: [
        { t: 'repair', ci: '💖', label: 'Shout them out', desc: 'Feature the note. The community glows.', stakes: '+$500 · rep +4–9 · −5 stress',
          apply: S => { S.cash += 500; S.rep = clamp(S.rep + rint(4, 9), 0, 100); addStress(S, -5); const log = fed('💖', 'You shared it. +$500, and the comments went soft for a day.', 'good'); log.floats.push({ anchor: 'cash', text: '+$500', tone: 'cash' }); return log; } },
        { t: 'neutral', ci: '🙏', label: 'Thank them privately', desc: 'Keep it personal.', stakes: '+$500 · rep +3',
          apply: S => { S.cash += 500; S.rep = clamp(S.rep + 3, 0, 100); const log = fed('🙏', 'A quiet thank-you. +$500 and a good night’s sleep.', 'good'); log.floats.push({ anchor: 'cash', text: '+$500', tone: 'cash' }); return log; } },
      ] },
    { id: 'crypto-dm', kind: 'neutral', emoji: '💸', title: 'A crypto brand slides into your DMs.', badge: 'Sponsor', cond: () => true,
      text: '"$$$ for one video. No disclosure needed 😉." Big bag, bad vibe.',
      choices: [
        { t: 'escalate', ci: '💰', label: 'Take the bag', desc: "Cash now. Your audience won't forget.", stakes: '+$900–2,400 · rep −12 to −22 · −1–3% of your biggest channel',
          apply: S => { const p = Math.round(rnd(900, 2400)); S.cash += p; const r = repHit(S, 12, 22); S.deals++; S.flags.soldOut = S.week; const log = hurt(S, '💸', `Cashed it: +${money(p)}. The comments have started using the word “grift”. Rep −${r}.`, .01, .03); log.floats.push({ anchor: 'cash', text: '+' + money(p), tone: 'cash' }); return log; } },
        { t: 'repair', ci: '🛡️', label: 'Decline on camera', desc: 'Fans respect the integrity.', stakes: 'rep +6–12 · no money',
          apply: S => { S.rep = clamp(S.rep + rint(6, 12), 0, 100); return fed('🛡️', 'You read the DM out on camera, emoji included. Reputation up.', 'good'); } },
      ] },
    // echo of "Take the bag" (crypto-dm): the sponsor comes back to haunt you, by name, weeks later
    { id: 'crypto-fallout', kind: 'hostile', emoji: '🪙', title: 'The crypto brand you took money from just imploded.', badge: 'Fallout',
      cond: S => S.flags.soldOut && S.week - S.flags.soldOut >= 2 && S.week - S.flags.soldOut <= 8,
      priority: S => S.flags.soldOut && S.week - S.flags.soldOut <= 8,
      text: 'The coin rug-pulled and took a lot of people\'s money. Your sponsored video is the receipt everyone is quoting back at you.',
      choices: [
        { t: 'repair', ci: '💸', label: 'Own it and refund what you were paid', desc: 'Take responsibility on camera.', stakes: 'refund your fee (capped at half your cash) · rep +2–6',
          apply: S => { const amt = bite(S, 400 + totalFollowers(S) * 0.02, 0.5); S.rep = clamp(S.rep + rint(2, 6), 0, 100); return spend(S, '🪙', `Refunded what you pocketed: −${money(amt)}. Owning it cost money and bought back a little trust.`, amt, ''); } },
        { t: 'escalate', ci: '🧨', label: 'Delete the video, say nothing', desc: 'Scrub it and hope it passes.', stakes: 'rep −7 to −13 · a small follower hit',
          apply: S => { const r = repHit(S, 7, 13); return hurt(S, '🧨', `You scrubbed the video. The screenshots outlived it, and the silence read as guilt. Rep −${r}.`, .01, .03); } },
      ] },
    // ---- hostile sub-deck: repair / neutral / escalate ----
    { id: 'troll-swarm', repeatable: true, kind: 'hostile', emoji: '👹', title: 'A troll swarm hit your comments.', badge: 'Coordinated trolling', cond: () => true,
      text: 'A pile-on is filling every thread with bad-faith garbage. Newcomers see it first.',
      choices: [
        { t: 'repair', ci: '🧹', label: 'Moderate & set boundaries', desc: 'Clean it up, pin a calm reply.', stakes: '+4 stress · rep +2–6',
          apply: S => { addStress(S, 4); S.rep = clamp(S.rep + rint(2, 6), 0, 100); return fed('🧹', 'You cleaned house and pinned one calm reply. The trolls found it boring, which was the point.', 'good'); } },
        { t: 'neutral', ci: '😐', label: "Ignore, don't feed them", desc: 'Say nothing, keep posting.', stakes: '60%: no damage · else rep −3–7 and a few followers',
          apply: S => { if (chance(.6)) return fed('😐', 'You starved the trolls. They left for someone who argues back.', ''); const r = repHit(S, 3, 7); return hurt(S, '😕', `Ignoring it let the narrative set in. Rep −${r}.`, .005, .015); } },
        { t: 'escalate', ci: '🤬', label: 'Roast them publicly', desc: 'Clap back hard. High variance.', stakes: '45%: +1.2K–5K followers, heat +16 · else rep −10–18 and −2–5% followers',
          apply: S => { S.flags.roasted = S.week; if (chance(.45)) { const p = strongest(S); const g = Math.round(rnd(1200, 5000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 16, 0, 100); const log = fed('🔥', `The roast went viral. +${fmt(g)} followers came for the show.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } const r = repHit(S, 10, 18); return hurt(S, '💀', `It read as punching down. Screenshots everywhere. Rep −${r}.`, .02, .05); } },
      ] },
    { id: 'cancel-clip', kind: 'hostile', emoji: '⚖️', title: "You're being cancelled over a misread clip.", badge: 'Cancel attempt', cond: S => S.rep > 25,
      text: 'A 12-second clip is circulating out of context. People who never watched you are furious. It\'s trending.',
      choices: [
        { t: 'repair', ci: '🎥', label: 'Post a calm clarification', desc: 'Show the full context, own any real mistake.', stakes: 'likely (certain above 50 rep): rep +3–8 · else rep −4–9 and a small follower hit',
          apply: S => { if (S.rep > 50 || chance(.7)) { S.rep = clamp(S.rep + rint(3, 8), 0, 100); return fed('✅', 'The full context defused it. Turns out the other eleven seconds mattered.', 'good'); } const r = repHit(S, 4, 9); return hurt(S, '😬', `The clarification helped some, but the clip travelled further than the context. Rep −${r}.`, .01, .02); } },
        { t: 'neutral', ci: '🤐', label: 'Go quiet and wait it out', desc: 'Let the cycle move on.', stakes: '50%: rep −2–6 · else rep −10–20, heat −10, −2–4% followers',
          apply: S => { if (chance(.5)) { repHit(S, 2, 6); return fed('🤐', 'You waited. The mob found a new target by Thursday.', ''); } const r = repHit(S, 10, 20); activePlats(S).forEach(p => p.heat = clamp(p.heat - 10, 0, 100)); return hurt(S, '📉', `Silence read as guilt. It festered. Rep −${r}.`, .02, .04); } },
        { t: 'escalate', ci: '🗯️', label: 'Deny everything, attack the accusers', desc: 'Refuse to engage in good faith.', stakes: 'rep −14 to −26 · heat −8 · −3–6% followers',
          apply: S => { const r = repHit(S, 14, 26); activePlats(S).forEach(p => p.heat = clamp(p.heat - 8, 0, 100)); return hurt(S, '🌋', `Defiance poured fuel on it. The pile-on doubled. This is how creators get cancelled for real. Rep −${r}.`, .03, .06); } },
      ] },
    { id: 'review-bomb', kind: 'hostile', emoji: '⭐', title: "You're getting review-bombed.", badge: 'Brigade', cond: S => totalFollowers(S) > 2000,
      text: 'A brigade from another community is mass-downvoting and one-star-reviewing everything you post.',
      choices: [
        { t: 'repair', ci: '📣', label: 'Rally your real community', desc: 'Ask loyal fans to drown out the noise.', stakes: '+3 stress · heat +8 · rep +1–4',
          apply: S => { addStress(S, 3); const p = strongest(S); p.heat = clamp(p.heat + 8, 0, 100); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('📣', 'Your community showed up and buried the brigade. Turns out the regulars can type too.', 'good'); } },
        { t: 'neutral', ci: '⏳', label: 'Report and wait', desc: 'Trust the platform to sort it.', stakes: '55%: platform fixes it · else heat −9 and a few followers',
          apply: S => { if (chance(.55)) return fed('⏳', 'The platform caught it and reversed it. Somebody at Trust and Safety had a good day.', ''); const p = strongest(S); p.heat = clamp(p.heat - 9, 0, 100); return hurt(S, '😑', 'The reports went into a queue. Reach took a hit while the queue did not move.', .005, .015); } },
        { t: 'escalate', ci: '🎯', label: 'Name and target their community', desc: 'Point your audience at them. Starts a war.', stakes: 'rep −8–16 · 40%: +800–3K rubberneckers · else a follower hit too',
          apply: S => { const r = repHit(S, 8, 16); if (chance(.4)) { const p = strongest(S); const g = Math.round(rnd(800, 3000)); p.followers += g; S.newFollowers += g; const log = fed('⚔️', `Started an all-out war. Messy, but +${fmt(g)} rubberneckers subscribed. Rep −${r}.`, 'bad'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } return hurt(S, '🔥', `The feud spiralled. Both sides look bad; you look worse. Rep −${r}.`, .02, .04); } },
      ] },
    { id: 'receipts', kind: 'hostile', emoji: '🕵️', title: 'A "receipts" account is digging through your old posts.', badge: 'Callout', cond: S => S.week > 8,
      priority: S => S.flags.roasted && S.week - S.flags.roasted <= 8,   // echo: a public roast makes the receipts thread come for you sooner
      text: 'Someone is building a thread of your worst old takes, screenshotting everything from years ago.',
      choices: [
        { t: 'repair', ci: '🌱', label: 'Get ahead of it. Address the old stuff', desc: 'Acknowledge growth, delete nothing quietly.', stakes: 'rep +2–7',
          apply: S => { S.rep = clamp(S.rep + rint(2, 7), 0, 100); return fed('🌱', 'You addressed the old posts before the thread could. Mature move. Mostly respected, quietly screenshotted anyway.', 'good'); } },
        { t: 'neutral', ci: '😶', label: "Don't dignify it", desc: 'Keep posting like nothing happened.', stakes: '50%: it blows over · else rep −5–11 and a follower hit',
          apply: S => { if (chance(.5)) return fed('😶', 'The thread got some traction, then the poster got bored. No real damage.', ''); const r = repHit(S, 5, 11); return hurt(S, '🗂️', `The receipts thread stuck around and got quoted. Rep −${r}.`, .01, .02); } },
        { t: 'escalate', ci: '🚫', label: "Mass-delete and deny it's you", desc: 'Scrub everything, gaslight the thread.', stakes: 'rep −12 to −22 · −2–5% followers',
          apply: S => { const r = repHit(S, 12, 22); return hurt(S, '🧨', `People screenshot faster than you can delete. The cover-up became the story. Rep −${r}.`, .02, .05); } },
      ] },
    { id: 'parasocial', kind: 'hostile', emoji: '💔', title: 'A parasocial superfan turned on you.', badge: 'Parasocial', cond: S => totalFollowers(S) > 4000,
      text: "A former top supporter feels personally betrayed you didn't reply, and is now your loudest hater.",
      choices: [
        { t: 'repair', ci: '🫶', label: 'Reach out privately, set kind boundaries', desc: 'Human, but firm about limits.', stakes: '+3 stress · rep +1–4',
          apply: S => { addStress(S, 3); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('🫶', "A kind, firm DM cooled it. They still think you owed them a reply. You didn't.", 'good'); } },
        { t: 'neutral', ci: '🚪', label: 'Quietly block and move on', desc: 'Protect your peace.', stakes: 'no cost, no gain',
          apply: S => fed('🚪', 'Blocked. They posted about it twice and then found a new favourite.', '') },
        { t: 'escalate', ci: '📸', label: 'Expose their DMs publicly', desc: 'Post the receipts to humiliate them.', stakes: 'rep −3 to −15 and a follower hit either way',
          apply: S => { if (chance(.5)) { const r = repHit(S, 8, 15); return hurt(S, '😖', `Airing a fan's private breakdown looked cruel. Rep −${r}.`, .01, .03); } const r = repHit(S, 3, 7); return hurt(S, '😐', `Some cheered, many winced. A wash that left a bad taste. Rep −${r}.`, .005, .015); } },
      ] },
    { id: 'platform-turns', kind: 'hostile', emoji: '🪤', title: 'The platform you built on turned on you.', badge: 'Platform risk', minWeek: 36,
      cond: S => { const t = strongest(S); return t && t.followers > 5000; },
      priority: S => !!S.flags.concentrated,
      text: 'An algorithm change, a policy sweep, a reach collapse — take your pick. The channel you bet everything on just stopped putting your work in front of the people who follow you.',
      choices: [
        { t: 'repair', ci: '🌱', label: 'Lean on what you own', desc: 'The newsletter, the members — the audience they can’t take back.', stakes: 'an owned audience softens it; concentrated + rented → a big reach hit',
          apply: S => { const owned = S.members > 0 || S.plats.writing.active; const conc = !!S.flags.concentrated; addStress(S, 4);
            const lo = owned ? .01 : (conc ? .06 : .03), hi = owned ? .03 : (conc ? .12 : .06);
            return hurt(S, '🪤', owned ? 'The platform buried you, but the people on your own list still turned up. You had a floor.' : 'You had nowhere else to send them, and the reach just… left.', lo, hi); } },
        { t: 'escalate', ci: '📣', label: 'Fight the change publicly', desc: 'Make noise, demand answers.', stakes: 'a reach hit either way · 40%: sympathy followers · else rep −2–6',
          apply: S => { const conc = !!S.flags.concentrated; const lo = conc ? .05 : .03, hi = conc ? .10 : .05;
            const log = hurt(S, '📣', 'You posted the callout everywhere that still worked.', lo, hi);
            if (chance(.4)) { const p = strongest(S); const g = Math.round(rnd(800, 2600)); p.followers += g; S.newFollowers += g; log.feed.push({ emoji:'🫶', text:`+${fmt(g)} showed up on your side.`, kind:'good' }); log.floats.push({ anchor:'plat:'+p.key, text:'+'+fmt(g), tone:'gain' }); }
            else { const r = repHit(S, 2, 6); log.feed.push({ emoji:'🙄', text:`Some read it as sour grapes. Rep −${r}.`, kind:'bad' }); }
            return log; } },
      ] },
    { id: 'sleepless', repeatable: true, kind: 'neutral', emoji: '🥵', title: "You haven't slept in days.", badge: 'Health', cond: S => S.stress >= 60,
      priority: S => S.flags.pushedThrough && S.week - S.flags.pushedThrough <= 5,   // echo: push through it and your body sends the next invoice sooner
      text: 'The grind is catching up. Your body is sending invoices.',
      choices: [
        { t: 'escalate', ci: '⛽', label: 'Push through it', desc: 'Keep the streak alive. Risky.', stakes: '+12 stress · heat +5 everywhere',
          apply: S => { addStress(S, 12); S.flags.pushedThrough = S.week; activePlats(S).forEach(p => p.heat = clamp(p.heat + 5, 0, 100)); return fed('⛽', 'You pushed through. The feed got fed. You didn’t.', 'bad'); } },
        { t: 'repair', ci: '🛌', label: 'Log off and recover', desc: 'Reset stress, lose momentum.', stakes: '−30 stress · heat −10 everywhere',
          apply: S => { addStress(S, -30); activePlats(S).forEach(p => p.heat = clamp(p.heat - 10, 0, 100)); return fed('🛌', 'You logged off for real. Stress dropped, buzz cooled.', 'good'); } },
      ] },
    // ---- cash-sink sub-deck (the balance fix) ----
    { id: 'tax-bill', kind: 'neutral', emoji: '🧾', title: 'The tax bill came due.', badge: 'Taxes', minWeek: 18, maxWeek: 36,
      text: 'Quarterly estimate. The number at the bottom is bigger than you told yourself it would be.',
      choices: [
        { t: 'repair', ci: '💳', label: 'Pay it clean', desc: 'Settle in full. Done is done.', stakes: 'pay the tax owed, capped at 60% of cash · +4 stress',
          apply: S => { const bill = bite(S, taxBill(S), 0.6); addStress(S, 4); return spend(S, '🧾', `Paid the estimate: −${money(bill)}. Nobody from the government will be writing.`, bill); } },
        { t: 'escalate', ci: '🧮', label: 'Get creative with it', desc: 'Write off everything. Coin flip.', stakes: '50%: about half the bill · else 1.5× the bill, rep −3–8, +8 stress',
          apply: S => { const raw = taxBill(S); if (chance(.5)) { const paid = bite(S, raw * 0.5, 0.6); return spend(S, '🧮', `The deductions held. Only −${money(paid)} this quarter.`, paid, ''); } const owed = bite(S, raw * 1.5, 0.75); const r = repHit(S, 3, 8); addStress(S, 8); return spend(S, '📛', `Flagged for review. Back taxes and penalties: −${money(owed)}. Rep −${r}.`, owed); } },
      ] },
    { id: 'tax-year-end', kind: 'neutral', emoji: '🧾', title: 'Year-end taxes hit.', badge: 'Taxes', minWeek: 45,
      text: 'Everything you made since the last reckoning, all on one line.',
      choices: [
        { t: 'repair', ci: '💳', label: 'Pay it and move on', desc: 'Close the year clean.', stakes: 'pay the year in full, capped at 60% of cash · +4 stress',
          apply: S => { const bill = bite(S, taxBill(S), 0.6); addStress(S, 4); return spend(S, '🧾', `Squared up for the year: −${money(bill)}.`, bill); } },
        { t: 'escalate', ci: '⏳', label: 'Set up a payment plan', desc: 'Spread it, eat the interest.', stakes: '1.2× the bill with interest, capped at 70% of cash · +6 stress',
          apply: S => { const bill = bite(S, taxBill(S) * 1.2, 0.7); addStress(S, 6); return spend(S, '⏳', `On a plan now, with interest: −${money(bill)} this pass.`, bill); } },
      ] },
    { id: 'demonetization', kind: 'neutral', emoji: '🚫', title: 'Your account got demonetized.', badge: 'Strike', cond: S => totalFollowers(S) > 5000, minWeek: 10,
      text: 'A blanket policy sweep caught you in it. The revenue dashboard just flatlined.',
      choices: [
        { t: 'repair', ci: '📩', label: 'Appeal and wait', desc: 'File it, lose the month either way.', stakes: 'lose ~6% of followers in frozen ad money (capped) · +6 stress',
          apply: S => { const gap = bite(S, totalFollowers(S) * 0.06, 0.4); addStress(S, 6); return spend(S, '🚫', `Ad money frozen while you appeal: −${money(gap)} this month. The appeal form has a character limit.`, gap); } },
        { t: 'escalate', ci: '📢', label: 'Make it public and loud', desc: 'Post about it. Sympathy or noise.', stakes: 'same revenue hit · 50%: +800–2.6K sympathisers · else rep −2–6',
          apply: S => { const gap = bite(S, totalFollowers(S) * 0.06, 0.4); if (chance(.5)) { const p = strongest(S); const ggn = Math.round(rnd(800, 2600)); p.followers += ggn; S.newFollowers += ggn; const log = spend(S, '📢', `The callout landed. Still down ${money(gap)}, but +${fmt(ggn)} showed up angry on your behalf.`, gap, ''); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(ggn), tone: 'gain' }); log.bump.push(p.key); return log; } const r = repHit(S, 2, 6); return spend(S, '📉', `Read as whining. Down ${money(gap)} and Rep −${r}.`, gap); } },
      ] },
    { id: 'gear-dies', kind: 'neutral', emoji: '🎥', title: 'Your main rig just died.', badge: 'Equipment', cond: S => S.gear >= 1 && S.gear <= 3,
      text: 'Mid-shoot, the whole setup gave up. You are not making anything good on a phone.',
      choices: [
        { t: 'repair', ci: '🛒', label: 'Replace it now', desc: 'Buy back the tier you were on.', stakes: 'buy back your kit tier at full price',
          apply: S => { const cost = CONFIG.gearCost[S.gear]; return spend(S, '🎥', `Bought the replacement: −${money(cost)}. Same tier, new smell.`, cost); } },
        { t: 'escalate', ci: '📵', label: 'Limp along without it', desc: 'Save the cash, lose the quality.', stakes: 'drop a kit tier · heat −8 everywhere',
          apply: S => { S.gear = Math.max(0, S.gear - 1); activePlats(S).forEach(p => p.heat = clamp(p.heat - 8, 0, 100)); return fed('📵', 'Downgraded to whatever still works. Everything now looks like it was shot on the old phone, because it was.', 'bad'); } },
      ] },
    { id: 'sponsor-clawback', kind: 'neutral', emoji: '💼', title: 'A past sponsor wants their money back.', badge: 'Clawback', cond: S => S.deals >= 2, minWeek: 12,
      text: 'The brand you ran got caught in its own scandal, and the contract had a morality clause pointed the wrong way.',
      choices: [
        { t: 'repair', ci: '✍️', label: 'Honor the clause', desc: 'Pay it back, keep your name clean.', stakes: 'refund about $300 plus 2% of followers (capped) · rep +1–4',
          apply: S => { const amt = bite(S, 300 + totalFollowers(S) * 0.02, 0.5); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return spend(S, '💼', `Refunded the fee: −${money(amt)}. The lawyers went quiet.`, amt); } },
        { t: 'escalate', ci: '⚖️', label: 'Fight it', desc: 'Refuse. Legal fees either way.', stakes: 'similar legal fees anyway · rep −2–6',
          apply: S => { const fees = bite(S, 300 + totalFollowers(S) * 0.025, 0.5); const r = repHit(S, 2, 6); return spend(S, '⚖️', `Dragged it out. Legal fees anyway: −${money(fees)}. Rep −${r}.`, fees); } },
      ] },
    { id: 'surprise-expense', kind: 'neutral', emoji: '💥', title: 'Something expensive just broke.', badge: 'Life', cond: S => totalFollowers(S) > 2000, minWeek: 6,
      text: 'Not the content. Life. The kind of bill that does not care about your posting schedule.',
      choices: [
        { t: 'repair', ci: '💸', label: 'Just handle it', desc: 'Pay and keep moving.', stakes: 'pay about $150 plus 2% of followers (capped) · +3 stress',
          apply: S => { const amt = bite(S, 150 + totalFollowers(S) * 0.02, 0.3); addStress(S, 3); return spend(S, '💥', `Handled it: −${money(amt)}. Onward.`, amt); } },
        { t: 'escalate', ci: '🩹', label: 'Put it off', desc: 'Ignore it. It gets worse.', stakes: '1.6× the bill later · +9 stress',
          apply: S => { const amt = bite(S, (150 + totalFollowers(S) * 0.02) * 1.6, 0.4); addStress(S, 9); return spend(S, '🩹', `Let it fester. Now it is −${money(amt)} and a worse week.`, amt); } },
      ] },
    // ---- growth & variety sub-deck ----
    { id: 'collab-offer', kind: 'neutral', emoji: '🤝', title: 'Another creator wants to collab.', badge: 'Collab', maxWeek: 35,
      text: 'Someone a notch bigger than you likes your stuff and wants to make something together.',
      choices: [
        { t: 'repair', ci: '🎬', label: 'Make it happen', desc: 'Clear the calendar. Their audience meets yours.', stakes: '+1.2K–3K followers, bigger when you are small · heat +10 · +6 stress',
          apply: S => { const g = Math.round(rnd(1200, 3000) * (1 + 30000 / (totalFollowers(S) + 8000))); const p = strongest(S); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 10, 0, 100); addStress(S, 6); const log = fed('🤝', `You made it together. +${fmt(g)} of their people followed you over.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } },
        { t: 'neutral', ci: '🙏', label: 'Pass, stay focused', desc: 'Not the right fit right now.', stakes: 'rep +1–3 · no new followers',
          apply: S => { S.rep = clamp(S.rep + rint(1, 3), 0, 100); return fed('🙏', 'You passed. No hard feelings, no new followers.', ''); } },
      ] },
    { id: 'collab-big', kind: 'neutral', emoji: '🌟', title: 'A much bigger creator slid into your DMs.', badge: 'Big collab', cond: S => totalFollowers(S) > 15000, minWeek: 20,
      text: 'Someone with real reach wants you on their channel. This is the asymmetric bet.',
      choices: [
        { t: 'repair', ci: '🎥', label: 'Team up with them', desc: 'Their audience is huge. Ride it.', stakes: '+2K–4.5K followers · heat +14 · +8 stress',
          apply: S => { const g = Math.round(rnd(2000, 4500)); const p = strongest(S); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 14, 0, 100); addStress(S, 8); const log = fed('🌟', `Their crowd found you. +${fmt(g)} followers in a week.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } },
        { t: 'escalate', ci: '😏', label: 'Try to upstage them', desc: 'Steal the show. High variance.', stakes: '50%: +4K–8K followers, heat +18 · else rep −4–9, only +500–1.5K',
          apply: S => { const p = strongest(S); if (chance(.5)) { const g = Math.round(rnd(4000, 8000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 18, 0, 100); const log = fed('🔥', `You stole the whole segment. +${fmt(g)} followers, and everyone knows your name now.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } const r = repHit(S, 4, 9); const g = Math.round(rnd(500, 1500)); p.followers += g; S.newFollowers += g; return fed('😐', `Came off as a try-hard. A few followed anyway (+${fmt(g)}), but their fans clocked it. Rep −${r}.`, 'bad'); } },
      ] },
    { id: 'platform-beta', kind: 'neutral', emoji: '🧪', title: 'A platform invited you to a private beta.', badge: 'Early access', maxWeek: 20,
      text: 'A new feature, early. Early adopters usually get a reach bump while it is shiny.',
      choices: [
        { t: 'repair', ci: '🚀', label: 'Jump on the beta', desc: 'Be first. Reach loves new toys.', stakes: 'heat +13 · +3 stress',
          apply: S => { const p = strongest(S); p.heat = clamp(p.heat + 13, 0, 100); addStress(S, 3); const log = fed('🧪', `You went early. ${PLATFORMS[p.key].name} is pushing your stuff hard, mostly to prove the feature works.`, 'good'); log.bump.push(p.key); return log; } },
        { t: 'neutral', ci: '👀', label: 'Wait and see', desc: 'Let others find the bugs.', stakes: 'heat +6 · no stress',
          apply: S => { const p = strongest(S); p.heat = clamp(p.heat + 6, 0, 100); return fed('👀', 'You held back. Other people found the bugs. You found a smaller bump.', ''); } },
      ] },
    { id: 'press-feature', kind: 'neutral', emoji: '📰', title: 'A journalist wants to feature you.', badge: 'Press', minWeek: 8,
      text: 'A real outlet is writing about creators in your space and wants you in it.',
      choices: [
        { t: 'repair', ci: '🎙️', label: 'Do the interview', desc: 'On the record. Good for the name.', stakes: 'rep +3–7 · +800–2.5K followers',
          apply: S => { const rr = rint(3, 7); S.rep = clamp(S.rep + rr, 0, 100); const p = strongest(S); const g = Math.round(rnd(800, 2500)); p.followers += g; S.newFollowers += g; const log = fed('📰', `The piece ran. +${fmt(g)} followers, a credibility bump, and one quote you didn’t say quite like that.`, 'good'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'gain' }); log.floats.push({ anchor: 'rep', text: '+' + rr, tone: 'up' }); log.bump.push(p.key); return log; } },
        { t: 'neutral', ci: '🚪', label: 'Decline politely', desc: 'Not interested in the spotlight.', stakes: 'rep +1–3',
          apply: S => { S.rep = clamp(S.rep + rint(1, 3), 0, 100); return fed('🚪', 'You passed on the press. Quiet week.', ''); } },
      ] },
    { id: 'copycat', kind: 'hostile', emoji: '🐜', title: 'Someone is copying your whole format.', badge: 'Copycat',
      text: 'A smaller account is cloning your format beat for beat and growing off it.',
      choices: [
        { t: 'repair', ci: '💪', label: 'Out-create them', desc: 'Raise your own bar and move on.', stakes: '+5 stress · heat +10 · rep +1–4',
          apply: S => { addStress(S, 5); const p = strongest(S); p.heat = clamp(p.heat + 10, 0, 100); S.rep = clamp(S.rep + rint(1, 4), 0, 100); const log = fed('💪', 'You just got better. The copy looks like a copy now.', 'good'); log.bump.push(p.key); return log; } },
        { t: 'neutral', ci: '😶', label: 'Ignore it', desc: 'Imitation, flattery, whatever.', stakes: '60%: nothing · else a small follower hit',
          apply: S => { if (chance(.6)) return fed('😶', 'You ignored it. Your audience knows who did it first.', ''); return hurt(S, '😕', 'Their version caught the algorithm this time.', .005, .015); } },
        { t: 'escalate', ci: '📣', label: 'Call them out publicly', desc: 'Name them. Could backfire.', stakes: '45%: +1K–3.5K followers, heat +12 · else rep −6–12 and a follower hit',
          apply: S => { if (chance(.45)) { const p = strongest(S); const g = Math.round(rnd(1000, 3500)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 12, 0, 100); const log = fed('📣', `The callout worked. +${fmt(g)} came to see the original.`, 'big'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'hit' }); log.bump.push(p.key); return log; } const r = repHit(S, 6, 12); return hurt(S, '🙄', `It read as punching down at a smaller creator. Rep −${r}.`, .01, .03); } },
      ] },
    { id: 'editor-quits', kind: 'neutral', emoji: '✂️', title: 'Your editor just quit.', badge: 'Team', cond: S => S.hires.editor,
      text: 'Two lines in a DM and your longform pipeline is suddenly your problem again.',
      choices: [
        { t: 'repair', ci: '🔁', label: 'Re-hire fast', desc: 'Pay to bring someone in quick.', stakes: '−$600 to re-sign · +4 stress',
          apply: S => { const cost = HIRES.editor.sign; addStress(S, 4); return spend(S, '🔁', `Signed a replacement editor: −${money(cost)}. The pipeline holds.`, cost, ''); } },
        { t: 'escalate', ci: '😮‍💨', label: 'Do it all yourself', desc: 'Save the cash, eat the hours.', stakes: 'lose the editor (payroll −$110/wk) · +12 stress',
          apply: S => { S.hires.editor = false; addStress(S, 12); return fed('😮‍💨', 'Back to editing at 2am. Payroll down, stress up.', 'bad'); } },
      ] },
    { id: 'sponsor-pullout', kind: 'neutral', emoji: '🏳️', title: 'A sponsor pulled out at the last minute.', badge: 'Deal fell through', cond: S => S.deals >= 1, minWeek: 14,
      text: 'The deal you were counting on this month evaporated after their own PR mess.',
      choices: [
        { t: 'repair', ci: '📇', label: 'Hustle a replacement', desc: 'Work the inbox, find another.', stakes: '+$400 plus 1% of followers · +4 stress',
          apply: S => { addStress(S, 4); const amt = Math.round(400 + totalFollowers(S) * 0.01); S.grossEarned += amt; return gift(S, '📇', `Landed a smaller deal to cover it: +${money(amt)}. Exhausting, but handled.`, amt, ''); } },
        { t: 'neutral', ci: '🤷', label: 'Eat the loss', desc: 'Let it go, protect your energy.', stakes: '−$300 in prep · rep +0–2',
          apply: S => { const amt = 300; S.rep = clamp(S.rep + rint(0, 2), 0, 100); return spend(S, '🤷', `Wrote off the prep time: −${money(amt)}. Onward.`, amt, ''); } },
      ] },
    { id: 'cpm-q4', kind: 'neutral', emoji: '🎄', title: 'Q4 ad rates are spiking.', badge: 'Seasonal', minWeek: 45,
      text: 'Brands are dumping budgets before year-end. Every view is worth more right now.',
      choices: [
        { t: 'repair', ci: '📈', label: 'Push hard through Q4', desc: 'Post into the wave. Cash in.', stakes: '+$1,500 plus 3% of followers · +6 stress',
          apply: S => { const amt = Math.round(1500 + totalFollowers(S) * 0.03); addStress(S, 6); return gift(S, '🎄', `You rode the Q4 spike: +${money(amt)}.`, amt); } },
        { t: 'neutral', ci: '😌', label: 'Coast the holidays', desc: 'Take the smaller check, keep your sanity.', stakes: '+$700 plus 1.5% of followers · no stress',
          apply: S => { const amt = Math.round(700 + totalFollowers(S) * 0.015); return gift(S, '😌', `Coasted through: +${money(amt)}, and you actually rested.`, amt); } },
      ] },
    { id: 'cpm-summer', kind: 'neutral', emoji: '🏖️', title: 'Summer ad rates are in the gutter.', badge: 'Seasonal', minWeek: 22, maxWeek: 35,
      text: 'Everyone is on vacation, budgets are frozen, and your revenue graph is sagging.',
      choices: [
        { t: 'repair', ci: '🌊', label: 'Ride out the slump', desc: 'Keep posting through the dip.', stakes: '−$500 plus 1% of followers this month',
          apply: S => { const amt = Math.round(500 + totalFollowers(S) * 0.01); return spend(S, '🏖️', `Thin ad month: −${money(amt)}. It passes.`, amt); } },
        { t: 'neutral', ci: '🗄️', label: 'Bank content for fall', desc: 'Film now, publish when rates recover.', stakes: '−$300 · heat +6',
          apply: S => { const amt = 300; const p = strongest(S); p.heat = clamp(p.heat + 6, 0, 100); const log = spend(S, '🗄️', `Smaller hit (−${money(amt)}), and you stockpiled for the fall bump.`, amt, ''); log.bump.push(p.key); return log; } },
      ] },
    { id: 'awards-nod', kind: 'neutral', emoji: '🏆', title: 'You got nominated for an award.', badge: 'Awards', minWeek: 45,
      text: 'A creator award you did not apply for has your name on the shortlist.',
      choices: [
        { t: 'repair', ci: '📣', label: 'Campaign for it', desc: 'Rally the audience, make some noise.', stakes: '+5 stress · rep +3–8 · 50%: +$500',
          apply: S => { addStress(S, 5); S.rep = clamp(S.rep + rint(3, 8), 0, 100); if (chance(.5)) return gift(S, '🏆', 'You won it. +$500 honorarium and a lot of goodwill.', 500, 'big'); return fed('🏆', 'You did not win. “Nominated” goes in the bio anyway.', 'good'); } },
        { t: 'neutral', ci: '🙂', label: 'Let the work speak', desc: 'No campaign. Whatever happens, happens.', stakes: 'rep +2–5',
          apply: S => { S.rep = clamp(S.rep + rint(2, 5), 0, 100); return fed('🙂', 'You stayed above it. The nod did the talking.', ''); } },
      ] },
    { id: 'annual-reckoning', kind: 'neutral', emoji: '🗓️', title: 'A year of this. Was it worth it?', badge: 'Year-end', minWeek: 47,
      text: 'The analytics page rolled over to a year-in-review. All of it, in one scroll.',
      choices: [
        { t: 'repair', ci: '🧘', label: 'Take stock honestly', desc: 'Sit with it. Reset for what is next.', stakes: '−10 stress · rep +1–4',
          apply: S => { addStress(S, -10); S.rep = clamp(S.rep + rint(1, 4), 0, 100); return fed('🧘', 'You looked at the whole year and breathed. Lighter now.', 'good'); } },
        { t: 'escalate', ci: '⛽', label: 'Ignore it, keep grinding', desc: 'No time to reflect. Post.', stakes: '+6 stress · heat +4',
          apply: S => { addStress(S, 6); activePlats(S).forEach(p => p.heat = clamp(p.heat + 4, 0, 100)); return fed('⛽', 'No time for feelings. Straight back to the feed, which has never once asked how you are.', ''); } },
      ] },
    { id: 'algo-boost', kind: 'neutral', emoji: '📶', title: 'The algorithm is suddenly on your side.', badge: 'Tailwind', repeatable: true,
      text: 'For no reason you can name, the feed is handing you reach this week.',
      choices: [
        { t: 'repair', ci: '🌊', label: 'Lean into the wave', desc: 'Ride it while it lasts.', stakes: 'heat +7 everywhere · +4 stress',
          apply: S => { activePlats(S).forEach(p => p.heat = clamp(p.heat + 7, 0, 100)); addStress(S, 4); return fed('📶', 'You pushed while the pushing was good. Everything is warm.', 'good'); } },
        { t: 'neutral', ci: '🎯', label: 'Stay steady', desc: 'Nice, but do not chase ghosts.', stakes: 'heat +6 on your top channel · no stress',
          apply: S => { const p = strongest(S); p.heat = clamp(p.heat + 6, 0, 100); return fed('🎯', 'You took the tailwind without changing your plan.', ''); } },
      ] },
    { id: 'brand-inbound', kind: 'neutral', emoji: '📥', title: 'A clean brand wants to work with you.', badge: 'Inbound', cond: S => totalFollowers(S) > 3000, maxWeek: 40,
      text: 'No crypto, no catch. An actual brand your audience would not roll their eyes at.',
      choices: [
        { t: 'repair', ci: '🤝', label: 'Take the clean deal', desc: 'Fair money, no reputation cost.', stakes: '+$400 plus 2% of followers · no rep cost',
          apply: S => { const amt = Math.round(400 + totalFollowers(S) * 0.02); S.grossEarned += amt; return gift(S, '📥', `Signed a clean sponsorship: +${money(amt)}.`, amt); } },
        { t: 'escalate', ci: '💬', label: 'Push for more money', desc: 'Negotiate hard. They might walk.', stakes: '50%: 1.6× the money · else they walk, $0',
          apply: S => { if (chance(.5)) { const amt = Math.round((400 + totalFollowers(S) * 0.02) * 1.6); S.grossEarned += amt; return gift(S, '💬', `They blinked. +${money(amt)}.`, amt, 'big'); } return fed('💬', 'You pushed too hard and they walked. The email said “circle back”. They will not.', ''); } },
      ] },
    { id: 'rent-hike', kind: 'neutral', emoji: '📈', title: 'The landlord raised the rent.', badge: 'Fixed costs', cond: S => S.gear >= 6, minWeek: 8,
      text: 'Market rate, apparently. The building you put your name on now costs more to keep your name on.',
      choices: [
        { t: 'repair', ci: '💳', label: 'Pay the increase', desc: 'Four weeks of the bump, up front.', stakes: 'four weeks of the rent bump (capped) · +4 stress',
          apply: S => { const amt = bite(S, STUDIOS[6].lease * 0.15 * 4, 0.5); addStress(S, 4); return spend(S, '📈', `Paid the bump: −${money(amt)}. The door still has your name on it.`, amt); } },
        { t: 'escalate', ci: '🚪', label: 'Threaten to walk', desc: 'Call the bluff. Coin flip.', stakes: '50%: rent holds · else six weeks of the bump, +8 stress',
          apply: S => { if (chance(.5)) return fed('🤝', 'They blinked. Rent stays where it was, and now they know you read the lease.', 'good'); const amt = bite(S, STUDIOS[6].lease * 0.15 * 6, 0.6); addStress(S, 8); return spend(S, '📉', `They didn’t blink. Six weeks of the bump plus a very polite letter: −${money(amt)}.`, amt); } },
      ] },
    { id: 'building-outage', kind: 'neutral', emoji: '🔌', title: 'The building’s internet died mid-stream.', badge: 'Infrastructure', cond: S => S.gear >= 6, repeatable: true,
      text: 'Everything you make runs through a box in a cupboard, and the box is off.',
      choices: [
        { t: 'repair', ci: '🛠️', label: 'Get your own line put in', desc: 'Pay for redundancy. Never again.', stakes: '−$1,500 for a backup line (capped)',
          apply: S => { const amt = bite(S, 1500, 0.4); return spend(S, '🔌', `Installed a second line: −${money(amt)}. Boring, and worth it.`, amt, ''); } },
        { t: 'escalate', ci: '📵', label: 'Wait for the landlord', desc: 'It’s their problem. It’s your week.', stakes: 'heat −12 everywhere · +8 stress',
          apply: S => { activePlats(S).forEach(p => p.heat = clamp(p.heat - 12, 0, 100)); addStress(S, 8); return fed('📵', 'Three days dark. Reach cooled everywhere and the landlord sent a thumbs-up emoji.', 'bad'); } },
      ] },
    { id: 'community-milestone', kind: 'neutral', emoji: '🎉', title: 'You just hit a follower milestone.', badge: 'Milestone', cond: S => totalFollowers(S) > 10000,
      text: 'A round number rolled over. The comments are full of people who have been here a while.',
      choices: [
        { t: 'repair', ci: '❤️', label: 'Celebrate with them', desc: 'Make it about the community.', stakes: 'rep +2–5 · −4 stress',
          apply: S => { S.rep = clamp(S.rep + rint(2, 5), 0, 100); addStress(S, -4); return fed('🎉', 'You threw it back to the people who showed up. The room is warm.', 'good'); } },
        { t: 'neutral', ci: '😊', label: 'Mark it quietly', desc: 'A small thank-you, back to work.', stakes: 'rep +1–3',
          apply: S => { S.rep = clamp(S.rep + rint(1, 3), 0, 100); return fed('😊', 'A quiet thanks, and on to the next round number.', ''); } },
      ] },
    // ---- Acts 2a: late-act deck expansion (Act III ceiling/audience + Act II texture) ----
    { id: 'audience-expectations', kind: 'neutral', emoji: '🪞', title: 'Your audience decided who you are.', badge: 'Expectations', minWeek: 36,
      text: 'Every time you try something new, the comments ask for the old thing. They love a version of you that you finished being months ago.',
      choices: [
        { t: 'neutral', ci: '🔁', label: 'Give them the version they subscribed for', desc: 'Serve the hits. Stay in the lane.', stakes: '+2–3% of your following (small audiences barely move it) · heat +8 · rep −1–3 (you know it’s a cage)',
          apply: S => { const p = strongest(S); const g = Math.round(rnd(0.02, 0.03) * Math.min(totalFollowers(S), 45000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 8, 0, 100); const r = repHit(S, 1, 3); const log = fed('🪞', `You made the thing they wanted. It did fine — +${fmt(g)} — and you felt like a tribute act to yourself. Rep −${r}.`, ''); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'gain' }); log.bump.push(p.key); return log; } },
        { t: 'escalate', ci: '🎨', label: 'Make what you actually want', desc: 'Follow the work, not the room.', stakes: '50%: rep +6–12, they grow with you · else −2–5% of your biggest channel',
          apply: S => { if (chance(.5)) { S.rep = clamp(S.rep + rint(6, 12), 0, 100); return fed('🎨', 'You made the thing you wanted. Enough of them came with you; the rest were quietly replaced by better ones.', 'big'); } S.flags.pivoted = S.week; return hurt(S, '🥶', 'You made the thing you wanted and the room went cold. The regulars felt abandoned and said so.', .02, .05); } },
      ] },
    { id: 'reinvent-or-coast', kind: 'neutral', emoji: '🛞', title: 'You could coast from here.', badge: 'Fork', minWeek: 40,
      text: 'You have a formula that works. You could run it to the end of the year on autopilot — or bet the momentum on becoming something else while you still have momentum to bet.',
      choices: [
        { t: 'repair', ci: '😌', label: 'Coast the formula', desc: 'Bank the wins, take your foot off.', stakes: '−8 stress · heat −6 everywhere (the slow fade)',
          apply: S => { addStress(S, -8); activePlats(S).forEach(p => p.heat = clamp(p.heat - 6, 0, 100)); return fed('😌', 'You stopped pushing. The numbers held, then softened. Nobody could name the week you started phoning it in.', ''); } },
        { t: 'escalate', ci: '🎲', label: 'Bet on a reinvention', desc: 'Blow it up while it’s still your choice.', stakes: '45%: +3K–9K followers, heat +18 · else rep −3–7 and a stress spike',
          apply: S => { if (chance(.45)) { const p = strongest(S); const g = Math.round(rnd(3000, 9000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 18, 0, 100); const log = fed('🎲', `The reinvention landed. +${fmt(g)} came for the new thing, and you bought another year of being interesting.`, 'big'); log.floats.push({ anchor:'plat:'+p.key, text:'+'+fmt(g), tone:'hit' }); log.bump.push(p.key); return log; } const r = repHit(S, 3, 7); addStress(S, 10); return fed('🌫️', `The new direction confused everyone, you included. It didn’t take. Rep −${r}, and you’re tired.`, 'bad'); } },
      ] },
    { id: 'ceiling-plateau', kind: 'neutral', emoji: '📊', title: 'The number stopped moving.', badge: 'Plateau', minWeek: 36,
      text: 'For weeks the follower count has hovered in the same place. Not falling. Just done climbing. You built the thing, and the thing found its size.',
      choices: [
        { t: 'repair', ci: '🧱', label: 'Double down on what works', desc: 'Make more of the thing they already like.', stakes: '+4.5–7% of your following (small audiences barely move it) · heat +6 on your top channel · +2 stress',
          apply: S => { const p = strongest(S); const g = Math.round(rnd(0.045, 0.07) * Math.min(totalFollowers(S), 45000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 6, 0, 100); addStress(S, 2); const log = fed('📊', `You leaned into the proven formula. The plateau nudged up — +${fmt(g)} — steady and warm. Sometimes steady is the win.`, 'good'); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'gain' }); log.bump.push(p.key); return log; } },
        { t: 'escalate', ci: '🚀', label: 'Chase a new format', desc: 'Try to break the ceiling with something different.', stakes: '50%: +1.5K–5K followers & heat +14 · else heat −6 everywhere',
          apply: S => { if (chance(.5)) { const p = strongest(S); const g = Math.round(rnd(1500, 5000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 14, 0, 100); const log = fed('🚀', `The new format broke the ceiling. +${fmt(g)} followers, and the graph remembered how to go up.`, 'big'); log.floats.push({ anchor:'plat:'+p.key, text:'+'+fmt(g), tone:'hit' }); log.bump.push(p.key); return log; } activePlats(S).forEach(p => p.heat = clamp(p.heat - 6, 0, 100)); return fed('📉', 'The new thing landed with a thud. The regulars were confused and the algorithm shrugged.', 'bad'); } },
      ] },
    { id: 'format-fatigue', kind: 'neutral', emoji: '🔁', title: 'Your signature format is getting tired.', badge: 'Format', minWeek: 36,
      text: 'The thing that made you is now the thing they expect. The views are softening on the exact format that used to be a guaranteed hit.',
      choices: [
        { t: 'escalate', ci: '🪦', label: 'Retire it while it’s ahead', desc: 'Kill your darling before it kills your channel.', stakes: '45%: rep +4–9 & +1–3K followers · else −2–4% of your biggest channel',
          apply: S => { if (chance(.45)) { S.rep = clamp(S.rep + rint(4, 9), 0, 100); const p = strongest(S); const g = Math.round(rnd(1000, 3000)); p.followers += g; S.newFollowers += g; const log = fed('🪦', `You retired the format at its peak. Respect for going out on top — and +${fmt(g)} curious about what’s next.`, 'big'); log.floats.push({ anchor:'plat:'+p.key, text:'+'+fmt(g), tone:'gain' }); log.bump.push(p.key); return log; } return hurt(S, '🫤', 'You dropped the format, and the people who came for exactly that drifted off.', .02, .04); } },
        { t: 'neutral', ci: '🥱', label: 'Keep making it', desc: 'It still works. Mostly. For now.', stakes: '+1.5–2.5% of your following (small audiences barely move it) · heat +4 · the slow decline continues',
          apply: S => { const p = strongest(S); const g = Math.round(rnd(0.015, 0.025) * Math.min(totalFollowers(S), 45000)); p.followers += g; S.newFollowers += g; p.heat = clamp(p.heat + 4, 0, 100); const log = fed('🔁', `You kept making the hits. They keep doing fine (+${fmt(g)}), a little less every time, like a band playing the one song.`, ''); log.floats.push({ anchor: 'plat:' + p.key, text: '+' + fmt(g), tone: 'gain' }); log.bump.push(p.key); return log; } },
      ] },
    { id: 'scale-burnout', kind: 'neutral', emoji: '🪫', title: 'Success turned out to be heavier than you thought.', badge: 'Scale', minWeek: 36, cond: S => S.stress >= 50,
      text: 'More followers, more posts, more people wanting things. The bigger it gets, the less of it is the part you actually liked.',
      choices: [
        { t: 'repair', ci: '🧑‍🤝‍🧑', label: 'Delegate and take a breath', desc: 'Let some of it go. Protect the part that matters.', stakes: '−20 stress · heat −6 everywhere',
          apply: S => { addStress(S, -20); activePlats(S).forEach(p => p.heat = clamp(p.heat - 6, 0, 100)); return fed('🧑‍🤝‍🧑', 'You handed off the parts you dreaded and remembered why you started. Quieter numbers, louder sleep.', 'good'); } },
        { t: 'escalate', ci: '⛽', label: 'Push through — you’re so close', desc: 'The finish line is right there. Probably.', stakes: '+12 stress · heat +5 everywhere · your body will send the invoice',
          apply: S => { addStress(S, 12); S.flags.pushedThrough = S.week; activePlats(S).forEach(p => p.heat = clamp(p.heat + 5, 0, 100)); return fed('⛽', 'You told yourself just a little more. You always tell yourself that. The feed got fed.', 'bad'); } },
      ] },
    { id: 'old-guard', kind: 'neutral', emoji: '🧓', title: 'You’re not the new thing anymore.', badge: 'Old guard', minWeek: 40,
      text: 'There’s a creator half your size and a quarter your age doing your thing, hungrier. The comments have started using the word “veteran.” You’re not sure it’s a compliment.',
      choices: [
        { t: 'repair', ci: '🤝', label: 'Bring them into your orbit', desc: 'Collab, co-sign, pass something down.', stakes: '+6–9% of your following (small audiences barely move it) · rep +2–5',
          apply: S => { const p = strongest(S); const g = Math.round(rnd(0.06, 0.09) * Math.min(totalFollowers(S), 45000)); p.followers += g; S.newFollowers += g; S.rep = clamp(S.rep + rint(2, 5), 0, 100); const log = fed('🤝', `You lifted them up instead of competing. Their audience met yours, and being the elder statesman looks good on you. +${fmt(g)}.`, 'good'); log.floats.push({ anchor:'plat:'+p.key, text:'+'+fmt(g), tone:'gain' }); log.bump.push(p.key); return log; } },
        { t: 'escalate', ci: '🥊', label: 'Remind everyone who did it first', desc: 'Compete. Out-work the newcomer.', stakes: '+5 stress · 50%: heat +12 · else rep −2–6 (looked insecure)',
          apply: S => { addStress(S, 5); if (chance(.5)) { const p = strongest(S); p.heat = clamp(p.heat + 12, 0, 100); const log = fed('🥊', 'You reminded everyone why you’re the one they copied. Point made.', 'good'); log.bump.push(p.key); return log; } const r = repHit(S, 2, 6); return fed('😬', `Picking a fight with someone smaller than you read as insecure. Rep −${r}.`, 'bad'); } },
      ] },
    { id: 'growth-pressure', kind: 'neutral', emoji: '📈', title: 'Everyone expects you to keep going up.', badge: 'Pressure', minWeek: 18, maxWeek: 35,
      text: 'The sponsors, the algorithm, the part of your own brain that checks the stats — they all want the same thing. Bigger. This month, next month, forever.',
      choices: [
        { t: 'repair', ci: '🧘', label: 'Hold a sustainable pace', desc: 'Grow at a speed you can survive.', stakes: '−6 stress · rep +1–3',
          apply: S => { addStress(S, -6); S.rep = clamp(S.rep + rint(1, 3), 0, 100); return fed('🧘', 'You decided your pace was your pace. The numbers grew slower, and you were still standing to enjoy them.', 'good'); } },
        { t: 'escalate', ci: '🏃', label: 'Chase the number', desc: 'Feed the machine. Post more, sleep less.', stakes: '+10 stress · heat +8 everywhere',
          apply: S => { addStress(S, 10); activePlats(S).forEach(p => p.heat = clamp(p.heat + 8, 0, 100)); return fed('🏃', 'You chased it. Everything got louder, including the ringing in your ears. The graph went up.', ''); } },
      ] },
    { id: 'sponsor-control', kind: 'neutral', emoji: '📋', title: 'A sponsor wants creative control.', badge: 'Deal terms', minWeek: 18, maxWeek: 35, cond: S => S.deals >= 1,
      text: 'Good money, one condition: they approve the script, the thumbnail, the jokes. They’d like your audience’s trust, packaged and delivered on brand.',
      choices: [
        { t: 'repair', ci: '✋', label: 'Hold the line', desc: 'Smaller deal, your voice intact.', stakes: '+$300 plus 1% of followers · rep +1–3',
          apply: S => { const amt = Math.round(300 + totalFollowers(S) * 0.01); S.grossEarned += amt; S.rep = clamp(S.rep + rint(1, 3), 0, 100); return gift(S, '✋', `You kept final cut and took the smaller check: +${money(amt)}. The audience never knew there was a fight, which was the point.`, amt, 'good'); } },
        { t: 'escalate', ci: '🖊️', label: 'Give them the keys', desc: 'Bigger money. Their words in your mouth.', stakes: '+$600 plus 2% of followers · rep −4–9',
          apply: S => { const amt = Math.round(600 + totalFollowers(S) * 0.02); S.cash += amt; S.grossEarned += amt; S.deals++; const r = repHit(S, 4, 9); const log = fed('🖊️', `You ran their script word for word for ${money(amt)}. It read like an ad because it was one. Rep −${r}.`, 'bad'); log.floats.push({ anchor:'cash', text:'+'+money(amt), tone:'cash' }); return log; } },
      ] },
    { id: 'legacy-question', kind: 'neutral', emoji: '🕰️', title: 'What is all this actually for?', badge: 'Reckoning', minWeek: 44,
      text: 'Late, staring at the upload screen, the question arrives uninvited: a year of your life went into this. What did you want it to be — and is it that?',
      choices: [
        { t: 'repair', ci: '🎯', label: 'Recommit to the work that matters', desc: 'Make the thing you’d be proud to have made.', stakes: '−8 stress · rep +3–8',
          apply: S => { addStress(S, -8); S.rep = clamp(S.rep + rint(3, 8), 0, 100); return fed('🎯', 'You remembered the version of this you actually believed in, and made that. It was the best thing you’d posted in months.', 'good'); } },
        { t: 'escalate', ci: '💰', label: 'Cash out the goodwill while it’s hot', desc: 'Monetize everything. Ask the meaning question next year.', stakes: '+$800 plus 2% of followers · rep −3–7',
          apply: S => { const amt = Math.round(800 + totalFollowers(S) * 0.02); S.cash += amt; S.grossEarned += amt; const r = repHit(S, 3, 7); const log = fed('💰', `You turned the goodwill into money while the turning was good: +${money(amt)}. The meaning question can wait. It always waits. Rep −${r}.`, ''); log.floats.push({ anchor:'cash', text:'+'+money(amt), tone:'cash' }); return log; } },
      ] },
    { id: 'the-exit', kind: 'neutral', emoji: '🚪', title: 'Someone wants to buy the whole thing.', badge: 'The offer',
      cond: () => false,   // never in the RANDOM deck — surfaced ONLY by the forced pre-empt in rollEvent (which bypasses cond)
      text: 'A media company slid a number across the table for the channel — the name, the audience, the back catalogue, all of it. A year in, this is the fork: take the money and walk, keep it and see how far it goes, or hand the reins to nobody and go independent.',
      choices: [
        { t: 'escalate', ci: '💰', label: 'Sell the channel', desc: 'Take the buyout. Walk away rich.', stakes: 'a buyout hits the bank, then the run ends — Sold out',
          apply: S => { const buyout = Math.round(totalFollowers(S) * 3); S.cash += buyout; S.grossEarned += buyout; S.flags.exitChoice = 'sold'; S.over = true; S.endKey = 'sellout';
            const log = fed('💰', `You sold. ${money(buyout)} cleared, and the channel is someone else's problem now. Your name is still on it — that was the expensive part.`, 'big'); log.floats.push({ anchor: 'cash', text: '+' + money(buyout), tone: 'cash' }); return log; } },
        { t: 'neutral', ci: '🕊️', label: 'Go independent', desc: 'Walk away on your own terms, with what you own.', stakes: 'run ends — Niche legend if you own an audience (newsletter/members) with rep ≥ 50, else Faded out',
          apply: S => { const owned = S.members > 0 || S.plats.writing.active; S.flags.exitChoice = 'independent'; S.over = true; S.endKey = (owned && S.rep >= 50) ? 'legend' : 'faded';
            return fed('🕊️', S.endKey === 'legend'
              ? 'You walked, and the audience that was actually yours walked with you. No buyer, no boss, no ceiling but your own.'
              : 'You walked, and found out how much of it you never owned. The reach was rented; it stayed with the landlord.', S.endKey === 'legend' ? 'big' : 'bad'); } },
        { t: 'repair', ci: '🧗', label: 'Keep climbing', desc: 'Turn it down. The work isn\'t finished.', stakes: 'no change — play the year out and see where it lands',
          apply: S => fed('🧗', 'You turned it down. The number was real and you said no anyway. The work isn\'t finished, and neither are you.', '') },
      ] },
  ];

  // ======================= weekly orchestration =======================
  // one line per lifestyle step, in order of CONFIG.livingSteps
  const LIFESTYLE_MSG = [
    'You moved somewhere with a door that closes. Living is {cost} a week now. It felt earned.',
    'Nicer place, nicer chair, a gym you visit twice. Living is {cost} a week now, and it is not going back down.',
    'You have a car you don’t drive and a kitchen you don’t cook in. Living is {cost} a week now.',
    'Two homes, an accountant, and a friend who is also an employee. Living is {cost} a week now. Nobody made you.',
  ];
  const BAND_MSG = {
    normal:  { emoji: '😮‍💨', text: 'Stress is back under control. You remembered you have a body.', kind: 'good' },
    hot:     { emoji: '🌡️', text: 'Running hot. Fine for a week or two. Not a month.', kind: '' },
    fumes:   { emoji: '🥵', text: 'On fumes. Everything you make is 15% worse. You can feel it. So can the comments.', kind: 'bad' },
    redline: { emoji: '🚨', text: 'Redline. Three weeks of this and it\'s over. Leave a slot empty.', kind: 'bad' },
  };
  function settleWeek(S) {
    const log = L();
    let passive = 0;
    // evergreen tails keep earning — one summary line/week, not one per tail,
    // so the feed doesn't stutter the same headline 3–4 times (mechanics same)
    let tailViews = 0; const tailCount = S.tails.length;
    S.tails.forEach(t => {
      const pf = PLATFORMS[t.pkey], p = S.plats[t.pkey];
      const v = Math.round(t.views * CONFIG.tailRate), g = Math.round(v * CONFIG.baseConv * pf.loyal * ANGLES.evergreen.conv);
      p.followers += g; S.newFollowers += g; S.totalViews += v; passive += v * pf.rpm; t.weeksLeft--;
      tailViews += v;
    });
    if (tailCount > 0) log.feed.push({ emoji: '🌲', kind: '', text: tailCount === 1
      ? `‘${S.tails[0].topic}’ is still getting found. +${fmt(tailViews)} views this week.`
      : `${tailCount} older posts are still earning — +${fmt(tailViews)} views this week.` });
    S.tails = S.tails.filter(t => t.weeksLeft > 0);
    // membership: recomputed every week
    if (S.members > 0) {
      const posted = activePlats(S).some(p => p.lastPost === S.week);
      S.members = Math.max(0, Math.round(S.members + S.newFollowers * CONFIG.memberNewConv - S.members * (posted ? CONFIG.memberChurn : CONFIG.memberChurnIdle)));
      passive += S.members * CONFIG.memberRate;
    }
    // Newsletter over-send: two issues in one week and some readers decide one was plenty
    const nl = S.plats.writing;
    if (nl.active && nl.weekPosts >= 2) {
      const n = Math.round(nl.followers * CONFIG.newsletterOverSendChurn); nl.followers = Math.max(0, nl.followers - n);
      const m = S.members > 0 ? Math.round(S.members * CONFIG.newsletterOverSendMemberChurn) : 0; S.members = Math.max(0, S.members - m);
      log.feed.push({ emoji: '📭', text: `Two issues in one week. ${fmt(n)} readers${m ? ' and ' + fmt(m) + ' paying members' : ''} decided one was plenty.`, kind: 'bad' });
      if (n) log.floats.push({ anchor: 'plat:writing', text: '-' + fmt(n), tone: 'loss' });
    }
    // lifestyle creep: the step is judged on peak followers before this week's churn
    const stepBefore = livingStep(S); S.peakFollowers = Math.max(S.peakFollowers || 0, totalFollowers(S));
    const stepNow = livingStep(S);
    if (stepNow > stepBefore) log.feed.push({ emoji: '🏠', kind: 'bad', text: LIFESTYLE_MSG[stepNow - 1].replace('{cost}', money(livingCost(S))) });
    const oh = overhead(S);
    const passiveR = Math.round(passive); S.cash += passiveR; S.grossEarned += passiveR;
    S.cash -= oh; S.peakOverhead = Math.max(S.peakOverhead, oh);
    // churn
    let lost = 0, worstIdle = 0;
    activePlats(S).forEach(p => {
      const idleRate = idleChurnRate(S, p); worstIdle = Math.max(worstIdle, idleRate);
      const trendLoss = Math.round(p.trendFollowers * (idleRate || CONFIG.churnTrend));
      const baseLoss = Math.round((p.followers - p.trendFollowers) * (idleRate || CONFIG.churnBase));
      p.trendFollowers = Math.max(0, p.trendFollowers - trendLoss);
      p.followers = Math.max(0, p.followers - trendLoss - baseLoss);
      lost += trendLoss + baseLoss;
    });
    if (lost > totalFollowers(S) * 0.01) {
      if (worstIdle >= 0.07) log.feed.push({ emoji: '🫥', text: `${fmt(lost)} people left this week. They didn't unfollow in protest. They forgot you exist.`, kind: 'bad' });
      else log.feed.push({ emoji: '👋', text: `${fmt(lost)} people left this week. Trend-chasers go first; silence pushes out the rest.`, kind: 'bad' });
    }
    // heat / fatigue decay
    const heatKeep = S.hires.analyst ? 0.9 : 0.82;
    PORDER.forEach(k => { const p = S.plats[k]; p.heat = clamp(Math.round(p.heat * heatKeep) - 2, 0, 100); p.fatigue = clamp(p.fatigue - CONFIG.repeatDecay, 0, 100); });
    // stress: judge the band + burnout streak on the stress you ended the week's work at,
    // THEN recover. (Judging after recovery would make redline unreachable: 100 - 12 < 90.)
    const band = stressBand(S);
    if (band !== S.band) { log.feed.push({ ...BAND_MSG[band] }); S.band = band; }
    S.redlineStreak = band === 'redline' ? S.redlineStreak + 1 : 0;
    addStress(S, -(CONFIG.stressRecover + S.slots.content * CONFIG.stressRecoverPerEmptySlot));
    S.newFollowers = 0;
    // seed for the platform-dependency arc: a creator who bet on one channel by the business act
    if (act(S) >= 2 && !S.flags.concentrated) {
      const tot = totalFollowers(S), top = strongest(S);
      if (tot > 3000 && top && top.followers / tot >= 0.65) S.flags.concentrated = S.week;
    }
    return log;
  }
  function drawEvent(S) {
    const deck = EVENTS.filter(e =>
         (!e.cond || e.cond(S))
      && (e.minWeek == null || S.week >= e.minWeek)
      && (e.maxWeek == null || S.week <= e.maxWeek)
      && (e.repeatable || !S.seenEvents.includes(e.id)));
    if (!deck.length) return null;
    // "choices that echo": an eligible consequence of a past choice (priority) is weighted up, so it
    // is likely to land within a few event rolls — a decision comes back to find you — without a
    // multi-flag player's whole event stream collapsing into nothing but consequences.
    const pool = [];
    deck.forEach(e => { pool.push(e); if (e.priority && e.priority(S)) { pool.push(e); pool.push(e); } });   // ~3× weight
    return pick(pool);
  }
  function rollEvent(S) {
    // The Act III exit is guaranteed once, late in the run — it pre-empts the random roll.
    if (S.week === CONFIG.exitWeek && !S.flags.exitOffered) {
      S.flags.exitOffered = S.week;
      const ev = EVENTS.find(e => e.id === 'the-exit'); S.seenEvents.push(ev.id);
      return ev;
    }
    if (!(S.week >= 2 && chance(CONFIG.eventChance))) return null;
    const ev = drawEvent(S);
    if (ev && !ev.repeatable && !S.seenEvents.includes(ev.id)) S.seenEvents.push(ev.id);
    return ev;
  }
  function applyEventChoice(S, ev, i) { return ev.choices[i].apply(S); }
  function advanceWeek(S) { S.week++; S.slots = { content: contentSlots(S), business: CONFIG.slotsBusiness }; S.crossUsed = false; PORDER.forEach(k => { S.plats[k].weekPosts = 0; }); }

  function checkEndings(S) {
    if (S.over && S.endKey) return S.endKey;   // honor an ending an event already decided (the Act III exit)
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
    burnout: { emoji: '🕯️', kicker: 'Burnout', title: 'You burned all the way out.', blurb: 'The stress redlined and stayed there. Feeding {n} platform{s} at once, you stopped being able to make anything at all.', blurb1: 'The stress redlined and stayed there. You kept posting through it, week after week, until there was nothing left to post with.', lesson: 'You can feed every platform, or you can last. The ones still here took the week off.' },
    sellout: { emoji: '🤑', kicker: 'Sold out', title: 'You became an ad in human form.', blurb: 'The bag got too tempting, too often. Rich and technically famous, but nobody remembers what you actually make.', lesson: 'Every deal was a withdrawal from trust. You overdrew, and the only product left was you.' },
    star: { emoji: '🌟', kicker: 'Viral star', title: 'You went fully mainstream.', blurb: '{star}-plus and climbing across platforms. Brands, press, maybe a Netflix producer in your DMs.', lesson: 'You did the work, then the algorithm did you a favor. Talent loads the dice. Luck rolls them.' },
    goat: { emoji: '👑', kicker: 'G.O.A.T.', title: 'Biggest creator on the planet.', blurb: '{goat}-plus followers and a footprint on every surface. You didn\'t win the game. You became it.', lesson: 'Stamina, taste, and an absurd amount of luck. Almost nobody gets here. Run it again and watch it not happen.' },
    legend: { emoji: '🏆', kicker: 'Niche legend', title: 'You built something that lasts.', blurb: "Not the biggest. Beloved, paid, and still sleeping at night. A loyal audience and a life you didn't have to torch to keep it.", lesson: "This is the good ending. It just doesn't trend." },
    faded: { emoji: '🌫️', kicker: 'Faded out', title: 'You slowly faded into the feed.', blurb: 'A year in, the numbers never took off. Not a disaster, not a triumph. The algorithm just stopped mentioning you.', lesson: 'This is the ending most people get. Nobody writes about it, which is the whole point.' },
  };

  // Ending copy with the run's numbers filled in.
  // How you get there, in one line each. {legend}/{star}/{goat}/{floor}/{deals}/{rep} are filled from CONFIG.
  const ENDING_HINT = {
    cancelled: 'Reputation at zero. Escalate every pile-on, take the crypto bag, deny everything.',
    bankrupt: 'Cash below {floor}. Sign for a space you can’t fill yet and wait.',
    burnout: 'Three redline weeks in a row. Fill every slot, every week, and never leave one empty.',
    sellout: '{deals} brand deals with reputation under {rep} and money in the bank. Rich, technically.',
    star: '{star} followers by week 52. Ride every hit, chase the trends, hire the designer.',
    goat: '{goat} followers. The building, a full team, three posts a week, and an absurd amount of luck.',
    legend: '{legend} followers with reputation {lrep} or better. Evergreen, engage, rest, don’t sell.',
    faded: 'Make it to week 52 without going broke, burning out, selling out or blowing up. Most people do. It’s the honest one.',
  };
  function endingHint(key) { return (ENDING_HINT[key] || '').replace('{floor}', money(CONFIG.bankruptFloor)).replace('{deals}', CONFIG.sellDeals).replace('{rep}', CONFIG.sellRepUnder)
    .replace('{star}', fmt(CONFIG.starAt)).replace('{goat}', fmt(CONFIG.goatAt)).replace('{legend}', fmt(CONFIG.legendAt)).replace('{lrep}', CONFIG.legendRep); }
  function endingText(S, key) { const e = ENDINGS[key]; const n = activePlats(S).length;
    // "feeding N platforms at once" only makes sense at 2+; use the singular variant at 1
    const raw = (n === 1 && e.blurb1) ? e.blurb1 : e.blurb;
    return Object.assign({}, e, { blurb: raw.replace('{n}', n).replace('{s}', n === 1 ? '' : 's').replace('{star}', fmt(CONFIG.starAt)).replace('{goat}', fmt(CONFIG.goatAt)) }); }

  return {
    CONFIG, NICHES, PLATFORMS, PORDER, TIERS, TIERCUT, ANGLES, AORDER, TOPICS, THUMBS, thumbFor, HIRES, HORDER, STUDIOS, ENDINGS, EVENTS,
    setRng, rnd, rint, clamp, chance, pick, fmt, money,
    newState, activePlats, totalFollowers, strongest, platTier, platPolish, silentWeeks, silentWeeksAll, idleChurnRate,
    ACTS, act,
    useSlot, addStress, stressBand, hasStudio, studio, contentSlots, hireCount, hireCap, payroll, overhead, overheadBreakdown, overheadAt, hireInfo, livingStep, livingCost, taxOwed,
    viewsMult, stressCost, upgradeInfo, repHit, loseFollowers,
    pickTopic, postCard, previewPost, buildHand, applyMove, doPost, startPlatform, crosspost, crossOptions, biz,
    settleWeek, drawEvent, rollEvent, applyEventChoice, advanceWeek, checkEndings, endingText, endingHint,
  };
});
