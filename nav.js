// ============================================================
//  nav.js — jasonnellis.com
//  Single source of truth for navigation and footer.
//  This file renders <site-header> and <site-footer> on every page.
//
//  TO ADD A PAGE: add one entry to NAV_LINKS (header nav + footer "Site" column).
//  footerOnly entries skip the header (the logo already goes home; Contact is
//  the header's button, not a link).
//  TO ADD A LEGAL/UTILITY LINK (privacy, terms…): add one entry to LEGAL_LINKS
//  (footer bottom bar). Both lists render on every page that includes this file.
//  TO UPDATE FOOTER DETAILS: edit SITE_CONFIG.
//  No other files need to change.
// ============================================================

// ---- Privacy-friendly analytics (Umami Cloud) — single source for the whole site.
//      Cookieless, so no consent banner is required. Standalone pages that don't
//      load nav.js (the-feed.html, ascii.html) carry the same tag inline in <head>.
//      data-domains stops localhost and Netlify deploy previews being counted.
//      Custom events: window.siteTrack(name, data). Umami has no pre-load queue,
//      so a call made before the tracker arrives retries for up to 10 seconds. ----
(function () {
  if (window.__umamiLoaded) return;
  window.__umamiLoaded = true;
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.setAttribute('data-website-id', '9a9424b4-d604-4e86-87ba-beb2c77ddd5e');
  s.setAttribute('data-domains', 'jasonnellis.com,www.jasonnellis.com,thefeed.jasonnellis.com');
  (document.head || document.documentElement).appendChild(s);
  window.siteTrack = function track(name, data, tries) {
    try {
      if (window.umami) window.umami.track(name, data);
      else if ((tries || 0) < 20) setTimeout(function () { track(name, data, (tries || 0) + 1); }, 500);
    } catch (e) {}
  };
})();

// ---- Dated content: any element with data-expires="YYYY-MM-DD" is removed from
//      that day on (visitor's local time), so event notices retire themselves
//      without a rebuild. A "Where I'll be" strip with no rows left goes too. ----
document.addEventListener('DOMContentLoaded', function () {
  var now = new Date();
  document.querySelectorAll('[data-expires]').forEach(function (el) {
    if (now >= new Date(el.getAttribute('data-expires') + 'T00:00:00')) el.remove();
  });
  document.querySelectorAll('.where-section').forEach(function (sec) {
    if (!sec.querySelector('.where-row')) sec.remove();
  });
});

// ---- Click-to-load YouTube: <a class="yt-facade" data-yt="ID" href="…watch?v=ID">
//      is a plain YouTube link without JS. With JS, a click swaps in the
//      privacy-enhanced player, so nothing loads from Google until the visitor
//      asks for it (which is what /privacy promises). ----
document.addEventListener('click', function (e) {
  var link = e.target.closest && e.target.closest('a.yt-facade[data-yt]');
  if (!link || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  var frame = document.createElement('iframe');
  frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(link.dataset.yt) + '?autoplay=1';
  frame.title = link.dataset.title || 'YouTube video';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  link.replaceWith(frame);
  frame.focus();
});

const SITE_CONFIG = {
  newsletterUrl:  '/building-value', // newsletter home on this site (Kit's own hosted form page is unbranded — don't link it)
  newsletterPost: 'https://app.kit.com/forms/9920578/subscriptions', // form POST endpoint (field: email_address)
  linkedIn:       'https://linkedin.com/in/jasonnellis',
  twitter:        'https://x.com/jasonnellis',
  podcast:        'https://www.youtube.com/@JasonNellis', // Building Value on YouTube
  email:          'hello@jasonnellis.com',
};

const LOGO_MARK_SVG = `<svg viewBox="0 0 1024 1024" aria-hidden="true" focusable="false"><path fill="#00E676" d="M300 145H790V675C790 825 680 900 520 900C360 900 250 820 250 675H410C410 755 450 792 520 792C590 792 630 750 630 675V292H300Z"/><path fill="#FFFFFF" d="M300 145H700L555 292H300Z"/></svg>`;

// Order: About first (the operating history leads), then Speaking, then the
// writing, podcast and experiments, with Advisory last.
const NAV_LINKS = [
  { href: '/',         label: 'Home', footerOnly: true },
  { href: '/about',    label: 'About'    },
  { href: '/speaking', label: 'Speaking' },
  { href: '/blog',     label: 'Writing'  },
  { href: '/building-value', label: 'Podcast' },
  { href: '/experiments', label: 'Experiments' },
  { href: '/advisory', label: 'Advisory' },
  { href: '/contact',  label: 'Contact', footerOnly: true },
];

// Footer bottom bar, next to the copyright line. Every page that renders
// <site-footer> gets these automatically — never hand-link them elsewhere.
const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy &amp; legal' },
];

