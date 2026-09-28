# 80% of Your Comments Are Robots: Copy Implementation Plan (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every player-facing string into the repo, linted against the house rules and tied to the engine so no stamp can appear without a why-line.

**Architecture:** One new UMD file, `robot-comments-copy.js` (global `RobotCopy`), holds all copy except card titles. Card titles stay in `robot-comments-data.js` and are rewritten in place. The UI (Plan 3) reads only these two files for text. Tests extend `tools/robot-comments-test.js`: every lever key the engine can return must have a why-line, every outcome needs a diagnosis, and all copy passes a house-rules lint.

**Tech Stack:** Vanilla JS, Node `assert`. Spec: `docs/superpowers/specs/2026-09-28-robot-comments-design.md` (§1, §8, §9, §10, §11). Branch `robot-comments`; do not push.

**Checkpoint:** one, after Task 3. Task 0 is a review gate: **Jason edits the copy in this file before Task 1 runs.** Resume with "continue Robot Comments plan 2 from task N".

**House rules (spec §11), enforced by a test:** no em or en dashes; no exclamation marks; no sentence opening with an -ly adverb; no "fast-paced"; no praise of the player. Two registers: flat and sourced (why-lines, diagnoses, stamps) and dry/absurdist (events, taglines, the one bait card that works). Why-lines speak in Jason's voice ("my 107 posts").

---

## File map

| File | Change |
|---|---|
| Create `robot-comments-copy.js` | All copy: intro, setup, labels, why-lines, events, outcomes, end screen, resume card, title self-stamp. |
| Modify `robot-comments-data.js` | New `vdb80` source; 40 regular card titles rewritten (ids and dimensions unchanged, so the engine version does not change). |
| Modify `tools/robot-comments-test.js` | Copy tests. |
| Modify spec | §1 title stamp source; §18 copy item closed. |

---

### Task 0: Jason reviews the copy (gate) (approved as drafted, 2026-09-28)

- [x] **Step 1:** Jason reads the code blocks in Task 1 Step 3 (`robot-comments-copy.js`) and Task 2 Step 1 (card titles) and edits them in place in this plan file. Anything he deletes or rewrites is what ships. The only constraints: keep the object keys, keep the disclosure line verbatim, keep diagnoses 40 to 80 words, and keep the house rules above.
- [x] **Step 2:** Commit his edits: `git commit -am "Robot Comments plan 2: Jason's copy edits"`.

---

### Task 1: Copy file and tests

**Files:**
- Modify: `robot-comments-data.js` (add one source)
- Create: `robot-comments-copy.js`
- Modify: `tools/robot-comments-test.js`

- [ ] **Step 1: Write the failing tests**

At the top of `tools/robot-comments-test.js`, after `const D = require('../robot-comments-data.js');`, add:

```js
const C = require('../robot-comments-copy.js');
```

Insert above the runner line:

