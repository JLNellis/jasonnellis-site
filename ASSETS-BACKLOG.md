# Assets backlog — things to get from Jason

Running list of material the site needs that **can't be written, only
collected**. Everything here is blocked on Jason gathering something real —
a quote, a file, a number, a clearance — not on copy or code.

Ranked by leverage. Update the status line when something lands, and delete
the item once it's live on the site.

*(Not built by Eleventy — listed in `.eleventyignore`.)*

---

## 1. Testimonials — 2–3 client quotes

**Status:** not started · Jason considering (2026-09-15)
**Unblocks:** the biggest open question on the site.

`advisory.html` has an HTML comment sitting where the first two quotes go,
in the Receipts section. Until they exist, the whole relational half of the
positioning — that he builds teams, reads a room, gets people to consensus —
is asserted rather than shown.

**Why it's ranked first:** it's the deciding input on the header question
(see *Open decision* below). It also makes `/advisory` credible in a way no
amount of rewriting will.

**The ask that produces a useful quote** — not "he was great to work with,"
which is worth nothing:

> Think of a moment I made a call you disagreed with at the time. What was
> it, and what happened?

That answer proves the decisiveness *and* the relationship at once, which is
exactly the pair the site is currently missing.

Best candidates: former SuperBam and Jogg colleagues, Packagd co-founders,
Meta NPE collaborators, the BoltOS creator cohort.

## 1b. A recent case study — last 2–3 years, not the overhead cut

**Status:** not started · Jason flagged 2026-09-20
**Unblocks:** the Receipts section on `/advisory`.

Both case studies on `/advisory` are old: Packagd → Meta (2016–2023) and
Hulu (2007–2012). Since the Sept 2026 rework the page sells counsel next to
the CEO and a fractional-CPO sprint, and the newest written proof of that
kind of work is three years stale. A buyer reading the receipts sees a
career, not a current practice.

**The ask:** one case study from the last 2–3 years, written from the
inside like the existing two — what the decision looked like at the time,
what it cost, what happened. SuperBam is the obvious source, but **not the
$70k → $25k overhead reduction**: that number already leads the stat band
and the site shouldn't tell the same story twice. Look for the other
SuperBam call — a product, market, or team decision — or something from
Jogg or the BoltOS cohort.

**What makes it useful for this page:** it should show Jason in the second
chair or running a sprint, i.e. a CEO making a call with him in the room,
rather than Jason as the sole operator. That's the shape the new
engagements promise and neither existing case study demonstrates it.

Ships as an essay in `essays/` (so it gets a permanent `/blog/<slug>/` URL)
and a third `.proof-card` in `advisory.html`; the two-column `.proof-grid`
will need a third slot or a row.

## 2. Video footage of Jason speaking

**Status:** partly solved 2026-09-15 — **hosting/interview footage now live;
on-stage keynote/panel footage still wanted.**
**Unblocks:** `/speaking`, `/press-kit`, possibly the homepage.

**Now live (self-hosted, compressed `<video>`):** the 2022 Super highlight
reel (Jason hosting creator interviews on the Meta platform he built) as a
featured speaker reel on `/speaking` and a "Speaker reel" section on
`/press-kit`; the two 2017 Austin Evans interviews as on-camera proof under
the `/speaking` moderating callout — which moves the 150+-conversations
moderation claim from a count to a demonstration. Two vertical Building Value
clips also went to `/building-value`. All are **hosting/interview** footage.

**Still missing:** actual **on-stage keynote or panel footage** — him at a
podium or on a live conference panel. The reel and interviews show he can
host a conversation; they don't show him delivering a talk to a room. Ninety
seconds of unedited stage footage is still the single thing organisers look
for and can't find here. Cheapest source: a session recording from a past
event (same Project A ask as 2b covers PAKCon).

Hosting note (changed): the site now **self-hosts** video (compressed mp4,
`preload="none"`, poster frames — no cookie, no consent banner), so the old
"`youtube-nocookie.com` only" rule no longer binds new clips. Either path is
fine; self-hosting was chosen here to avoid a YouTube dependency.

## 2b. PAKCon 2024 event photos — ask Project A directly

