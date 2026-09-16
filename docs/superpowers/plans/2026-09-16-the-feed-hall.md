# The Feed — the hall (5a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the end screen a "Creators you've been" shelf — past completed runs stored as short bios in a new `localStorage.thefeed_hall` key — closing Step 1.

**Architecture:** Chrome-only (`the-feed.html`) + one `/privacy` clause. On `endGame`, append a compact bio record; render a shelf from the stored records. Its own `localStorage` key, separate from `thefeed_save` and `thefeed_endings`. No engine/sim/test change; no `SAVE_VERSION` interaction.

**Tech Stack:** Vanilla JS in the inline IIFE, `localStorage`.

**Depends on:** the shipped end screen (path line + exit clause + endings gallery). Build off a `main` that has Pillar 1 + Team; it touches only `the-feed.html`'s end-screen code, which the Team PRs don't.

**Testing model:** No engine change → `npm test` stays put (a guard that the engine wasn't touched). `npm test` does NOT parse `the-feed.html`, so after each task load `http://localhost:8080/the-feed.html`, confirm the IIFE ran (`#nichegrid .pick` length 6) with no console errors. Verify behavior in the browser (finish runs, read `thefeed_hall`, see the shelf).

---

## File structure
- **`the-feed.html`** — the `thefeed_hall` helpers, the store call in `endGame`, the `#endHall` container, `renderHall()`.
- **`privacy.html`** — one clause.
- **`the-feed-BACKLOG.md`** — note.

---

### Task 0: Baseline
- [ ] `npm test` (record total — must be unchanged at the end, proving no engine touch). `preview_start {name:"site"}`, load the game, console clean.

---

### Task 1: Store a bio when a run ends (chrome, browser-verified)

**Files:** `the-feed.html`

- [ ] **Step 1: Add the hall storage helpers.** Next to `foundEndings` (search for `function foundEndings`), add:
```js
  // "Creators you've been": past completed runs as short bios, on-device only (see /privacy).
  // Its own key, separate from the save and the endings gallery. Capped so storage stays small.
  const HALL_KEY = 'thefeed_hall', HALL_CAP = 12;
  function hallRuns(){ try{ return JSON.parse(localStorage.getItem(HALL_KEY)||'[]'); }catch(e){ return []; } }
  function pushHallRun(rec){ try{ const all=[rec, ...hallRuns()].slice(0, HALL_CAP); localStorage.setItem(HALL_KEY, JSON.stringify(all)); }catch(e){} }
```

- [ ] **Step 2: Store the run in `endGame`.** In `endGame(key)`, immediately after the `renderEndGallery(key);` line (and before `render();`), add:
```js
    pushHallRun({ name:S.name, niche:S.niche, home:top?top.key:null, endKey:key,
      followers:totalFollowers(), exitChoice:S.flags.exitChoice||null, ts:Date.now() });
```
(`top`, `key`, `S.name`, `S.niche`, `S.flags.exitChoice`, `totalFollowers()` are all already in scope in `endGame`.)

- [ ] **Step 3: Verify (browser).** Reload; IIFE clean. Start and finish a run (fastest: play a few weeks then trigger a quick end — or in the console, drive a run to an ending). Then:
```js
JSON.parse(localStorage.thefeed_hall)   // → [{ name, niche, home, endKey, followers, exitChoice, ts }]
```
Expected: one record with the run's name/niche/ending/followers. Finish a second run → two records, newest first.

- [ ] **Step 4: Commit** (`the-feed.html`): `"The Feed: store completed runs to the hall (thefeed_hall)"` + trailer.

---

### Task 2: The "Creators you've been" shelf (chrome, browser-verified)

**Files:** `the-feed.html`

- [ ] **Step 1: Add the shelf container.** In the end-overlay markup, after the endings gallery `<div class="endgal" id="endGal"></div>`, add:
```html
    <div class="endhall" id="endHall"></div>
```

- [ ] **Step 2: Add `renderHall()`.** Near `renderEndGallery`, add a renderer that reads the records and builds a compact shelf (reuse `END_ICON`, `NICHES`, `PLATFORMS`, and `E.ENDINGS[...].kicker`; no stored HTML):
```js
  function renderHall(){
    const runs = hallRuns();
    if(!runs.length){ $('endHall').innerHTML=''; return; }
    const row = r => {
      const ic = END_ICON[r.endKey]||['alerts','var(--sf-fg-2)'];
      const kicker = (E.ENDINGS[r.endKey]&&E.ENDINGS[r.endKey].kicker)||'—';
      const niche = NICHES[r.niche]?NICHES[r.niche].label:r.niche;
      const plat = r.home&&PLATFORMS[r.home]?PLATFORMS[r.home].name:'—';
      const exit = r.exitChoice==='sold'?' · sold out early':r.exitChoice==='independent'?' · went independent':'';
      return `<div class="hallrow"><span class="hi">${icon(ic[0],'',ic[1])}</span>
        <span class="ht"><b>“${r.name||'untitled'}”</b> — ${kicker} · ${fmt(r.followers)} followers<span class="hm">${niche} on ${plat}${exit}</span></span></div>`;
    };
    $('endHall').innerHTML = `<div class="gk">Creators you've been · <b>${runs.length}</b></div>
      <div class="hallgrid">${runs.map(row).join('')}</div>`;
  }
```

- [ ] **Step 3: Call it (after the store).** In `endGame`, right after the `pushHallRun({...})` call from Task 1, add `renderHall();` (so this run is stored, then the shelf renders including it).

- [ ] **Step 4: Add minimal CSS.** Near the `.endgal`/`.etile` styles, add `.endhall`, `.hallrow` (flex, an icon + text, subtle divider), `.hm` (a muted second line, `--sf-fg-2`, ~11.5px) — matching the endings-gallery / end-screen look (the game's Bolt OS tokens, 2px feel). Keep it compact.

- [ ] **Step 5: Verify (browser).** Finish two different runs (different niche/ending) → the shelf shows both, newest first, each with name, ending kicker + icon, followers, "niche on platform", and the exit clause when relevant. Reload → the shelf persists (independent of the save; clearing `thefeed_save` doesn't affect it). A fresh browser (`localStorage.removeItem('thefeed_hall')`) → after one run, shows just that run. Screenshot the end screen with the shelf. Mobile + desktop.

- [ ] **Step 6: Commit** (`the-feed.html`): `"The Feed: 'Creators you've been' shelf on the end screen"` + trailer.

---

### Task 3: Privacy clause + backlog + final

**Files:** `privacy.html`, `the-feed-BACKLOG.md`

- [ ] **Step 1: Privacy clause.** In `privacy.html`, the "Storage in your browser" paragraph (it already lists endings found / the in-progress save / mute), add the hall to the list — e.g. "…and a short list of your past runs, so the end screen can show the creators you've been…". Bump the "Last updated" date only if the ship date differs from it.
- [ ] **Step 2: Verify.** `npm run build` clean; `/privacy` renders the amended clause.
- [ ] **Step 3: Backlog note.** Add "Shipped: the hall (5a)" to `the-feed-BACKLOG.md`: the `thefeed_hall` key (capped 12), the end-screen shelf, uses the run's ending/path facts (upgrades to Pillar 4's sketch later), chrome-only, no engine/save-version change. **Note Step 1 is now complete** — next is reading the Plausible flatline/replay numbers before Steps 2–4.
- [ ] **Step 4: Final guards.** `npm test` unchanged (engine untouched); browser: the end-screen shelf works, IIFE clean; `preview_stop`. Commit the privacy + backlog changes.

---

## Self-review notes (author checklist)
- **Spec coverage:** store-on-end (T1) · the shelf (T2) · privacy clause (T3). Cap 12, own key, no `SAVE_VERSION` interaction — all per spec. 5b / Pillar-4 sketch / start-screen gate correctly absent (the start-screen *peek* was left as an optional call and is not included here — add later if Jason wants it).
- **Name/type consistency:** `HALL_KEY`/`HALL_CAP`, `hallRuns`/`pushHallRun`/`renderHall`, the record shape `{name,niche,home,endKey,followers,exitChoice,ts}` written in T1 and read identically in T2. Reads ending kickers via `E.ENDINGS[...].kicker` (exported).
- **No placeholders:** helper + store + render fully coded; the CSS is described to match the existing end-screen styles (the one non-verbatim step, bounded to visual polish).