```js
// ---------------------------------------------------------------- copy (plan 2)
const allStrings = (o, out = []) => {
  if (typeof o === 'string') out.push(o);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) allStrings(v, out);
  return out;
};

test('copy: every lever a card or event can reveal has a why-line', () => {
  const keys = new Set();
  for (const k of D.CARDS) for (const supp of [1, 0.5]) keys.add(E.leverFor(k, { supp, cadence: 1 }).key);
  for (const e of D.EVENTS) keys.add('event:' + e.id);
  for (const key of keys) assert.ok(typeof C.why[key] === 'string' && C.why[key].length > 20, 'missing why-line: ' + key);
  // Extra why-lines are allowed (e.g. hook:claim may never be a card's dominant lever today), but must be well-formed keys.
  for (const key of Object.keys(C.why)) assert.ok(/^(format|hook|sub|cta|event):[a-z]+$|^suppressed$|^bait-[a-z0-9]+$/.test(key), 'odd why-line key: ' + key);
});

test('copy: outcomes match the data and carry a 40-80 word diagnosis', () => {
  for (const id of Object.keys(D.OUTCOMES)) {
    const o = C.outcomes[id];
    assert.ok(o, 'missing outcome ' + id);
    assert.strictEqual(o.name, D.OUTCOMES[id].name);
    assert.ok(o.tagline && o.tagline.length > 5, id);
    const n = o.diagnosis.trim().split(/\s+/).length;
    assert.ok(n >= 40 && n <= 80, `${id}: ${n} words`);
  }
  assert.strictEqual(C.outcomes['control-group'].tagline, D.OUTCOMES['control-group'].tagline);
});

test('copy: events have a body, consequences and an audit line per archetype', () => {
  for (const e of D.EVENTS) {
    const ev = C.events[e.id];
    assert.ok(ev && ev.name === e.name, e.id);
    assert.ok(ev.body || ev.bodyByArchetype, e.id);
    assert.ok(Object.keys(ev.consequence).length >= 1, e.id);
  }
  for (const a of Object.keys(D.ARCHETYPES)) assert.ok(C.events.audit.bodyByArchetype[a], 'audit body for ' + a);
  assert.ok(C.events.gravity.consequence.clear && C.events.gravity.consequence.blurred);
  assert.ok(C.events.audit.consequence.up && C.events.audit.consequence.down);
});

test('copy: labels cover every dimension, engagement, metric, band and stamp', () => {
  const L = C.labels;
  for (const k of Object.keys(E.CONFIG.formats)) assert.ok(L.formats[k], 'format ' + k);
  for (const k of ['on', 'adj', 'off']) assert.ok(L.topics[k], 'topic ' + k);
  for (const k of Object.keys(E.CONFIG.hooks)) assert.ok(L.hooks[k], 'hook ' + k);
  for (const k of Object.keys(E.CONFIG.substance)) assert.ok(L.substance[k], 'substance ' + k);
  for (const k of Object.keys(E.CONFIG.cta)) assert.ok(L.cta[k], 'cta ' + k);
  for (const k of E.CONFIG.engagements) assert.ok(L.engagement[k], 'engagement ' + k);
  for (const k of ['impressions', 'held', 'contributions', 'visits', 'dms', 'coherence']) assert.ok(L.metrics[k], 'metric ' + k);
  for (const k of ['cold', 'warm', 'working', 'hot']) assert.ok(L.bands[k], 'band ' + k);
  for (const k of ['proven', 'measured', 'disputed', 'invented']) assert.ok(L.stamps[k], 'stamp ' + k);
  for (const b of E.CONFIG.budgets) assert.ok(C.setup.budgets[b], 'budget ' + b);
});

test('copy: the disclosure line is verbatim', () => {
  assert.strictEqual(C.end.disclosure, "The structure of this model comes from LinkedIn's published engineering. The weights are ours. Anyone who tells you they have the weights is selling something.");
});

test('copy: the title self-stamp is Invented and cites an invented-tier source', () => {
  assert.strictEqual(C.titleStamp.stamp, 'invented');
  assert.strictEqual(D.SOURCES[C.titleStamp.src].tier, 'invented');
  assert.ok(C.titleStamp.why.length > 20);
});

test('copy: house rules hold across all copy and card titles', () => {
  const strings = allStrings(C).concat(D.CARDS.map(k => k.title));
  assert.ok(strings.length > 150);
  for (const s of strings) {
    assert.ok(!/[—–]/.test(s), 'em/en dash: ' + s);
    assert.ok(!s.includes('!'), 'exclamation mark: ' + s);
    assert.ok(!/fast-paced/i.test(s), 'banned phrase: ' + s);
    assert.ok(!/(^|[.?:]\s+)[A-Z][a-z]+ly\b/.test(s), 'adverb sentence opener: ' + s);
  }
  for (const k of D.CARDS) assert.ok(k.title.length <= 100, 'title too long: ' + k.id);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:rc`
Expected: crash with `Cannot find module '../robot-comments-copy.js'`.

- [ ] **Step 3: Add the source and create the copy file**

In `robot-comments-data.js`, add this entry directly above `nosource`:

```js
    vdb80:      { tier: 'invented', cite: 'van der Blom, Creator Science interview (at 23:02): an estimate that about 80% of the early comments on his own posts are AI-written. An anecdote about one account, not a study finding. It circulates as a statistic.', url: 'https://podcast.creatorscience.com/richard-van-der-blom-2/' },
```