**Status:** searched 2026-09-15, **nothing usable found publicly.**

Jason spoke at **PAKCon 2024** (Project A Knowledge Conference, Berlin,
20 Sept 2024), listed on the official speakers page as *Chief Product
Officer, Jogg*. Archived:
`https://web.archive.org/web/20240624131337/https://knowledge-conference.project-a.com/speakers`

What the search found and didn't:

- The conference subdomain is **dead** (`knowledge-conference.project-a.com`
  no longer resolves) and the Webflow staging mirror 404s.
- Archive.org captured a `/gallery` page, but only in Dec 2021 and Jan 2022 —
  no 2024 gallery exists in the archive.
- The only image of him on the speakers page is the headshot he supplied
  himself (a selfie, `IMG_1663.png`) — not event photography, and worse than
  what's already on the site.
- An official **aftermovie** exists: `youtube.com/watch?v=Zwo7eXLfSl0`
  (4:05). He may appear in it; faster for Jason to scan than to analyse.

**The actual route:** ask Project A's comms/marketing team for photos of him
from the day. Organisers shoot far more than they publish and almost always
share with a speaker who asks. Same ask covers any session recording.

**Rights note that applies to every event photo:** finding a picture online
is not permission to use it. Conference photography belongs to the organiser
or their photographer. Get it in writing, including whether credit is
required, before anything goes on the site.

## 3. Event and client logos

**Status:** not started
**Unblocks:** the Track Record strip on `/speaking`.

The strip is currently numbers and text. Logos for conferences he's spoken
at, or companies he's worked with, would do more than any additional stat.
Needs permission per logo.

## 4. Meta client-name clearance

**Status:** **NOT cleared** — Jason confirmed 2026-09-15. Do not publish.

From the accomplishment ledger: "onboarded 25+ Live Shopping companies incl.
Anne Klein, Betabrand, QVC, NBCUniversal." Flagged NDA-sensitive, and Jason
has not cleared it. It is the most concrete Meta proof available, so worth
revisiting if his read on the NDA changes — but until then it stays off the
site entirely.

## 5. BoltOS pipeline → committed dollars

**Status:** waiting · Jason expects an update

`/advisory` currently runs `5×` qualified pipeline as a multiplier. The base
(2 → 10) is private and must stay that way. Once pipeline converts to
committed revenue, the dollar figure replaces the multiplier and the
small-base question disappears.

## 6. Jogg velocity artifact

**Status:** optional hardening

The `12 weeks → 4 weeks` claim on `/advisory` and `/about` is currently
unattributed. Any surviving artifact — a roadmap, release logs — would make
it defensible rather than asserted. Low urgency; the claim is fine as is.

---

## Open decision this backlog feeds

**Which claim leads the site header?**

- **A — "I move outcomes."** Decisions, results, the accomplishment ledger.
- **B — "I build teams and consensus."** Relational, embedded, commands the room.

Currently **A leads the header and B carries the offer** (The Sixth Week, the
mid-transition card, the not-here-to-fix-your-culture guardrail). That split
is deliberate: a buyer buys the outcome and experiences the method.

A is primary *because B has no evidence on the site yet* — not because B is
wrong. **Item 1 is what makes B promotable.** Revisit the header once two or
three real quotes exist, and not before.

Source: `site-positioning-notes-from-jenn.md` and
`nellis-accomplishment-ledger.md`, both in Jason's Downloads, 2026-09-15.

---

## Deliberately not collecting

- **Statemints 10 → 150 membership (15×).** Retention unknown and
  unverifiable, causation shared with the festival. Two caveats is one too
  many for a page whose product is candour. Fine in conversation.
- **Hulu's $100MM partner book.** Portfolio scale he sat on top of, not money
  he moved. No phrasing survives a skeptical reader. The owned outcome — up
  to 200% over goal — is already live on `/about`.
- **Wedding officiating.** Humanising, and a fine `/about` detail if he wants
  it. Not evidence anyone weighs when deciding on an engagement.
- **"My network."** The most commoditised and least falsifiable claim in
  advisory. Skip unless it becomes specific enough to name the door.
