/*
 * 80% OF YOUR COMMENTS ARE ROBOTS: page controller (browser only)
 * ------------------------------------------------------------------
 * Renders every screen from RobotEngine state. Every string comes from
 * RobotCopy or RobotData; none is written here.
 * Load order: robot-comments-data.js, -bands.js, -engine.js, -copy.js, then this.
 * Saves: localStorage 'rc_run' (in progress) and 'rc_last' (finished game),
 * both E.serialize() output, restored with E.replay() (spec §5a).
 * Analytics: track() is a no-op until Plan 4 adds the Plausible snippet.
 * Spec: docs/superpowers/specs/2026-09-28-robot-comments-design.md
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';
  const D = window.RobotData, E = window.RobotEngine, C = window.RobotCopy;
  const L = C.labels, G = C.glossary;
  const app = document.getElementById('app');
  const EVIDENCE_URL = '/robot-comments/evidence/';
  const METRICS = ['impressions', 'held', 'contributions', 'visits', 'dms', 'coherence'];
  const INK = { proven: 'var(--rc-proven)', measured: 'var(--rc-measured)', disputed: 'var(--rc-disputed)', invented: 'var(--rc-invented)' };

  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
  const short = src => (D.SOURCES[src] ? D.SOURCES[src].cite.split(',')[0].split(':')[0] : '');
  const tilt = key => (E.hashStr(String(key)) % 19) - 9;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shareUrl = slug => location.origin + '/robot-comments/r/' + slug + '/';
  const track = (name, props) => { try { if (window.plausible) window.plausible(name, props ? { props } : undefined); } catch (e) {} };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const show = html => { app.innerHTML = html; window.scrollTo(0, 0); };

  let S = null, sel = null, eng = 'none';
  const setup = { archetype: 'seriesb', budget: 3 };
  const save = () => store.set('rc_run', E.serialize(S));

  // ------------------------------------------------------------ pieces
  function stampSVG(stamp, src) {
    const word = L.stamps[stamp].toUpperCase();
    const ring = (short(src) + ' · ' + short(src)).toUpperCase().slice(0, 44);
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <g filter="url(#ink)" fill="none" stroke="${INK[stamp]}" style="color:${INK[stamp]}">
        <circle cx="50" cy="50" r="46" stroke-width="3.6"/>
        <circle cx="50" cy="50" r="41" stroke-width="1.2"/>
        <text font-family="DM Sans, sans-serif" font-weight="700" font-size="7.2" letter-spacing="1.1" fill="currentColor" stroke="none"><textPath href="#ring" startOffset="2%">${esc(ring)}</textPath></text>
        <rect x="6" y="40" width="88" height="20" fill="var(--rc-card)" stroke-width="2.2"/>
        <text x="50" y="55" text-anchor="middle" font-family="DM Sans, sans-serif" font-weight="700" font-size="${word.length > 7 ? 11.5 : 13.5}" letter-spacing="0.8" fill="currentColor" stroke="none">${esc(word)}</text>
      </g></svg>`;
  }

  function cardHTML(k, opts) {
    const cost = E.cardCost(k);
    const tags = [L.formats[k.fmt], L.topics[k.topic], L.hooks[k.hook], L.substance[k.sub], L.cta[k.cta]];
    const inner = `<span class="slot"></span><span class="cost">${cost}h</span>
      <div class="in"><h3>${esc(k.title)}</h3><div class="tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>
      <span class="need">${esc(fill(C.week.overBudget, { hours: cost }))}</span>`;
    if (opts.static) return `<div class="card sel static" data-id="${k.id}">${inner}</div>`;
    return `<button class="card${opts.sel ? ' sel' : ''}" data-id="${k.id}" ${opts.disabled ? 'disabled' : ''} aria-pressed="${!!opts.sel}">${inner}</button>`;
  }

  function stripHTML(big) {
    const max = {};
    for (const m of METRICS) max[m] = Math.max(1e-9, ...S.rows.map(r => r[m] || 0));
    let h = '';
    for (const m of METRICS) {
      h += `<button class="lab" data-metric="${m}">${esc(L.metrics[m])}</button>`;
      for (let w = 1; w <= 12; w++) {
        const r = S.rows.find(x => x.week === w);
        if (!r) { h += '<span class="c"></span>'; continue; }
        if (r.kind === 'event' && m !== 'coherence' && !(m === 'contributions' && r.contributions)) { h += '<span class="c ev"></span>'; continue; }
        const v = m === 'coherence' ? r.coherence : (r[m] || 0) / max[m];
        h += `<span class="c" style="background:rgba(27,38,48,${(0.08 + 0.85 * v).toFixed(2)})"></span>`;
      }
    }
    return `<div class="strip${big ? ' big' : ''}">${h}</div>`;
  }

  function titleBlock(week) {
    return `<div class="tb">
      <div><small>${esc(C.week.titleBlock.project)}</small><b>${esc(C.title)}</b></div>
      <div><small>${esc(C.week.titleBlock.week)}</small><span class="num">${Math.min(week, 12)}/12</span></div>
      <div><small>${esc(C.week.titleBlock.hours)}</small><span class="num">${S.setup.budget}h</span></div>
    </div>`;
  }

  function bindCommon() {
    app.querySelectorAll('[data-metric]').forEach(b => { b.onclick = () => defineOne(L.metrics[b.dataset.metric], G.metrics[b.dataset.metric]); });
    app.querySelectorAll('[data-term]').forEach(b => { b.onclick = () => defineOne(b.textContent, G.terms[b.dataset.term]); });
  }

  // ------------------------------------------------------------ sheets
  let lastFocus = null;
  function openSheet(title, bodyHTML) {
    closeSheet();
    lastFocus = document.activeElement;
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
      <button class="x link">${esc(C.cardGuide.close)}</button><h2 id="sheet-h">${esc(title)}</h2>${bodyHTML}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg) closeSheet(); });
    bg.querySelector('.x').onclick = closeSheet;
    document.body.appendChild(bg);
    bg.querySelector('.x').focus();
  }
  function closeSheet() {
    const bg = document.querySelector('.sheet-bg');
    if (!bg) return;
    bg.remove();
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  const defineOne = (title, text) => openSheet(title, `<p class="why">${esc(text)}</p>`);

  function defineTags(k) {
    const rows = [
      [L.formats[k.fmt], G.formats[k.fmt]], [L.topics[k.topic], G.topics[k.topic]], [L.hooks[k.hook], G.hooks[k.hook]],
      [L.substance[k.sub], G.substance[k.sub]], [L.cta[k.cta], G.cta[k.cta]],
    ];
    openSheet(C.week.defineTags, `<dl>${rows.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`);
  }

  function sourceSheet(lever, why) {
    const src = D.SOURCES[lever.src] || {};
    openSheet(L.stamps[lever.stamp], `<div class="stamp bigstamp" style="--r:${tilt(lever.key)}deg">${stampSVG(lever.stamp, lever.src)}</div>
      <p class="why">${esc(why || C.why[lever.key] || '')}</p>
      <p class="src">${esc(L.stampMeaning[lever.stamp])}${lever.mag === 'ours' ? ' ' + esc(C.week.oursNote) : ''}</p>
      <p class="src">${esc(src.cite || '')}${src.url ? ` <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(C.week.sourceLink)}</a>` : ''}</p>`);
  }

  function cardGuide() {
    track('rc_card_guide_opened');
    const g = C.cardGuide, k = E.cardById('d01');
    const mk = (n, css) => `<span class="mk" style="${css}">${n}</span>`;
    openSheet(g.title, `<div class="guide">${cardHTML(k, { static: true })}
        ${mk(1, 'left:100px;top:6px')}${mk(2, 'left:100px;bottom:26px')}${mk(3, 'right:-4px;top:-6px')}${mk(4, 'left:-4px;top:-4px')}</div>
      <ol class="guide"><li>${esc(g.firstLine)}</li><li>${esc(g.tags)}</li><li>${esc(g.cost)}</li><li>${esc(g.slot)}</li></ol>
      <p class="why">${esc(g.stampsIntro)}</p>
      <div class="tiers">${['proven', 'measured', 'disputed', 'invented'].map(t =>
        `<div class="stamp" style="--r:${tilt(t)}deg">${stampSVG(t, 'feedsr')}</div><p class="why"><b>${esc(L.stamps[t])}.</b> ${esc(L.stampMeaning[t])}</p>`).join('')}</div>`);
  }

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ------------------------------------------------------------ screens
  const heroHTML = () => `<section class="hero"><span class="slot" aria-hidden="true"></span>
    <h1>${esc(C.title)}</h1><p class="tag">${esc(C.tagline)}</p>${C.intro.map(p => `<p>${esc(p)}</p>`).join('')}</section>`;

  function renderResume(game) {
    const A = D.ARCHETYPES[game.setup.archetype];
    show(heroHTML() + `<div class="resume-card"><p>${esc(fill(C.resume.line, { week: game.week, archetype: A.name, budget: C.setup.budgets[game.setup.budget] }))}</p>
      <div class="go"><button class="btn" id="resume">${esc(C.resume.resume)}</button><button class="link" id="restart">${esc(C.resume.restart)}</button></div></div>`);
    app.querySelector('#resume').onclick = () => { S = game; track('rc_resume', { week: String(game.week) }); next(); };
    app.querySelector('#restart').onclick = () => { store.del('rc_run'); renderSetup(); };
  }

  function renderSetup() {
    const A = D.ARCHETYPES;
    const lastSave = store.get('rc_last'), lastGame = lastSave ? E.replay(lastSave) : null;
    show(heroHTML() +
      `<p class="introlinks"><button class="link" id="guide">${esc(C.cardGuide.open)}</button>
        <a class="link" id="ev" href="${EVIDENCE_URL}">${esc(C.evidence.fromIntro)}</a>
        ${lastGame && lastGame.done ? `<button class="link" id="last">${esc(C.resume.lastResult)}</button>` : ''}</p>
      <section class="pick"><h2>${esc(C.setup.archetypeHeading)}</h2><div class="tiles">
        ${Object.keys(A).map(id => `<button class="tile" data-a="${id}" aria-pressed="${setup.archetype === id}"><b>${esc(A[id].name)}</b><span class="num">${esc(fill(C.setup.connections, { n: A[id].connections.toLocaleString('en-US') }))}</span><span>${esc(A[id].headline)}</span></button>`).join('')}
      </div><h2>${esc(C.setup.budgetHeading)}</h2><div class="tiles budget">
        ${E.CONFIG.budgets.map(b => `<button class="tile" data-b="${b}" aria-pressed="${setup.budget === b}"><b class="num">${esc(C.setup.budgets[b])}</b></button>`).join('')}
      </div></section>
      <div class="go" style="margin-top:20px"><button class="btn" id="start">${esc(C.setup.start)}</button></div>`);
    app.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { setup.archetype = b.dataset.a; renderSetup(); app.querySelector(`[data-a="${b.dataset.a}"]`).focus(); }; });
    app.querySelectorAll('[data-b]').forEach(b => { b.onclick = () => { setup.budget = +b.dataset.b; renderSetup(); app.querySelector(`[data-b="${b.dataset.b}"]`).focus(); }; });
    app.querySelector('#guide').onclick = cardGuide;
    app.querySelector('#ev').onclick = () => track('rc_evidence_opened', { from: 'intro' });
    if (lastGame && lastGame.done) app.querySelector('#last').onclick = () => { S = lastGame; renderEnd(true); };
    app.querySelector('#start').onclick = () => {
      S = E.newGame(setup);
      track('rc_setup_complete', { archetype: setup.archetype, budget: String(setup.budget) });
      save();
      next();
    };
  }

  function next() {
    if (S.done) return renderEnd(false);
    if (E.weekKind(S) === 'event') return renderEvent();
    sel = null; eng = 'none';
    renderWeek();
  }

  function renderWeek() {
    const hand = E.deal(S);
    const card = hand.find(k => k.id === sel);
    const engOK = e => (card ? E.canAfford(S, card, e) : e === 'none');
    show(titleBlock(S.week) + stripHTML(false) +
      `<div class="hand">${hand.map(k => cardHTML(k, { sel: k.id === sel, disabled: !E.canAfford(S, k, 'none') })).join('')}</div>
       <div class="handnote">${S.week === 1 ? `<button class="link" id="guide">${esc(C.cardGuide.open)}</button>` : ''}
         ${card ? `<button class="link define" id="define">${esc(C.week.defineTags)}</button>` : ''}</div>
       <p class="eng-h">${esc(C.week.engagementHeading)}</p>
       <div class="eng">${E.CONFIG.engagements.map(e => `<button data-e="${e}" aria-pressed="${eng === e}" ${engOK(e) ? '' : 'disabled'}>${esc(L.engagement[e])}</button>`).join('')}</div>
       <div class="go"><button class="btn" id="post" ${card ? '' : 'disabled'}>${esc(C.week.post)}</button><button class="link" id="skip">${esc(C.week.skip)}</button></div>`);
    app.querySelectorAll('.hand .card').forEach(b => {
      b.onclick = () => {
        sel = b.dataset.id;
        if (!E.canAfford(S, E.cardById(sel), eng)) eng = 'none';
        renderWeek();
        const again = app.querySelector(`.hand .card[data-id="${sel}"]`);
        if (again) again.focus();
      };
    });
    app.querySelectorAll('[data-e]').forEach(b => { b.onclick = () => { eng = b.dataset.e; renderWeek(); app.querySelector(`[data-e="${eng}"]`).focus(); }; });
    const guide = app.querySelector('#guide'); if (guide) guide.onclick = cardGuide;
    const define = app.querySelector('#define'); if (define) define.onclick = () => defineTags(card);
    app.querySelector('#post').onclick = () => play({ card: sel, engagement: eng });
    app.querySelector('#skip').onclick = () => play({ skip: true });
    bindCommon();
  }

  function play(choice) {
    const res = E.resolveWeek(S, choice);
    save();
    track('rc_turn_resolved', {
      week: String(res.row.week), card: res.row.card || 'skip',
      stamp: res.lever ? res.lever.stamp : 'none', engagement: choice.skip ? 'skip' : choice.engagement,
    });
    if (choice.skip) return next();
    renderResolve(res);
  }

  function renderResolve(res) {
    const r = res.row, lv = res.lever, k = E.cardById(r.card);
    const dwell = r.held / Math.max(1, r.impressions);
    show(titleBlock(r.week) + stripHTML(false) +
      `<div class="played">${cardHTML(k, { static: true })}</div>
       <div class="resolve">
         <div class="feed" aria-hidden="true"><i></i><i></i><i class="you"></i><i></i><i></i><i></i><div class="light"></div><div class="ticks"></div></div>
         <dl class="nums">
           <dt>${esc(L.metrics.impressions)}</dt><dd>${Math.round(r.impressions).toLocaleString('en-US')}</dd>
           <dt>${esc(L.metrics.held)}</dt><dd>${Math.round(r.held).toLocaleString('en-US')}</dd>
           <dt>${esc(L.metrics.contributions)}</dt><dd>${r.contributions.toFixed(1)}</dd>
           <dt>${esc(L.metrics.visits)}</dt><dd>${r.visits.toFixed(1)}</dd>
           <dt>${esc(L.metrics.dms)}</dt><dd>${r.dms.toFixed(2)}</dd>
         </dl>
       </div>
       <p class="why" hidden>${esc(C.why[lv.key] || '')}</p>
       <p class="src" hidden>${esc(L.stampMeaning[lv.stamp])} <button class="link" id="srcbtn">${esc(C.week.sourceLink)}</button></p>
       <div class="go" style="margin-top:14px"><button class="btn" id="nx">${esc(S.done ? C.week.toResults : C.week.next)}</button></div>`);
    const played = app.querySelector('.played .card'), light = app.querySelector('.light'), ticks = app.querySelector('.ticks');
    const reduce = reduceMotion();
    const land = () => {
      const st = document.createElement('button');
      st.type = 'button';
      st.className = 'stamp stamp-btn' + (reduce ? '' : ' land');
      st.style.setProperty('--r', tilt(k.id) + 'deg');
      st.setAttribute('aria-label', L.stamps[lv.stamp] + ': ' + short(lv.src) + '. ' + C.week.sourceLink);
      st.innerHTML = stampSVG(lv.stamp, lv.src);
      st.onclick = () => sourceSheet(lv);
      played.appendChild(st);
      app.querySelector('.why').hidden = false;
      app.querySelector('.src').hidden = false;
    };
    const nTicks = Math.min(12, Math.round((r.contributions / Math.max(1, r.impressions)) * 400));
    if (reduce) {
      for (let i = 0; i < nTicks; i++) ticks.appendChild(document.createElement('b'));
      land();
    } else {
      const hold = dwell > 0.33 ? 520 : 90;
      light.animate([{ top: '-80px' }, { top: '72px', offset: 0.35 }, { top: '72px', offset: 0.35 + hold / 1400 }, { top: '260px' }],
        { duration: 900 + hold, easing: 'ease-in-out', fill: 'forwards' });
      for (let i = 0; i < nTicks; i++) setTimeout(() => ticks.appendChild(document.createElement('b')), 380 + i * 45);
      setTimeout(land, 1000 + hold);
    }
    app.querySelector('#srcbtn').onclick = () => sourceSheet(lv);
    app.querySelector('#nx').onclick = next;
    bindCommon();
  }

  function renderEvent() {
    const res = E.resolveEvent(S);
    save();
    track('rc_event_shown', { event: res.event });
    const ev = C.events[res.event];
    const body = ev.body || ev.bodyByArchetype[S.setup.archetype];
    let conseq = ev.consequence.any;
    if (res.event === 'gravity') conseq = S.nextReachMult > 1 ? ev.consequence.clear : ev.consequence.blurred;
    if (res.event === 'audit') conseq = S.headlineFit >= 0.8 ? ev.consequence.up : ev.consequence.down;
    show(titleBlock(res.row.week) + stripHTML(false) +
      `<article class="memo"><h3>${esc(ev.name)}</h3><p>${esc(body)}</p><p class="conseq">${esc(conseq)}</p></article>
       <p class="why">${esc(C.why['event:' + res.event])}</p>
       <p class="src">${esc(L.stamps[res.lever.stamp])}. ${esc(L.stampMeaning[res.lever.stamp])} <button class="link" id="srcbtn">${esc(C.week.sourceLink)}</button></p>
       <div class="go" style="margin-top:14px"><button class="btn" id="nx">${esc(S.done ? C.week.toResults : C.week.next)}</button></div>`);
    app.querySelector('#srcbtn').onclick = () => sourceSheet(res.lever);
    app.querySelector('#nx').onclick = next;
    bindCommon();
  }

  function renderEnd(fromLast) {
    const F = E.finish(S), O = C.outcomes[F.archetype];
    if (!fromLast) {
      store.set('rc_last', E.serialize(S));
      store.del('rc_run');
      track('rc_completed', { archetype: F.archetype, band: F.band, tax: String(F.tax) });
    }
    const titleLever = { key: 'title', stamp: C.titleStamp.stamp, src: C.titleStamp.src, mag: null };
    const used = [...new Set(S.rows.filter(r => r.lever).map(r => r.lever.src).concat(C.titleStamp.src))];
    show(`<section class="end">
        <p class="gametitle">${esc(C.title)}<button type="button" class="stamp stamp-btn land titlestamp" style="--r:11deg" id="tstamp"
          aria-label="${esc(L.stamps[titleLever.stamp] + ': ' + short(titleLever.src) + '. ' + C.week.sourceLink)}">${stampSVG(titleLever.stamp, titleLever.src)}</button></p>
        <h1>${esc(O.name)}</h1><p class="tagline">${esc(O.tagline)}</p>
        <div class="score"><div><span class="big">${F.pipeline.toFixed(1)}</span>
          <small><button class="term" data-term="pipeline">${esc(C.end.pipelineLabel)}</button>: ${esc(C.end.pipelineUnit)}</small></div>
          <button class="term band" data-term="band">${esc(L.bands[F.band])}</button></div>
        ${stripHTML(true)}
        <div class="facts"><div><button class="term" data-term="clarity">${esc(C.end.clarityLabel)}</button><b>${esc(F.clarity)}</b></div>
          <div><button class="term" data-term="folkloreTax">${esc(C.end.taxLabel)}</button><b class="num">${F.tax}</b></div></div>
        <p class="disc">${esc(C.end.disclosure)}</p>
      </section>
      <section class="after">
        <p class="why">${esc(O.diagnosis)}</p>
        <p class="src">${esc(C.end.taxLabel)}: ${esc(C.end.taxLine)}${F.playedGated ? ' ' + esc(C.end.gatedNote) : ''}</p>
        <div class="actions"><button class="btn" id="share">${esc(C.end.share)}</button><button class="btn ghost" id="again">${esc(C.end.replay)}</button></div>
        <p><a class="link" id="ev" href="${EVIDENCE_URL}">${esc(C.evidence.fromEnd)}</a></p>
        <div id="notify"></div>
        <p class="podcast">${esc(C.end.podcast)} <a href="/building-value">${esc(C.end.podcastLink)}</a></p>
        <h2 class="srch">${esc(C.end.sourcesHeading)}</h2>
        <ol class="sources">${used.map(id => { const s = D.SOURCES[id]; return `<li>${esc(s.cite)}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(C.week.sourceLink)}</a>` : ''}</li>`; }).join('')}</ol>
      </section>`);
    app.querySelector('#tstamp').onclick = () => sourceSheet(titleLever, C.titleStamp.why);
    app.querySelector('#share').onclick = () => share(F);
    app.querySelector('#again').onclick = () => { track('rc_replay'); store.del('rc_last'); store.del('rc_run'); S = null; renderSetup(); };
    app.querySelector('#ev').onclick = () => track('rc_evidence_opened', { from: 'end' });
    bindCommon();
  }

  async function share(F) {
    const url = shareUrl(F.archetype);
    const text = fill(C.end.shareText, { archetype: C.outcomes[F.archetype].name, band: L.bands[F.band].toLowerCase(), tax: F.tax });
    track('rc_share');
    if (navigator.share) {
      try { await navigator.share({ title: C.title, text, url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text + ' ' + url); toast(C.end.copied); }
    catch (e) { window.prompt(C.end.share, text + ' ' + url); }
  }

  // ------------------------------------------------------------ boot
  function boot() {
    track('rc_start');
    const saved = store.get('rc_run');
    const game = saved ? E.replay(saved) : null;
    if (game && !game.done && game.choices.length) return renderResume(game);
    store.del('rc_run'); // stale, corrupted, finished or empty: nothing to resume
    renderSetup();
  }
  boot();
})();
