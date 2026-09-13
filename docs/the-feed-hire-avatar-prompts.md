# The Feed — team portrait prompts (6 images) + two Setup scenes

Same pipeline as the six feed avatars in `the-feed-assets/imgs/manifest.json`
(group `avatars`): same style reference image (`opening-creator.png` from the
v1 art package), same template, one new subject line each.

**Deliver:** square PNGs, at least 1024×1024, named exactly

    avatar-hire-editor.png · avatar-hire-manager.png · avatar-hire-mod.png · avatar-hire-designer.png
    avatar-hire-producer.png · avatar-hire-analyst.png          ← added 2026-09-13 (studio tiers round)

Drop them in `the-feed-assets/the-feed-art-library-v2/avatars/` and I'll derive
the 64/128 WebPs and add them to the manifest. The game already has the slots
wired (`hireAvatarHTML` in `the-feed.html`) and falls back to the role glyph
until the files exist.

Template (identical to the existing avatars, only the **subject** changes):

> Use case: illustration-story. Create ONE finished standalone illustration for The Feed browser game. Style reference is the supplied image, match its tactile editorial screen-print texture, slightly imperfect ink shapes, rich midnight navy shadows, warm cream, coral and selective mint light. Art directed adult indie game mood, expressive and humane, not corporate clipart, not photorealistic, not glossy 3D. NO words, letters, numbers, logos, watermarks, panel borders or baked-in UI. Square 1:1 illustrated social-feed avatar. Head and shoulders portrait of **{SUBJECT}**. Extreme simplicity compared to reference: broad flat graphic shapes with subtle print grain, plain solid navy background, high silhouette contrast, centered within the middle 75% for circular cropping, face large enough to read at 32px. No hands, no scene, no frame, no text, no logo. Reference style only, do not reproduce its creator.

Subjects:

1. **avatar-hire-editor** — a tired but sharp adult man of East Asian descent in his late twenties, black hair pushed back, over-ear headphones around his neck, cream hoodie, faint dark circles, the small satisfied smile of someone who just fixed a cut, one coral highlight on the headphone cup.
2. **avatar-hire-manager** — a confident adult woman of South Asian descent in her forties, dark hair in a low bun, mint blazer over a cream top, small gold hoop earrings, phone earbud in one ear, an expression that has already negotiated your rate and is waiting for you to catch up.
3. **avatar-hire-mod** — a calm adult non-binary person with light olive skin, short bleached hair with a coral tint at the tips, round glasses, dark navy crewneck with a small cream shield patch on the shoulder, gentle unbothered half-smile, the look of someone who has read the comments so you don't have to.
4. **avatar-hire-designer** — a stylish adult Black man in his thirties with a short fade and a neat beard, cream beanie, coral-framed glasses, mint paint smudge on one cheek, a pencil behind the ear, head tilted slightly, looking pleased with a thumbnail only they can see.
5. **avatar-hire-producer** — a brisk adult woman of Latina descent in her thirties, dark hair in a high ponytail, over-ear headphones pushed back, cream utility vest over a navy tee, a clipboard-sized tablet held against her shoulder, the calm of someone who knows what publishes Thursday.
6. **avatar-hire-analyst** — a wiry adult man of Middle Eastern descent, late twenties, close-cropped dark hair, thin mint-framed glasses, navy quarter-zip, one small coral sticky note stuck to the frame of the glasses, the half-smile of someone who has already seen next week's numbers.

---

## Setup scenes (2 images) — the studio tiers

Same pipeline as the five existing `studio-tier-0..4` scenes (group `studio`
in `the-feed-assets/imgs/manifest.json`; reuse one of those as the style
reference and copy its prompt template). The existing tier-4 scene now serves
"the lease" (middle tier). Needed, 3:2 landscape at least 1536×1024, named exactly:

    studio-tier-room.png · studio-tier-building.png

Drop them in `the-feed-assets/the-feed-art-library-v2/studio/` (or wherever the
tier scenes live) and I'll derive the 320/640 WebPs and add them to the manifest.
The Setup card already references them and falls back to the nearest existing
scene until they exist.

- **studio-tier-room** — "the spare room": a small converted bedroom or box
  room, door closed, one ring light and a cheap softbox crammed beside a desk,
  a single camera on a tripod, cables along the skirting, a clothes rail pushed
  into the corner, the window blacked out with a blanket. Cosy, improvised,
  clearly a step up from the first bedroom desk and clearly not a studio.
- **studio-tier-building** — "the building": a whole floor of a small
  commercial unit with the creator's studio name (no readable letters) on the
  glass door, two shooting bays, a lit set with a sofa and neon, an edit suite
  behind glass, a kitchen corner, a couple of staff silhouettes at work,
  cables managed in trunking, a rent invoice pinned to a cork board. Impressive
  and slightly ominous, the kind of place that costs money whether or not you
  filmed this week.
