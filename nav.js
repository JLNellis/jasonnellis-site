// ============================================================
//  nav.js — jasonnellis.com
//  Single source of truth for navigation and footer.
//  This file renders <site-header> and <site-footer> on every page.
//
//  TO ADD A PAGE: add one entry to NAV_LINKS.
//  TO UPDATE FOOTER DETAILS: edit SITE_CONFIG.
//  No other files need to change.
// ============================================================

const SITE_CONFIG = {
  substackHandle: 'jasonnellis', // "The Long Yes" — https://jasonnellis.substack.com/
  linkedIn:       'https://linkedin.com/in/jasonnellis',
  twitter:        'https://x.com/jasonnellis',
  podcast:        'https://linktr.ee/jasonnellis',
  email:          'hello@jasonnellis.com',
};

const NAV_LINKS = [
  { href: '/',         label: 'Home'     },
  { href: '/about',    label: 'About'    },
  { href: '/blog',     label: 'Writing'  },
  { href: '/speaking', label: 'Speaking' },
  { href: '/now',      label: 'Now'      },
  { href: '/contact',  label: 'Contact'  },
];

// Resolve current path (handles trailing slash → "/")
function activePage() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

// ---- <site-header> ----------------------------------------
class SiteHeader extends HTMLElement {
  connectedCallback() {
    const page = activePage();
    const links = NAV_LINKS.map(({ href, label }) => {
      const active = page === href ? ' aria-current="page"' : '';
      return `<a href="${href}"${active}>${label}</a>`;
    }).join('\n      ');

    this.outerHTML = `
<header class="site-header">
  <div class="site-header__inner">
    <a href="/" class="brand">
      <span class="mark">JN</span>
      <span class="name">Jason Nellis<small>Strategist · Writer</small></span>
    </a>
    <button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="site-nav">
      <svg class="icon-menu" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      <svg class="icon-close" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <nav class="site-nav" id="site-nav">
      ${links}
      <span class="live-pill"><span class="live-dot"></span>Located in France · Available Worldwide</span>
    </nav>
  </div>
</header>`;

    const header = document.querySelector('.site-header');
    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('.site-nav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
}

// ---- <site-footer> ----------------------------------------
class SiteFooter extends HTMLElement {
  connectedCallback() {
    const { substackHandle, linkedIn, twitter, podcast, email } = SITE_CONFIG;
    const subUrl = `https://${substackHandle}.substack.com`;
    const activeMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const siteLinks = NAV_LINKS.map(({ href, label }) =>
      `<a href="${href}">${label}</a>`
    ).join('\n      ');

    this.outerHTML = `
<footer class="site-footer" data-screen-label="footer">
  <div class="site-footer__inner">
    <div>
      <a href="/" class="brand" style="margin-bottom:14px">
        <span class="mark">JN</span>
        <span class="name">Jason Nellis<small>Strategist · Writer</small></span>
      </a>
      <p style="color:var(--fg-2);font-size:14px;line-height:1.6;margin:14px 0 18px;max-width:320px">Strategy, writing, and the occasional strong opinion.</p>
      <span class="live-pill"><span class="live-dot"></span>Currently active · ${activeMonth}</span>
    </div>
    <div>
      <h4>Site</h4>
      ${siteLinks}
    </div>
    <div>
      <h4>Elsewhere</h4>
      <a href="${linkedIn}" target="_blank" rel="noopener">LinkedIn ↗</a>
      <a href="${twitter}" target="_blank" rel="noopener">X / Twitter ↗</a>
      <a href="${podcast}" target="_blank" rel="noopener">Building Value ↗</a>
      <a href="mailto:${email}">Email ↗</a>
    </div>
    <div>
      <h4>Subscribe</h4>
      <a href="${subUrl}" target="_blank" rel="noopener">The Long Yes ↗</a>
      <a href="/contact">Get in touch</a>
    </div>
  </div>
  <div class="site-footer__bottom">
    <span>© 2026 Jason Nellis</span>
  </div>
</footer>`;
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);
