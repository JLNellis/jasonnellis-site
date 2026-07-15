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
  eleventyConfig.addPassthroughCopy("index.html");
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

  eleventyConfig.addCollection("essays", (collectionApi) => {
    return collectionApi.getFilteredByGlob("essays/*.md").sort(
      (a, b) => b.date - a.date
    );
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
