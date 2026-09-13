# The Feed — team portrait prompts (4 images)

Same pipeline as the six feed avatars in `the-feed-assets/imgs/manifest.json`
(group `avatars`): same style reference image (`opening-creator.png` from the
v1 art package), same template, one new subject line each.

**Deliver:** four square PNGs, at least 1024×1024, named exactly

    avatar-hire-editor.png · avatar-hire-manager.png · avatar-hire-mod.png · avatar-hire-designer.png

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
