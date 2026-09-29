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
      defineTags: 'What these mean',
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
        diagnosis: 'Your reach was in the top quarter and your pipeline was not. Polls and broad posts travel: polls reach 1.78x a typical post but draw 0.37x the engagement (AuthoredUp, 3M posts). LinkedIn\'s published ranking work measures itself on long dwell and contribution, not impressions (Hertel et al., 2026). Reach is the instrument. You were scored on conversations.',
      },
      'fingerprinted-founder': {
        name: 'The Fingerprinted Founder',
        tagline: 'The algorithm knows exactly what you do. So, at last, does your family.',
        diagnosis: 'Your posts stayed on one subject and put the point in the first line. LinkedIn builds each post\'s description from your headline, company and industry and matches on meaning (Danchev, March 2026), so a steady subject gave it a clear match. The people it matched you with were the ones who sent messages. That is the loop this model rewards.',
      },
      'control-group': {
        name: 'The Control Group',
        tagline: 'Every experiment needs one.',
        diagnosis: 'No long silences and no standout result. Your fingerprint was legible but not sharp, and your pipeline sat in the middle of the range. The two things this model rewards were both available to you: one subject held for twelve weeks, and specifics in the first line. Neither was pulled far enough to show up.',
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
