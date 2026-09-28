/*
 * 80% OF YOUR COMMENTS ARE ROBOTS: data (content only, no mechanics)
 * ------------------------------------------------------------------
 * Cards, player archetypes, end archetypes, events, and the SOURCES table
 * every evidence stamp resolves to. Mechanics and stamps for levers live in
 * robot-comments-engine.js CONFIG. Card titles are drafts until the copy pass.
 * Spec: docs/superpowers/specs/2026-09-28-robot-comments-design.md
 * ------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RobotData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SOURCES = {
    feedsr:     { tier: 'proven', cite: 'Hertel, Srivastava et al., An Industrial-Scale Sequential Recommender for LinkedIn Feed Ranking, arXiv 2602.12354 (v3, Sep 2026)', url: 'https://arxiv.org/abs/2602.12354' },
    feedsr1:    { tier: 'proven', cite: 'Same paper, v1 (Feb 2026). This passage was removed in v2 and v3.', url: 'https://arxiv.org/abs/2602.12354v1' },
    danchev:    { tier: 'proven', cite: "Danchev, Engineering the next generation of LinkedIn's Feed, LinkedIn Engineering, 12 Mar 2026", url: 'https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed' },
    jurka26:    { tier: 'proven', cite: 'Jurka, Updates to The LinkedIn Feed Focusing on Authentic, Relevant Conversations, 12 Mar 2026', url: 'https://www.linkedin.com/pulse/updates-linkedin-feed-focusing-authentic-relevant-tim-jurka-umwnc' },
    jurka24:    { tier: 'proven', cite: 'Jurka, LinkedIn feed update, 28 Feb 2024', url: 'https://www.linkedin.com/pulse/how-linkedin-focused-surfacing-right-content-worlds-tim-jurka-bvzhc' },
    dwell2020:  { tier: 'proven', cite: 'Dangi et al., Understanding dwell time to improve LinkedIn feed ranking, LinkedIn Engineering, 2020', url: 'https://www.linkedin.com/blog/engineering/feed/understanding-feed-dwell-time' },
    lirank:     { tier: 'proven', cite: 'Borisyuk et al., LiRank, KDD 2024', url: 'https://arxiv.org/abs/2402.06859' },
    brew360:    { tier: 'proven', cite: 'Firooz et al., 360Brew, arXiv 2501.16450 (withdrawn; self-described pre-production research)', url: 'https://arxiv.org/abs/2501.16450' },
    authoredup: { tier: 'measured', cite: 'AuthoredUp, Best Performing Content on LinkedIn: 3M+ posts, personal profiles, Mar 2025 to Feb 2026. Vendor data, relative to each profile median.', url: 'https://authoredup.com/blog/best-performing-content-on-linkedin' },
    vdb:        { tier: 'measured', cite: 'van der Blom, Algorithm Insights 2026 (paid report). Figures from his Creator Science interview and his public LinkedIn newsletter, 26 Jul 2026.', url: 'https://podcast.creatorscience.com/richard-van-der-blom-2/' },
    interact:   { tier: 'measured', cite: 'Interact, Quiz Conversion Rate Report (updated 8 Sep 2026). Vendor platform data, 100M+ leads.', url: 'https://tryinteract.com/blog/quiz-conversion-rate-report/' },
    jason107:   { tier: 'measured', cite: "Jason Nellis, 107 of his own LinkedIn posts, 2014 to 2026. One account, engagement not reach, single coder.", url: null },
    ordinal:    { tier: 'disputed', cite: 'Ordinal, LinkedIn link penalty study, 900k+ posts. Vendor with a commercial interest; method unpublished; says personal profiles see almost no penalty.', url: 'https://www.tryordinal.com/blog/linkedin-link-penalty-study' },
    dataslayer: { tier: 'invented', cite: 'Dataslayer, LinkedIn algorithm February 2026 (example of the folklore: 60% link penalty, 0.07% polls)', url: 'https://www.dataslayer.ai/blog/linkedin-algorithm-february-2026-whats-working-now' },
    digitalapplied: { tier: 'invented', cite: 'Digital Applied, LinkedIn algorithm 2026 guide (example of the folklore: 60% link penalty, Depth Score)', url: 'https://www.digitalapplied.com/blog/linkedin-algorithm-2026-engagement-strategy-guide' },
    linkboost:  { tier: 'invented', cite: 'Linkboost, what content performs best 2026 (example of the folklore: Depth Score, dwell-bucket rates)', url: 'https://www.linkboost.co/blog/what-content-performs-best-linkedin-2026/' },
    vdb80:      { tier: 'invented', cite: 'van der Blom, Creator Science interview (at 23:02): an estimate that about 80% of the early comments on his own posts are AI-written. An anecdote about one account, not a study finding. It circulates as a statistic.', url: 'https://podcast.creatorscience.com/richard-van-der-blom-2/' },
    nosource:   { tier: 'invented', cite: "No primary source or study found (checked Sep 2026). LinkedIn's own engagement-bait examples (Jurka, 12 Mar 2026) do not include it.", url: 'https://www.linkedin.com/pulse/updates-linkedin-feed-focusing-authentic-relevant-tim-jurka-umwnc' },
    dhelin:     { tier: 'invented', cite: 'Dhélin, The LinkedIn Algorithm 2026: what is proven, what is measured, what is invented, Fast Growth Advisors, Jul 2026', url: 'https://fast-growth.fr/en/white-paper/linkedin-algorithm-2026/' },
  };

  // Player setups (spec §4). headline_fit values live in engine CONFIG.
  const ARCHETYPES = {
    seed:       { name: 'Seed-stage founder',  connections: 800,   headline: 'Names the product category' },
    seriesb:    { name: 'Series B exec',        connections: 4000,  headline: 'A title and a company' },
    second:     { name: 'Second-time founder',  connections: 12000, headline: 'A vague mission statement' },
    fractional: { name: 'Fractional operator',  connections: 2500,  headline: 'Lists four services' },
  };

  // End archetypes (spec §9). Diagnoses and most taglines arrive in the copy pass.
  const OUTCOMES = {
    'pod-casualty':          { name: 'The Pod Casualty' },
    'ghost':                 { name: 'The Ghost' },
    'generalist':            { name: 'The Generalist' },
    'broadcaster':           { name: 'The Broadcaster' },
    'fingerprinted-founder': { name: 'The Fingerprinted Founder' },
    'control-group':         { name: 'The Control Group', tagline: 'Every experiment needs one.' },
  };

  const EVENTS = [
    { id: 'swarm',   name: 'The swarm' },
    { id: 'reset',   name: 'The reset' },
    { id: 'gravity', name: 'Adjacent gravity' },
    { id: 'audit',   name: 'The audit' },
  ];

  const R = (id, fmt, topic, hook, sub, cta, title) => ({ id, fmt, topic, hook, sub, cta, title, bait: false });
  const B = (id, fmt, topic, hook, sub, cta, title, stamp, src, extra) =>
    Object.assign({ id, fmt, topic, hook, sub, cta, title, bait: true, stamp, src, mag: null }, extra || {});

  const CARDS = [
    // text (10)
    R('t01', 'text', 'on', 'claim', 'named', 'question', "Our churn doubled after a 20% price rise. Here are the three accounts that left, and why."),
    R('t02', 'text', 'on', 'claim', 'personal', 'none', "In week nine I drafted the email shutting the company down. I never sent it."),
    R('t03', 'text', 'on', 'scene', 'generic', 'none', "There is a particular silence when a roadmap meeting runs past the hour."),
    R('t04', 'text', 'adj', 'claim', 'generic', 'question', "Hiring your first salesperson before product-market fit costs a year. What did it cost you?"),
    R('t05', 'text', 'off', 'scene', 'personal', 'none', "My sourdough starter has now outlived two of my companies."),
    R('t06', 'text', 'on', 'question', 'generic', 'none', "Is anyone else killing annual contracts?"),
    R('t07', 'text', 'on', 'claim', 'promo', 'linkbody', "Version 2 is live. Everything that changed, at the link below."),
    R('t08', 'text', 'adj', 'listicle', 'generic', 'none', "Five things nobody tells you about your first board meeting"),
    R('t09', 'text', 'off', 'claim', 'generic', 'bait', "The office is dead. Agree? Comment YES."),
    R('t10', 'text', 'on', 'claim', 'named', 'linkcomment', "One customer interview rewrote our pricing page. Full notes in the first comment."),
    // image (7)
    R('i01', 'image', 'on', 'claim', 'named', 'question', "Our pipeline by week, on one slide. Where would you cut first?"),
    R('i02', 'image', 'on', 'scene', 'personal', 'none', "The whiteboard from the night we decided to pivot"),
    R('i03', 'image', 'adj', 'claim', 'personal', 'question', "My co-founder and I have argued about this chart for a month. Who is right?"),
    R('i04', 'image', 'off', 'scene', 'generic', 'none', "The view from the conference hotel, 6am"),
    R('i05', 'image', 'on', 'listicle', 'generic', 'bait', "Seven metrics every founder should track. Comment YES and I will send the template."),
    R('i06', 'image', 'adj', 'claim', 'named', 'none', "Three operators who changed how I run a company this year, and what each one said"),
    R('i07', 'image', 'on', 'claim', 'promo', 'linkbody', "We are hiring a founding engineer. Team photo, role and link below."),
    // document (5)
    R('d01', 'document', 'on', 'claim', 'named', 'question', "Our whole sales playbook, 12 pages, including the parts that failed. What is missing?"),
    R('d02', 'document', 'on', 'listicle', 'generic', 'none', "A 10-slide guide to our category"),
    R('d03', 'document', 'adj', 'claim', 'named', 'none', "Every pricing page in our market, side by side, and what each one gets wrong"),
    R('d04', 'document', 'on', 'scene', 'promo', 'linkcomment', "It started with a spreadsheet nobody trusted. A customer case study (link in comments)"),
    R('d05', 'document', 'off', 'listicle', 'generic', 'none', "My marathon training plan, as a carousel"),
    // short video (4)
    R('s01', 'shortvideo', 'on', 'claim', 'named', 'question', "60 seconds on the $400k deal we walked away from"),
    R('s02', 'shortvideo', 'on', 'scene', 'generic', 'none', "A day in the life of a founder"),
    R('s03', 'shortvideo', 'off', 'claim', 'personal', 'none', "I quit coffee for 30 days. Here is what happened to my calendar."),
    R('s04', 'shortvideo', 'adj', 'question', 'generic', 'bait', "Can you guess our burn rate? Comment YES for the answer."),
    // long video (3)
    R('l01', 'longvideo', 'on', 'claim', 'named', 'question', "A five-minute teardown of our worst launch, with the numbers"),
    R('l02', 'longvideo', 'adj', 'scene', 'personal', 'none', "Full conversation: my first board member on the mistake I made twice"),
    R('l03', 'longvideo', 'on', 'scene', 'promo', 'linkbody', "Webinar recording: the future of our category (link below)"),
    // poll (3)
    R('p01', 'poll', 'on', 'question', 'generic', 'none', "Poll: what is your biggest go-to-market problem right now?"),
    R('p02', 'poll', 'adj', 'question', 'generic', 'none', "Poll: office, hybrid or remote?"),
    R('p03', 'poll', 'off', 'question', 'generic', 'none', "Poll: best airport lounge in Europe?"),
    // article (3)
    R('a01', 'article', 'on', 'claim', 'named', 'question', "What 40 customer calls taught us about pricing. The long version."),
    R('a02', 'article', 'on', 'scene', 'generic', 'none', "Some thoughts on the state of our industry"),
    R('a03', 'article', 'adj', 'claim', 'personal', 'none', "The year I stopped managing and started leading"),
    // reshare (5)
    R('r01', 'reshare', 'on', 'claim', 'named', 'none', "Resharing a customer's post about us, with one line on what they left out"),
    R('r02', 'reshare', 'adj', 'scene', 'generic', 'none', "Resharing an industry report without comment"),
    R('r03', 'reshare', 'off', 'claim', 'generic', 'none', "Resharing a viral post about AI replacing everyone's job"),
    R('r04', 'reshare', 'on', 'claim', 'promo', 'linkbody', "Resharing our own launch announcement, link included"),
    R('r05', 'reshare', 'adj', 'question', 'generic', 'question', "Resharing a friend's hiring post. Know anyone for this?"),

    // bait (7): the title promises a shortcut; the stamp reveals after play (spec §6)
    B('bait-precomment', 'text', 'on', 'claim', 'generic', 'none', 'Comment on three posts fifteen minutes before publishing (+21%)', 'invented', 'dhelin', { extraCost: 0.5 }),
    B('bait-poll', 'poll', 'on', 'question', 'generic', 'none', 'Add a poll for 1.78x reach', 'measured', 'authoredup'),
    B('bait-pod', 'text', 'on', 'claim', 'generic', 'none', 'Join a pod of twelve peers who engage in the first hour', 'proven', 'jurka26', { mag: 'ours' }),
    B('bait-firstcomment', 'text', 'on', 'claim', 'promo', 'linkcomment', 'Put the link in the first comment to dodge the 60% penalty', 'invented', 'dataslayer'),
    B('bait-hashtags6', 'text', 'on', 'claim', 'generic', 'none', 'Use six hashtags for discoverability', 'measured', 'authoredup', { mag: 'ours' }),
    B('bait-thoughts', 'text', 'on', 'claim', 'generic', 'none', 'Ask "Thoughts?" at the end', 'invented', 'nosource'),
    B('bait-gatedgame', 'text', 'on', 'claim', 'promo', 'linkbody', 'Build a gated game on your website to collect emails', 'measured', 'interact', { extraCost: 2 }),
  ];

  const deepFreeze = o => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
    return o;
  };
  return deepFreeze({ SOURCES, ARCHETYPES, OUTCOMES, EVENTS, CARDS });
});