Create `robot-comments-copy.js`:

```js
/*
 * 80% OF YOUR COMMENTS ARE ROBOTS: copy (every player-facing string except card titles)
 * ------------------------------------------------------------------
 * Two registers (spec §11): flat and sourced for why-lines, diagnoses and stamps;
 * dry and absurdist for events, taglines and the one bait card that works.
 * House rules (a test enforces them): no em or en dashes, no exclamation marks,
 * no sentence that opens with an -ly adverb, no praise of the player.
 * Card titles live in robot-comments-data.js; citations live in RobotData.SOURCES.
 * Tokens in {braces} are filled by the UI.
 * ------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RobotCopy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COPY = {
    title: '80% of Your Comments Are Robots',
    tagline: 'And they love you',
    intro: [
      'You have twelve weeks, a headline, and a feed that reads both.',
      'Most of what you have been told about the feed is wrong. Some of what you will be offered here is bait.',
    ],

    // Shown as an empty stamp beside the title on the intro, stamped on the end screen.
    titleStamp: {
      stamp: 'invented',
      src: 'vdb80',
      why: 'One researcher, describing his own posts, in one interview. It became a statistic. So did this title.',
    },

    setup: {
      archetypeHeading: 'Who are you',
      budgetHeading: 'Hours a week for LinkedIn',
      budgets: { 1: '1 hour', 3: '3 hours', 6: '6 hours' },
      budgetHint: 'Founders pick 1 or 3.',
      start: 'Start week 1',
      connections: '{n} connections',
    },

    resume: {
      line: 'Week {week} of 12 · {archetype} · {budget}',
      resume: 'Resume',
      restart: 'Start over',
      lastResult: 'See your last result',
    },

    week: {
      header: 'Week {week} / 12',
      hoursLeft: '{hours}h left',
      handHeading: 'Pick a post',
      engagementHeading: 'Comment this week',
      post: 'Post',
      skip: 'Skip this week',
      overBudget: 'Needs {hours}h',
      next: 'Next week',
      toResults: 'See your twelve weeks',
      sourceLink: 'Read the source',
      oursNote: 'The size of this effect is ours.',
    },

    labels: {
      stamps: { proven: 'Proven', measured: 'Measured', disputed: 'Disputed', invented: 'Invented' },
      stampMeaning: {
        proven: 'LinkedIn published it.',
        measured: 'An independent study with a published sample.',
        disputed: 'Credible studies disagree.',
        invented: 'Circulates widely, traces to nothing.',
      },
      formats: {
        text: 'Text', image: 'Image', document: 'Document', shortvideo: 'Short video',
        longvideo: 'Long video', poll: 'Poll', article: 'Article', reshare: 'Reshare',
      },
      topics: { on: 'On-cluster', adj: 'Adjacent', off: 'Off-cluster' },
      hooks: { claim: 'Claim first', scene: 'Scene-setting', question: 'Question first', listicle: 'Listicle' },
      substance: { named: 'Named specifics', generic: 'Generic advice', personal: 'Personal stakes', promo: 'Promotional' },
      cta: { question: 'Specific question', none: 'No CTA', linkbody: 'Link in body', linkcomment: 'Link in comment', bait: 'Comment YES' },
      engagement: {
        none: 'Don\'t comment',
        cluster: 'In your cluster · 0.5h',
        popular: 'On what\'s popular · 0.5h',
      },
      metrics: {
        impressions: 'Impressions', held: 'Held attention', contributions: 'Contributions',
        visits: 'Profile visits', dms: 'DMs', coherence: 'Fingerprint',
      },
      bands: { cold: 'Cold', warm: 'Warm', working: 'Working', hot: 'Hot' },
    },

    // Keyed by the lever key the engine returns (leverFor / resolveEvent). Flat and sourced.
    why: {
      'format:text': 'Text posts reach 1.07x a typical post and draw 0.78x the engagement (AuthoredUp, 3M posts, each profile against its own median).',
      'format:image': 'Images reach 1.20x a typical post and draw 1.33x the engagement, the best engagement of any format (AuthoredUp, 3M posts).',
      'format:document': 'Documents reach 1.39x a typical post, second only to polls, and draw 1.30x the engagement (AuthoredUp, 3M posts).',
      'format:shortvideo': 'Video reach fell 36% in a year and video now reaches 0.86x a typical post; clips under 30 seconds do a little worse (AuthoredUp).',
      'format:longvideo': 'Videos over three minutes reach 1.21x the average video (AuthoredUp, 37k videos). Long-form still works. It also costs four hours.',
      'format:poll': 'Polls reach 1.78x a typical post and draw 0.37x the engagement (AuthoredUp, 3M posts). Wide and shallow, and pipeline follows attention, not reach.',
      'format:article': 'Articles reach 0.69x a typical post and draw 0.44x the engagement (AuthoredUp). Three hours for the least-read format apart from reshares.',
      'format:reshare': 'Reshares reach 0.29x a typical post and draw 0.22x the engagement (AuthoredUp). Cheap, and priced accordingly.',
      'hook:claim': 'Posts that opened with the point did about 10% better than posts that opened with a scene, in my own 107 posts. A small effect, from one account.',
      'hook:scene': 'Opening with a scene instead of the point cost about 10% in my own 107 posts. One account, and engagement rather than reach.',
      'sub:named': 'Named people, companies and numbers drew about 1.2x the engagement of generic advice in my 107 posts. The gap has narrowed in 2025 and 2026.',
      'sub:personal': 'Personal stories with real stakes were 12% of my posts and 53% of my engagement. The game counts them at 2x, discounted for the congratulations that inflate the raw figure.',
      'sub:promo': 'Promotional posts drew about 0.75x the engagement of my median post, across 52 of them.',
      'cta:question': 'A specific, answerable closing question drew a median of 9 comments against 2 without one, in my posts. Eight posts, so treat it as direction.',
      'cta:linkbody': 'Disputed. Van der Blom measures 16% less reach for posts with an external link; Ordinal says personal profiles see almost none. Modelled here as readers leaving for the link.',
      'cta:linkcomment': 'Disputed. Nobody has published how a link in the first comment behaves. Ordinal, which sells a first-comment tool, says personal profiles barely see a link penalty either way.',
      'cta:bait': 'LinkedIn says it is filtering engagement bait and quotes "Comment \'Yes\' if you agree" as an example (Jurka, March 2026). The 0.6x is ours.',
      'suppressed': 'Your reach was cut this week by something earlier: a pod, or engagement bait twice in three weeks. LinkedIn says it acts on both (Jurka, March 2026). The size of the cut is ours.',

      'bait-precomment': 'The +21% traces to nothing anyone has published; a 2026 review of LinkedIn claims could not find a source for it. It cost you half an hour.',
      'bait-poll': 'Measured, and a trap. Polls reach 1.78x a typical post and draw 0.37x the engagement (AuthoredUp, 3M posts). Everyone saw it. Nobody wrote.',
      'bait-pod': 'LinkedIn says it is making engagement pods ineffective (Jurka, March 2026). The comments were real people being polite. Your next two weeks of reach are halved; that size is ours.',
      'bait-firstcomment': 'The 60% link penalty comes from vendor blogs, not data. The link effect itself is disputed: van der Blom measures 16% less reach, Ordinal almost none for personal profiles.',
      'bait-hashtags6': 'AuthoredUp found hashtags do not help, and that more than six "can seriously sabotage your reach". They published a direction, not a number; the 15% here is ours.',
      'bait-thoughts': 'No study measures it, and LinkedIn\'s own examples of engagement bait do not mention it. It did nothing. Nobody replied to the question either.',
      'bait-gatedgame': 'This one works. Interact reports that 40.1% of quiz starts become leads, across 100M+ leads. Interact sells quizzes. You are playing one.',

      'event:swarm': 'LinkedIn says it is limiting what automated comments and pods can do for a post (Jurka, March 2026). Forty comments, no distribution.',
      'event:reset': 'Van der Blom says reach for active creators is down about 60% over two years, speaking about his paid 2026 report. LinkedIn says it chose relevance over reach.',
      'event:gravity': 'LinkedIn\'s retrieval matches posts on meaning, and its language model relates topics nobody told it were related (Danchev, March 2026). The 8% is ours.',
      'event:audit': 'Your headline, company and industry are part of the text that describes every post you write (Danchev, March 2026). The size of the effect is ours.',
    },

    events: {
      swarm: {
        name: 'The swarm',
        body: 'Your best post gets 40 comments in five minutes. Thirty-two are written by machines. They are very supportive. Thirty-two of forty is 80%, which you may have seen somewhere.',
        consequence: { any: 'Contributions spike. Held attention does not. The model distributes nothing.' },
      },
      reset: {
        name: 'The reset',
        body: 'Reach dropped 40% for everyone this week. A vendor publishes a thread explaining why. The thread contains a poll.',
        consequence: { any: 'Your baseline reach is 15% lower for the rest of the game. So is everyone\'s.' },
      },
      gravity: {
        name: 'Adjacent gravity',
        body: 'Someone in your cluster goes viral about sourdough and Series A term sheets. For one week you are adjacent to something popular.',
        consequence: {
          clear: 'Your fingerprint is clear enough to sit next to it. Next week\'s reach is 8% higher.',
          blurred: 'Your fingerprint is too blurred to sit next to anything. Nothing happens.',
        },
      },
      audit: {
        name: 'The audit',
        bodyByArchetype: {
          seed: 'Your headline is read. It names what you sell. The model files you under it.',
          seriesb: 'Your headline is read. It says a title and a company. The model files you under the company.',
          second: 'Your headline is read. It is a mission statement. The model files you under vibes.',
          fractional: 'Your headline is read. It says four things. The model picks one.',
        },
        consequence: {
          up: 'Fingerprint clarity rises.',
          down: 'Fingerprint clarity drops.',
        },
      },
    },

    outcomes: {
      'pod-casualty': {
        name: 'The Pod Casualty',
        tagline: 'Twelve peers said congratulations. None of them were buying.',
        diagnosis: 'You took three or more shortcuts that promised reach. Some traced to nothing, like the +21% for commenting before you post. Some were measured and still worked against you, like polls, which travel wide and convert almost no one. LinkedIn says it is making pods and engagement bait ineffective (Jurka, March 2026). Your pipeline paid the difference.',
      },
      'ghost': {
        name: 'The Ghost',
        tagline: 'Consistent, in the sense that you were consistently absent.',
        diagnosis: 'You went quiet for two weeks or more. In this model a fingerprint that stops getting new posts fades, and coming back costs clarity; that penalty is ours. Van der Blom suggests two to three posts a week, which is his view from a paid report and an interview, not a published sample. The feed did not wait for you.',
      },
      'generalist': {
        name: 'The Generalist',
        tagline: 'A thought leader in everything, for about a day each.',
        diagnosis: 'Your posts changed subject from week to week. LinkedIn describes every post with your headline, company and industry and matches it to readers on meaning (Danchev, March 2026). A run of unrelated topics gives it nothing stable to match, so your posts reached people with no reason to message you. Reach without a fingerprint is noise.',
      },
      'broadcaster': {
        name: 'The Broadcaster',
        tagline: 'Huge in the feed. Unknown in the inbox.',
        diagnosis: 'Your reach was in the top quarter and your pipeline was not. Polls and broad posts travel: polls reach 1.78x a typical post but draw 0.37x the engagement (AuthoredUp, 3M posts). LinkedIn's published ranking work measures itself on long dwell and contribution, not impressions (Hertel et al., 2026). Reach is the instrument. You were scored on conversations.',
      },
      'fingerprinted-founder': {
        name: 'The Fingerprinted Founder',
        tagline: 'The algorithm knows exactly what you do. So, at last, does your family.',
        diagnosis: 'Your posts stayed on one subject and put the point in the first line. LinkedIn builds each post\'s description from your headline, company and industry and matches on meaning (Danchev, March 2026), so a steady subject gave it a clear match. The people it matched you with were the ones who sent messages. That is the loop this model rewards.',
      },
      'control-group': {
        name: 'The Control Group',
        tagline: 'Every experiment needs one.',
        diagnosis: 'No bait, no long silences, and no standout result. Your fingerprint was legible but not sharp, and your pipeline sat in the middle of the range. The two things this model rewards were both available to you: one subject held for twelve weeks, and specifics in the first line. Neither was pulled far enough to show up.',
      },
    },

    end: {
      pipelineLabel: 'Pipeline',
      pipelineUnit: 'DMs and qualified conversations',
      clarityLabel: 'Fingerprint clarity',
      taxLabel: 'Folklore tax',
      taxLine: 'Shortcuts you took on someone else\'s word.',
      gatedNote: 'You also built the gated game. That one works. Its source sells quizzes.',
      disclosure: "The structure of this model comes from LinkedIn's published engineering. The weights are ours. Anyone who tells you they have the weights is selling something.",
      share: 'Share',
      shareText: '{archetype} · pipeline: {band} · folklore tax: {tax}',
      copied: 'Link copied',
      replay: 'Play again',
      emailLine: 'Get notified when Building Value relaunches.',
      emailPlaceholder: 'you@company.com',
      emailButton: 'Notify me',
      emailDone: 'Check your inbox to confirm.',
      emailError: 'That did not go through. Try again in a minute.',
      podcast: 'This game ran twelve weeks. Building Value runs whole careers: how creatives and business leaders got from the start of their work to where they are now, and what the arc of their wins and failures looked like from the inside. New season, Q4 2026.',
      podcastLink: 'Building Value',
      sourcesHeading: 'Sources',
    },
  };

  const deepFreeze = o => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
    return o;
  };
  return deepFreeze(COPY);
});
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:rc`
Expected: `38/38 passed`. If the house-rules test flags a string, rewrite that string to satisfy the rule (keep the meaning) and note it in the report; never loosen the regex. If the why-line coverage test names a missing key, add the why-line in the same register and report it.

