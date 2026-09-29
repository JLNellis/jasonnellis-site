# 80% of Your Comments Are Robots: Glossary, Card Guide and Evidence Copy (Plan 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the copy for spec §10a (definitions on tap, "How to read a card", the evidence page) to `robot-comments-copy.js`, with tests that every term the player sees has a definition and that definitions stay neutral.

**Architecture:** Three new keys in `RobotCopy`: `glossary` (definitions keyed like `labels`), `cardGuide`, `evidence`, plus two link strings. Plan 3 renders them; Plan 4 builds the evidence page from them. Branch `robot-comments`; do not push.

**Review gate:** Task 0. Jason edits the definitions in Task 1 Step 3 before it runs.

**Rule for every definition (enforced by a test):** say what the word means, never whether it helps. No "best", "better", "worse", "good", "bad", "boost", "penalty", "hurts", "helps", "should".

---

### Task 0: Jason reviews the glossary (gate)

- [ ] **Step 1:** Jason edits the strings in Task 1 Step 3 in place.
- [ ] **Step 2:** `git commit -am "Robot Comments plan 2b: Jason's glossary edits"` (skip if no edits).

---

### Task 1: Glossary, card guide and evidence copy

**Files:**
- Modify: `robot-comments-copy.js`
- Modify: `tools/robot-comments-test.js`

- [ ] **Step 1: Write the failing tests**

Insert above the runner line in `tools/robot-comments-test.js`:

```js
// ---------------------------------------------------------------- glossary (plan 2b, spec §10a)
test('glossary: every term the player sees has a definition', () => {
  const G = C.glossary;
  for (const k of Object.keys(E.CONFIG.formats)) assert.ok(G.formats[k], 'format ' + k);
  for (const k of ['on', 'adj', 'off']) assert.ok(G.topics[k], 'topic ' + k);
  for (const k of Object.keys(E.CONFIG.hooks)) assert.ok(G.hooks[k], 'hook ' + k);
  for (const k of Object.keys(E.CONFIG.substance)) assert.ok(G.substance[k], 'substance ' + k);
  for (const k of Object.keys(E.CONFIG.cta)) assert.ok(G.cta[k], 'cta ' + k);
  for (const k of E.CONFIG.engagements) assert.ok(G.engagement[k], 'engagement ' + k);
  for (const k of Object.keys(C.labels.metrics)) assert.ok(G.metrics[k], 'metric ' + k);
  for (const k of ['hours', 'pipeline', 'band', 'folkloreTax', 'clarity', 'event', 'cluster']) assert.ok(G.terms[k], 'term ' + k);
});

test('glossary: definitions describe, they do not advise', () => {
  const banned = /\b(best|better|worse|good|bad|boost|boosts|penalty|penalises|hurts|helps|should)\b/i;
  for (const s of allStrings(C.glossary)) assert.ok(!banned.test(s), 'evaluative definition: ' + s);
});

test('card guide and evidence copy are complete', () => {
  const g = C.cardGuide;
  for (const k of ['title', 'open', 'firstLine', 'tags', 'cost', 'slot', 'stampsIntro', 'close']) assert.ok(g[k], 'cardGuide.' + k);
  const ev = C.evidence;
  for (const k of ['title', 'description', 'intro', 'fromIntro', 'fromEnd', 'leverHeading', 'effectHeading', 'sourceHeading', 'titleStampHeading', 'backToGame']) assert.ok(ev[k], 'evidence.' + k);
  assert.ok(C.week.defineTags, 'week.defineTags');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:rc`
Expected: the three new tests FAIL (`Cannot read properties of undefined (reading 'formats')` and similar); 38 others pass.

- [ ] **Step 3: Add the copy**

In `robot-comments-copy.js`:

1. In `week`, after `oursNote: ...,` add:

```js
      defineTags: 'What these mean',
```

2. Directly after the closing `},` of `labels`, add:

