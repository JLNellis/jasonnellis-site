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
  substackHandle: 'YOUR-SUBSTACK-HANDLE', // ← replace once your Substack is live
  lastUpdated:    'June 2026',            // ← update when you make site changes
  linkedIn:       'https://linkedin.com/in/jasonnellis',
  twitter:        'https://x.com/jasonnellis',
  podcast:        'https://linktr.ee/jasonnellis',
  email:          'hello@jasonnellis.com',
};

const NAV_LINKS = [
  { href: 'index.html',    label: 'Home'     },
  { href: 'blog.html',     label: 'Writing'  },
  { href: 'speaking.html', label: 'Speaking' },
  { href: 'now.html',      label: 'Now'      },
  { href: 'bio.html',      label: 'About'    },
  { href: 'contact.html',  label: 'Contact'  },
];

// Resolve current filename from path (handles trailing slash → index.html)
function activePage() {
  const file = window.location.pathname.split('/').pop();
  return file || 'index.html';
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
    <a href="index.html" class="brand">
      <span class="mark">JN</span>
      <span class="name">Jason Nellis<small>Strategist · Writer</small></span>
    </a>
    <nav class="site-nav">
      ${links}
      <span class="live-pill" style="margin-left:12px"><span class="live-dot"></span>Located in France · Available Worldwide</span>
    </nav>
  </div>
</header>`;
  }
}

// ---- <site-footer> ----------------------------------------
class SiteFooter extends HTMLElement {
  connectedCallback() {
    const { substackHandle, lastUpdated, linkedIn, twitter, podcast, email } = SITE_CONFIG;
    const subUrl = `https://${substackHandle}.substack.com`;

    const siteLinks = NAV_LINKS.map(({ href, label }) =>
      `<a href="${href}">${label}</a>`
    ).join('\n      ');

    this.outerHTML = `
<footer class="site-footer" data-screen-label="footer">
  <div class="site-footer__inner">
    <div>
      <a href="index.html" class="brand" style="margin-bottom:14px">
        <span class="mark">JN</span>
        <span class="name">Jason Nellis<small>Strategist · Writer</small></span>
      </a>
      <p style="color:var(--fg-2);font-size:14px;line-height:1.6;margin:14px 0 18px;max-width:320px">Strategy, writing, and the occasional strong opinion.</p>
      <span class="live-pill"><span class="live-dot"></span>Last updated · ${lastUpdated}</span>
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
      <a href="${subUrl}" target="_blank" rel="noopener">Newsletter ↗</a>
      <a href="contact.html">Get in touch</a>
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