- [ ] **Step 5: Commit**

```bash
git add robot-comments-copy.js robot-comments-data.js tools/robot-comments-test.js docs/superpowers/plans/2026-09-28-robot-comments-copy.md
git commit -m "Robot Comments: copy file (why-lines, events, outcomes, end screen) + copy tests"
```

---

### Task 2: Card titles

**Files:**
- Modify: `robot-comments-data.js` (the 40 `R(...)` titles; bait titles stay)

Titles are the post's first line, so the hook type is visible in the title itself.

- [ ] **Step 1: Rewrite the titles**

Run from the repo root:

```bash
python3 - <<'EOF'
import re, json
titles = {
  "t01": "Our churn doubled after a 20% price rise. Here are the three accounts that left, and why.",
  "t02": "In week nine I drafted the email shutting the company down. I never sent it.",
  "t03": "There is a particular silence when a roadmap meeting runs past the hour.",
  "t04": "Hiring your first salesperson before product-market fit costs a year. What did it cost you?",
  "t05": "My sourdough starter has now outlived two of my companies.",
  "t06": "Is anyone else killing annual contracts?",
  "t07": "Version 2 is live. Everything that changed, at the link below.",
  "t08": "Five things nobody tells you about your first board meeting",
  "t09": "The office is dead. Agree? Comment YES.",
  "t10": "One customer interview rewrote our pricing page. Full notes in the first comment.",
  "i01": "Our pipeline by week, on one slide. Where would you cut first?",
  "i02": "The whiteboard from the night we decided to pivot",
  "i03": "My co-founder and I have argued about this chart for a month. Who is right?",
  "i04": "The view from the conference hotel, 6am",
  "i05": "Seven metrics every founder should track. Comment YES and I will send the template.",
  "i06": "Three operators who changed how I run a company this year, and what each one said",
  "i07": "We are hiring a founding engineer. Team photo, role and link below.",
  "d01": "Our whole sales playbook, 12 pages, including the parts that failed. What is missing?",
  "d02": "A 10-slide guide to our category",
  "d03": "Every pricing page in our market, side by side, and what each one gets wrong",
  "d04": "It started with a spreadsheet nobody trusted. A customer case study (link in comments)",
  "d05": "My marathon training plan, as a carousel",
  "s01": "60 seconds on the $400k deal we walked away from",
  "s02": "A day in the life of a founder",
  "s03": "I quit coffee for 30 days. Here is what happened to my calendar.",
  "s04": "Can you guess our burn rate? Comment YES for the answer.",
  "l01": "A five-minute teardown of our worst launch, with the numbers",
  "l02": "Full conversation: my first board member on the mistake I made twice",
  "l03": "Webinar recording: the future of our category (link below)",
  "p01": "Poll: what is your biggest go-to-market problem right now?",
  "p02": "Poll: office, hybrid or remote?",
  "p03": "Poll: best airport lounge in Europe?",
  "a01": "What 40 customer calls taught us about pricing. The long version.",
  "a02": "Some thoughts on the state of our industry",
  "a03": "The year I stopped managing and started leading",
  "r01": "Resharing a customer's post about us, with one line on what they left out",
  "r02": "Resharing an industry report without comment",
  "r03": "Resharing a viral post about AI replacing everyone's job",
  "r04": "Resharing our own launch announcement, link included",
  "r05": "Resharing a friend's hiring post. Know anyone for this?",
}
p = 'robot-comments-data.js'
s = open(p).read()
for cid, t in titles.items():
    pat = re.compile(r"(R\('%s',(?:\s*'[^']*',){5}\s*)(?:'[^']*'|\"[^\"]*\")" % re.escape(cid))
    s, n = pat.subn(lambda m: m.group(1) + json.dumps(t, ensure_ascii=False), s)
    assert n == 1, cid
open(p, 'w').write(s)
print('rewrote', len(titles), 'titles')
EOF
```