```js
    // Spec §10a: what each word means, never whether it helps (a test enforces this).
    glossary: {
      formats: {
        text: 'A post with words only.',
        image: 'A post with one or more images.',
        document: 'A multi-page PDF that readers swipe through, often called a carousel.',
        shortvideo: 'A video under 90 seconds.',
        longvideo: 'A video of three minutes or more.',
        poll: 'A post that asks readers to pick one of several options.',
        article: 'A long-form piece published in LinkedIn\'s article editor.',
        reshare: 'Someone else\'s post, passed on to your network with or without a line of your own.',
      },
      topics: {
        on: 'About the subject your headline and recent posts are known for. That subject is your cluster.',
        adj: 'Next to your cluster: related to it, but not the thing you are known for.',
        off: 'Unrelated to your cluster.',
      },
      hooks: {
        claim: 'The first line states the point.',
        scene: 'The first line sets a scene or a mood before getting to the point.',
        question: 'The first line is a question.',
        listicle: 'The post is a numbered list.',
      },
      substance: {
        named: 'Real people, companies or numbers.',
        generic: 'Advice that could apply to anyone.',
        personal: 'A story from your own life in which something was at stake.',
        promo: 'Selling a product, a role or an event.',
      },
      cta: {
        question: 'Ends with a question readers can answer from their own experience.',
        none: 'Ends without asking readers for anything.',
        linkbody: 'Includes a link to a page outside LinkedIn in the post itself.',
        linkcomment: 'Puts the outside link in the first comment instead of the post.',
        bait: 'Asks for a set reply, such as "Comment YES".',
      },
      engagement: {
        none: 'You spend no time commenting on other people\'s posts this week.',
        cluster: 'Half an hour commenting on posts about your own cluster.',
        popular: 'Half an hour commenting on whatever is getting attention, on any subject.',
      },
      metrics: {
        impressions: 'How many times your post was shown in someone\'s feed.',
        held: 'How many of those showings stopped long enough to read. LinkedIn calls this long dwell.',
        contributions: 'Reactions, comments and reshares. LinkedIn groups these together as contributions.',
        visits: 'People who opened your profile after seeing the post.',
        dms: 'Direct messages and conversations that could turn into business. They add up to your score.',
        coherence: 'How clearly your recent posts add up to one subject. The fingerprint is what the feed can tell about you.',
      },
      terms: {
        cluster: 'The subject your headline and recent posts are known for.',
        hours: 'Your weekly time for LinkedIn. Each post and each comment session costs hours, and unused hours do not carry over.',
        pipeline: 'Your DMs and qualified conversations across twelve weeks. It is the only score.',
        band: 'Cold, warm, working and hot place your pipeline among thousands of simulated players who started where you did.',
        folkloreTax: 'The number of bait cards you played. Each one promised a shortcut.',
        clarity: 'Where your fingerprint ended the twelve weeks: blurred, faint, legible or sharp.',
        event: 'Weeks 5 and 9 happen to you. There is no decision, only a consequence.',
      },
    },

    cardGuide: {
      open: 'How to read a card',
      title: 'How to read a card',
      firstLine: 'The first line of the post, as your network would see it.',
      tags: 'Five tags: the format, how it relates to your cluster, how it opens, what it contains, and how it ends.',
      cost: 'The hours it takes to make.',
      slot: 'Empty until you post. Then a stamp lands here saying how much evidence stands behind the result.',
      stampsIntro: 'There are four stamps.',
      close: 'Got it',
    },

    evidence: {
      title: 'The evidence behind 80% of Your Comments Are Robots',
      description: 'Every mechanic in the LinkedIn posting game, stamped Proven, Measured, Disputed or Invented, with its source.',
      intro: 'Every mechanic in the game, with how much evidence stands behind it. Proven means LinkedIn published it. Measured means an independent study with a published sample. Disputed means credible studies disagree. Invented means it circulates widely and traces to nothing. Where the mechanism is sourced but the size of the effect is ours, the entry says so.',
      fromIntro: 'Read the evidence first. It gives the game away.',
      fromEnd: 'See all the evidence',
      leverHeading: 'Lever',
      effectHeading: 'In the game',
      sourceHeading: 'Source',
      titleStampHeading: 'The title',
      backToGame: 'Play the game',
    },
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:rc`
Expected: `41/41 passed`. If the house-rules or neutrality test flags a string, rewrite that string minimally and report it; never loosen a test.

- [ ] **Step 5: Commit**

```bash
git add robot-comments-copy.js tools/robot-comments-test.js docs/superpowers/plans/2026-09-29-robot-comments-glossary.md
git commit -m "Robot Comments copy: glossary, card guide and evidence page copy (spec §10a)"
```

**Checkpoint: Plan 2b complete.** Next: Plan 3 (UI), which renders these.
