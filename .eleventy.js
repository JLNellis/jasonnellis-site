const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Compile (never run) every inline <script> in the built HTML and parse every
// JSON-LD block. A syntax error throws, which fails the Netlify build instead
// of shipping a page whose JS is dead (an unescaped apostrophe in contact.html
// once killed its whole script).
function checkInlineScripts(dir) {
  const errors = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((entry) => {
    const p = path.join(d, entry.name);
    if (entry.isDirectory()) return walk(p);
    if (!entry.name.endsWith(".html")) return;
    const html = fs.readFileSync(p, "utf8");
    for (const [, attrs, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc=/i.test(attrs) || !code.trim()) continue;
      const file = path.relative(dir, p);
      try {
        if (/application\/ld\+json/i.test(attrs)) JSON.parse(code);
        else if (!/\btype=/i.test(attrs) || /javascript/i.test(attrs)) new vm.Script(code, { filename: file });
      } catch (err) {
        errors.push(`${file}: ${err.message}`);
      }
    }
  });
  walk(dir);
  if (errors.length) throw new Error("Inline script syntax check failed:\n  " + errors.join("\n  "));
}

module.exports = function (eleventyConfig) {
  eleventyConfig.on("eleventy.after", ({ dir }) => checkInlineScripts(dir.output));

  // Static assets used by the hand-authored pages — copied through untouched.
  eleventyConfig.addPassthroughCopy("site.css");
  eleventyConfig.addPassthroughCopy("colors_and_type.css");
  eleventyConfig.addPassthroughCopy("nav.js");
  eleventyConfig.addPassthroughCopy("fonts");
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addPassthroughCopy("favicon.svg");
  eleventyConfig.addPassthroughCopy("apple-touch-icon.png");
  eleventyConfig.addPassthroughCopy("android-chrome-192x192.png");
  eleventyConfig.addPassthroughCopy("android-chrome-512x512.png");
  eleventyConfig.addPassthroughCopy("maskable-icon-512x512.png");
  eleventyConfig.addPassthroughCopy("site.webmanifest");
  eleventyConfig.addPassthroughCopy("og-image.png");
  eleventyConfig.addPassthroughCopy("og-image-speaking.png");
  eleventyConfig.addPassthroughCopy("jason-headshot.jpg");
  eleventyConfig.addPassthroughCopy("officeheadshot.jpg");
  eleventyConfig.addPassthroughCopy("superbam.jpg");
  eleventyConfig.addPassthroughCopy("hulu.jpg");
  eleventyConfig.addPassthroughCopy("packagd.jpeg");
  eleventyConfig.addPassthroughCopy("og-case-hulu.jpg");
  eleventyConfig.addPassthroughCopy("og-case-packagd.jpg");
  eleventyConfig.addPassthroughCopy("og-talk-ai-strategy.jpg");
  eleventyConfig.addPassthroughCopy("og-talk-media-cycle.jpg");
  eleventyConfig.addPassthroughCopy("og-talk-creators.jpg");
  eleventyConfig.addPassthroughCopy("og-lens.jpg");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("_redirects");

  // Hand-authored pages — copied byte-for-byte, same flat filenames, no
  // templating, no pretty-URL folder rewrite (existing _redirects and
  // Netlify's 404.html convention both depend on these exact paths).
  // index.njk is the one exception — it's Nunjucks-templated (for the
  // dynamic "recent writing" teaser) so it goes through the normal build
  // pipeline instead of passthrough copy.
  eleventyConfig.addPassthroughCopy("bio.html");
  eleventyConfig.addPassthroughCopy("contact.html");
  eleventyConfig.addPassthroughCopy("speaking.html");
  eleventyConfig.addPassthroughCopy("ascii.html");
  eleventyConfig.addPassthroughCopy("press-kit.html");
  eleventyConfig.addPassthroughCopy("advisory.html");
  eleventyConfig.addPassthroughCopy("lens.html");
  eleventyConfig.addPassthroughCopy("the-feed.html");
  eleventyConfig.addPassthroughCopy("burn-rate.html");
  eleventyConfig.addPassthroughCopy("og-burn-rate.jpg");
  eleventyConfig.addPassthroughCopy("og-advisory.jpg");
  eleventyConfig.addPassthroughCopy("advisory-panel.jpg");
  eleventyConfig.addPassthroughCopy("the-feed-engine.js");
  eleventyConfig.addPassthroughCopy("robot-comments.html");
  eleventyConfig.addPassthroughCopy("robot-comments-ui.js");
  eleventyConfig.addPassthroughCopy("robot-comments-data.js");
  eleventyConfig.addPassthroughCopy("robot-comments-bands.js");
  eleventyConfig.addPassthroughCopy("robot-comments-engine.js");
  eleventyConfig.addPassthroughCopy("robot-comments-copy.js");
  eleventyConfig.addPassthroughCopy("og-robot-comments*.jpg");
  // The Feed assets: only the WebP derivatives, sounds and credits ship. The PNG art library
  // (the-feed-assets/the-feed-art-library-v2, ~95 MB of originals) is gitignored and not deployed.
  eleventyConfig.addPassthroughCopy("the-feed-assets/imgs");
  eleventyConfig.addPassthroughCopy("the-feed-assets/sfx");
  eleventyConfig.addPassthroughCopy("the-feed-assets/CREDITS.md");
  eleventyConfig.addPassthroughCopy("building-value.html");
  eleventyConfig.addPassthroughCopy("privacy.html");
  eleventyConfig.addPassthroughCopy("building-value-header.jpg");
  eleventyConfig.addPassthroughCopy("speaking-ifa.jpg");
  eleventyConfig.addPassthroughCopy("speaking-ifa-panel.jpg");
  eleventyConfig.addPassthroughCopy("jason-nellis-headshot-stage.jpg");
  eleventyConfig.addPassthroughCopy("jason-nellis-headshot-stage-2400.jpg");
  eleventyConfig.addPassthroughCopy("jason-nellis-stage-portrait.jpg");
  eleventyConfig.addPassthroughCopy("jason-nellis-stage-3x4-600.jpg");
  eleventyConfig.addPassthroughCopy("og-speaking-ifa.jpg");
  eleventyConfig.addPassthroughCopy("logo-ifa.png");
  eleventyConfig.addPassthroughCopy("logo-latitude59.png");
  eleventyConfig.addPassthroughCopy("logo-zest.png");
  eleventyConfig.addPassthroughCopy("logo-pakcon.svg");
  eleventyConfig.addPassthroughCopy("logo-vidcon.png");
  // Video (self-hosted, compressed) + poster frames. Raw masters live in
  // /videos as sources and are deliberately kept out of the build and git.
  eleventyConfig.addPassthroughCopy("reel-super-2022.mp4");
  eleventyConfig.addPassthroughCopy("reel-super-2022.jpg");
  eleventyConfig.addPassthroughCopy("austin-evans-favorite-tech.mp4");
  eleventyConfig.addPassthroughCopy("austin-evans-favorite-tech.jpg");
  eleventyConfig.addPassthroughCopy("austin-evans-rapid-fire.mp4");
  eleventyConfig.addPassthroughCopy("austin-evans-rapid-fire.jpg");
  eleventyConfig.addPassthroughCopy("building-value-piano.mp4");
  eleventyConfig.addPassthroughCopy("building-value-piano.jpg");
  eleventyConfig.addPassthroughCopy("zest-malta.jpg");
  eleventyConfig.addPassthroughCopy("latitude59.jpg");
  eleventyConfig.addPassthroughCopy("jason-nellis-speaker-kit.pdf");
  eleventyConfig.addPassthroughCopy("thanks.html");
  eleventyConfig.addPassthroughCopy("404.html");

  // tools/ is the scripts folder (sim, tests, OG-image sources) — its README.md
  // files must not render as pages under /tools/ next to the Tools index.
  eleventyConfig.ignores.add("tools/**");

  // The one human-readable essay date, used everywhere a date is shown:
  // "Sep 29, 2026". Month-only dates elsewhere follow the same "Sep 2026" form.
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    });
  });
  // Blog filter chips: only categories that hold more than one essay, most
  // posts first, so the chips grow on their own as the archive does.
  eleventyConfig.addFilter("sharedCategories", (essays) => {
    const counts = {};
    essays.forEach((e) => { counts[e.data.category] = (counts[e.data.category] || 0) + 1; });
    return Object.keys(counts)
      .filter((cat) => counts[cat] > 1)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  });
  eleventyConfig.addFilter("isoDate", (dateObj) => {
    return new Date(dateObj).toISOString();
  });
  eleventyConfig.addFilter("w3cDate", (dateObj) => {
    return new Date(dateObj).toISOString().slice(0, 10);
  });

  eleventyConfig.addCollection("essays", (collectionApi) => {
    return collectionApi.getFilteredByGlob("essays/*.md")
      .filter((essay) => !essay.data.unlisted)
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("recentEssays", (collectionApi) => {
    return collectionApi.getFilteredByGlob("essays/*.md")
      .filter((essay) => !essay.data.unlisted)
      .sort((a, b) => b.date - a.date)
      .slice(0, 4);
  });

  eleventyConfig.addCollection("talks", (collectionApi) => {
    return collectionApi.getFilteredByGlob("talks/*.md").sort(
      (a, b) => a.data.order - b.data.order
    );
  });

  // Tools index (/tools + homepage teaser). One tool-index/<slug>.md per
  // tool; the tool pages themselves are standalone HTML, so the collection
  // emits no pages (permalink: false in tool-index/tool-index.json).
  eleventyConfig.addCollection("tools", (collectionApi) => {
    return collectionApi.getFilteredByGlob("tool-index/*.md").sort(
      (a, b) => a.data.order - b.data.order
    );
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
    },
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md"],
  };
};