// Resolve current path (handles trailing slash → "/")
function activePage() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

// A link is current on its own path and on anything beneath it, so
// /speaking/<slug> lights Speaking and /blog/<slug> lights Writing.
// "/" matches only the homepage.
function isCurrent(page, href) {
  if (href === '/') return page === '/';
  return page === href || page.startsWith(href + '/');
}

// ---- <site-header> ----------------------------------------
class SiteHeader extends HTMLElement {
  connectedCallback() {
    const page = activePage();
    const current = (href) => isCurrent(page, href) ? ' aria-current="page"' : '';
    const links = NAV_LINKS.filter(({ footerOnly }) => !footerOnly).map(({ href, label }) =>
      `<a href="${href}"${current(href)}>${label}</a>`
    ).join('\n      ');

    this.outerHTML = `
<header class="site-header">
  <div class="site-header__inner">
    <a href="/" class="brand">
      <span class="mark">${LOGO_MARK_SVG}</span>
      <span class="name">Jason Nellis</span>
    </a>
    <button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="site-nav">
      <svg class="icon-menu" aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      <svg class="icon-close" aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <nav class="site-nav" id="site-nav">
      ${links}
      <a href="/contact" class="btn ghost nav-cta"${current('/contact')}>Get in touch</a>
    </nav>
  </div>
</header>`;

    const header = document.querySelector('.site-header');
    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('.site-nav');
    const isOpen = () => nav.classList.contains('is-open');
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!isOpen()));
    // The mobile menu closes on Escape (focus goes back to the toggle), on a
    // tap anywhere outside the header, and when Tab moves focus past it.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      toggle.focus();
    });
    document.addEventListener('click', (e) => {
      if (isOpen() && !header.contains(e.target)) setOpen(false);
    });
    header.addEventListener('focusout', (e) => {
      if (isOpen() && e.relatedTarget && !header.contains(e.relatedTarget)) setOpen(false);
    });
  }
}

// ---- <site-footer> ----------------------------------------
class SiteFooter extends HTMLElement {
  connectedCallback() {
    const { newsletterUrl, linkedIn, twitter, podcast, email } = SITE_CONFIG;
    const subUrl = newsletterUrl;

    const siteLinks = NAV_LINKS.map(({ href, label }) =>
      `<a href="${href}">${label}</a>`
    ).join('\n      ');
    const legalLinks = LEGAL_LINKS.map(({ href, label }) =>
      `<a href="${href}">${label}</a>`
    ).join('\n      ');

    this.outerHTML = `
<footer class="site-footer" data-screen-label="footer">
  <div class="site-footer__inner">
    <div>
      <a href="/" class="brand" style="margin-bottom:14px">
        <span class="mark">${LOGO_MARK_SVG}</span>
        <span class="name">Jason Nellis</span>
      </a>
      <p style="color:var(--fg-2);font-size:14px;line-height:1.6;margin:14px 0 0;max-width:320px">Product and go-to-market executive in creator economy, media and consumer tech. Plus writing, a podcast, and the occasional strong opinion.</p>
    </div>
    <div>
      <h2 class="col-title">Site</h2>
      ${siteLinks}
    </div>
    <div>
      <h2 class="col-title">Elsewhere</h2>
      <a href="${linkedIn}" target="_blank" rel="noopener">LinkedIn <span aria-hidden="true">↗</span></a>
      <a href="${twitter}" target="_blank" rel="noopener">X / Twitter <span aria-hidden="true">↗</span></a>
      <a href="${podcast}" target="_blank" rel="noopener">Building Value on YouTube <span aria-hidden="true">↗</span></a>
      <a href="mailto:${email}">Email <span aria-hidden="true">↗</span></a>
    </div>
    <div>
      <h2 class="col-title">Subscribe</h2>
      <a href="${subUrl}">Building Value</a>
      <a href="/feed.xml">RSS feed <span aria-hidden="true">↗</span></a>
      <a href="/contact">Get in touch</a>
    </div>
  </div>
  <div class="site-footer__bottom">
    <span>© ${new Date().getFullYear()} Jason Nellis</span>
    <nav class="site-footer__legal" aria-label="Legal">
      ${legalLinks}
    </nav>
  </div>
</footer>`;
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);
