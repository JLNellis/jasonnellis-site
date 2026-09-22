module.exports = function (eleventyConfig) {
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
  eleventyConfig.addPassthroughCopy("jason-headshot-blog.jpg");
  eleventyConfig.addPassthroughCopy("officeheadshot.jpg");
  eleventyConfig.addPassthroughCopy("superbam.jpg");
  eleventyConfig.addPassthroughCopy("hulu.jpg");
  eleventyConfig.addPassthroughCopy("packagd.jpeg");
  eleventyConfig.addPassthroughCopy("og-case-hulu.jpg");
  eleventyConfig.addPassthroughCopy("og-case-superbam.jpg");
  eleventyConfig.addPassthroughCopy("og-case-packagd.jpg");
  eleventyConfig.addPassthroughCopy("og-talk-ai-strategy.jpg");
  eleventyConfig.addPassthroughCopy("og-talk-media-cycle.jpg");
  eleventyConfig.addPassthroughCopy("og-talk-creators.jpg");
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
  eleventyConfig.addPassthroughCopy("the-feed-engine.js");
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

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
  });
  eleventyConfig.addFilter("monthYear", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric", month: "short", timeZone: "UTC",
    });
  });
  eleventyConfig.addFilter("isoDate", (dateObj) => {
    return new Date(dateObj).toISOString();
  });
  eleventyConfig.addFilter("w3cDate", (dateObj) => {
    return new Date(dateObj).toISOString().slice(0, 10);
  });
  eleventyConfig.addFilter("dotDate", (dateObj) => {
    const d = new Date(dateObj);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy} · ${mm} · ${dd}`;
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