Expected: `rewrote 40 titles`.

- [ ] **Step 2: Confirm the engine version did not change and all tests pass**

Run: `git stash && node -e "console.log(require('./robot-comments-engine.js').ENGINE_VERSION)" && git stash pop && node -e "console.log(require('./robot-comments-engine.js').ENGINE_VERSION)" && npm run test:rc && npm run sim:rc`
Expected: the two version numbers are identical (titles are not part of the hash), `38/38 passed`, and the sim exits 0 with the same table as before.

- [ ] **Step 3: Commit**

```bash
git add robot-comments-data.js docs/superpowers/plans/2026-09-28-robot-comments-copy.md
git commit -m "Robot Comments: card titles written as first lines"
```

---

### Task 3: Spec update

**Files:**
- Modify: `docs/superpowers/specs/2026-09-28-robot-comments-design.md`

- [ ] **Step 1: Update the spec**

1. In §1, replace `Sources: \`vdb\` (podcast, 23:02) and \`dhelin\`.` with `Source: \`vdb80\` (an invented-tier entry describing the van der Blom anecdote, podcast 23:02).`
2. In §3's file table, add a row: `| \`robot-comments-copy.js\` | Every player-facing string except card titles (global \`RobotCopy\`), linted by the tests. |`
3. In §18, replace the line that begins `- Copy: I draft all game copy` with `- Copy: in \`robot-comments-copy.js\` and card titles in \`robot-comments-data.js\` (Plan 2, done).`

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-09-28-robot-comments-design.md docs/superpowers/plans/2026-09-28-robot-comments-copy.md
git commit -m "Robot Comments spec: copy lives in robot-comments-copy.js"
```

**Checkpoint: Plan 2 complete.** Next: Plan 3 (UI).

---

## Spec coverage (Plan 2)

| Spec | Where |
|---|---|
| §1 name, tagline, title self-stamp | `title`, `tagline`, `titleStamp` + `vdb80` source |
| §3 intro copy direction | `intro` |
| §5 week screen strings, stamp source sheet | `week`, `labels.stampMeaning` |
| §5a resume card | `resume` |
| §6 dimension tags, bait why-lines | `labels.*`, `why['bait-*']` |
| §8 event copy | `events`, `why['event:*']` |
| §9 outcomes, bands, tax reframe | `outcomes`, `labels.bands`, `end.taxLine` |
| §10 end screen, disclosure, email (Building Value), podcast line | `end` |
| §11 house rules | the lint test |
