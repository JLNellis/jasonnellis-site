---
title: "The call to start over at SuperBam"
description: "Four half-built ingestion projects stitched into one slow process. The fix wasn't finishing them. It was stopping, and deciding what kind of company SuperBam was."
date: 2026-09-21
category: "Case Study"
readTime: "7 min"
heroImage: "/superbam.jpg"
ogImage: "/og-case-superbam.jpg"
---
*Chief Product Officer, SuperBam · October 2024 – 2026*

SuperBam is a Los Angeles-based intellectual property and video rights management company. It helps creators find unauthorized uses of their work across YouTube, Facebook, and other platforms, and recover the value those uses generate: when a platform supports it, by redirecting the ad revenue from an infringing upload back to the rights holder; when it doesn't, by pursuing takedowns.

The mechanism underneath all of that is the reference file. Every video a creator wants protected has to be delivered to each platform's rights system as a reference, along with the policies that say what should happen when a match is found: monetize, block, or track, and in which territories. Get the reference files in fast and correctly and the business scales. Get them in slowly and it doesn't.

### Situation

I joined in October 2024 as the company's first Chief Product Officer. The CEO had built a real services business and knew that scaling it meant building infrastructure. He had tried before, with contractors who were engineers rather than product people, and had ended up with tools instead of a system.

The first thing I did was look hard at ingestion, because it was where every creator relationship began and where every delay compounded. What I found was a process that was entirely manual. Metadata was extracted from each file by hand. The files themselves lived on a remote desktop machine in an employee's home, because that was the only way the support teams abroad could reach them. Every video, every policy, every territory: a person, a spreadsheet, a queue.

There was a workflow in place, and a second one being built to replace it. The second one was exactly as slow and cumbersome as the first. Looking closer, it wasn't one project at all. It was four different people's starting ideas, from four different moments, stitched together into a single thing that moved, but only just.

### Decision

At the end of November 2024, after working through it with the CEO and the department heads, I made the call to stop. Not to finish the replacement, and not to patch the original: pause all of it and design the system from scratch.

The work that existed wasn't bad. That was the hard part of the conversation. Each piece had been a reasonable answer to the problem in front of whoever built it. The trouble was that they had been built without a strategy connecting them, and no amount of finishing would give them one. Stopping cost us months of sunk work and the discomfort of telling people their project was over. Continuing would have cost us the company's ability to grow.

> You can't finish your way out of a system that was never designed.

That decision turned out to be bigger than ingestion. Once we'd agreed that the core process had to become a technical one, the CEO and I made the larger call in the same conversation: SuperBam needed to think of itself as a technology company, not a services company with some tools, and make dramatic shifts in that direction. Ingestion was the first proof of whether we meant it.

### What Shipped

I worked with the fractional CTO, the VP of Operations, and the head of ingestion. The engineering capacity was a pair of contract engineers the CTO brought in, part-time and not always available, which meant the design had to be right before much code was written. We didn't have the budget to iterate our way there.

The system we designed ingests a reference file once. At the point of ingestion it makes it simple to attach the metadata that matters: the video and music usage policies, and the territories each policy applies in. A video, its policies, and its territories became one linked record instead of three things a person had to remember to keep in sync.

On top of that we built a new archive-and-distribution layer, so that a file ingested once could be delivered to YouTube, to Facebook, and to any platform we added later without being touched again. Adding a platform became a configuration problem instead of an operations project.

The piece I'm proudest of is timecode-specific policy. A song in a video is usually a thirty-second stretch, not the whole thing, and the old process could only apply a policy to the full file. We rebuilt ingestion so a policy could be applied to a span of the video rather than all of it, which is how rights actually work and how the platforms' own systems expect to be told.

The remote desktop in someone's living room went away.

### Result

Throughput went up roughly four times, by our own count. We hadn't instrumented the old process well enough to claim more precision than that, and I'd rather give you the honest number than an impressive one.

The claim I'll make without hedging is about people. Onboarding a creator with thousands of hours of video had previously taken most of a team, working for weeks. On the new system a single person could process the same library. That's what made large libraries a sales conversation instead of an operations negotiation.

It was also, for the first time, a secure and scalable system: one source of truth for every reference file and every policy, instead of a machine in a house.

And it became the foundation. The client dashboard, the new reporting, the rethink of the payment engine, and the administration of all of it were built on the ingestion platform over the following year. None of that would have been possible on what we'd stopped.

### What I'd Teach

The instinct when you inherit half-built work is to finish it. It's already paid for, people are attached to it, and stopping feels like an admission that time was wasted. Sometimes it should be finished. But you have to ask a different question first: was this designed, or did it accumulate?

Accumulated systems can't be completed, because there's no "complete" they were heading toward. Every piece was locally sensible and the whole was never anyone's job. The only fix is a design, and a design usually means starting over.

The second thing: the call to rebuild a process is often really a call about what kind of company you are. We didn't set out to redefine SuperBam in a meeting about reference files. But once you decide the core of the business has to be a system rather than a queue of people, you've decided the rest too. Say that part out loud at the time, so the people who have to live with it know what they've agreed to.
