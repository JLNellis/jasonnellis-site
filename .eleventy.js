module.exports = function (eleventyConfig) {
  // Static assets used by the hand-authored pages — copied through untouched.
  eleventyConfig.addPassthroughCopy("site.css");
  eleventyConfig.addPassthroughCopy("colors_and_type.css");
  eleventyConfig.addPassthroughCopy("nav.js");
  eleventyConfig.addPassthroughCopy("favicon.png");
  eleventyConfig.addPassthroughCopy("og-image.png");
  eleventyConfig.addPassthroughCopy("og-image-speaking.png");
  eleventyConfig.addPassthroughCopy("jason-headshot.jpg");
  eleventyConfig.addPassthroughCopy("casualheadshot.JPG");
  eleventyConfig.addPassthroughCopy("officeheadshot.jpg");
  eleventyConfig.addPassthroughCopy("IMG_0205.jpg");
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
  eleventyConfig.addPassthroughCopy("now.html");
  eleventyConfig.addPassthroughCopy("ascii.html");
  eleventyConfig.addPassthroughCopy("press-kit.html");
  eleventyConfig.addPassthroughCopy("jason-nellis-speaker-kit.pdf");
  eleventyConfig.addPassthroughCopy("404.html");

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
  eleventyConfig.addFilter("dotDate", (dateObj) => {
    const d = new Date(dateObj);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy} · ${mm} · ${dd}`;
  });

  eleventyConfig.addCollection("essays", (collectionApi) => {
    return collectionApi.getFilteredByGlob("essays/*.md").sort(
      (a, b) => b.date - a.date
    );
  });

  eleventyConfig.addCollection("recentEssays", (collectionApi) => {
    return collectionApi.getFilteredByGlob("essays/*.md")
      .sort((a, b) => b.date - a.date)
      .slice(0, 4);
  });

  eleventyConfig.addCollection("talks", (collectionApi) => {
    return collectionApi.getFilteredByGlob("talks/*.md").sort(
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
