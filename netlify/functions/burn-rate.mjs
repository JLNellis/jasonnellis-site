// Burn Rate: anonymous result log.
//
// One row per (page view, platform, format), last write wins. This is the
// raw material for the "Hours Per Upload" report: creator-reported hours per
// stage. No IP, no user agent, no timestamp finer than the month, no free
// text. The session id is random, generated in memory on each page load and
// never stored on the device.
//
// Export: node tools/burn-rate-export.mjs (needs NETLIFY_SITE_ID and
// NETLIFY_AUTH_TOKEN).
import { getStore } from "@netlify/blobs";

// Keep in sync with PLATFORMS / FORMATS / BANDS in burn-rate.html.
const PLATFORMS = ["yt", "shorts", "tiktok", "reels", "twitch", "podcast", "news"];
const FORMATS = ["talk", "vlog", "essay", "gaming", "cooking", "review", "podv", "poda", "short", "clip", "faceless", "live"];
const BANDS = ["Idling", "Sustainable", "Running hot", "Burning", "Flameout"];

const num = (x, lo, hi) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
const bit = (x) => x === 0 || x === 1;

function validate(r) {
  if (!r || r.v !== 1) return null;
  if (typeof r.sid !== "string" || !/^[a-z0-9]{12}$/.test(r.sid)) return null;
  if (!PLATFORMS.includes(r.p) || !FORMATS.includes(r.f) || !BANDS.includes(r.b)) return null;
  if (!num(r.c, 0.25, 50) || !num(r.a, 0.5, 100)) return null;
  if (!Array.isArray(r.h) || r.h.length !== 6 || !r.h.every((h) => num(h, 0, 200))) return null;
  if (!Array.isArray(r.e) || r.e.length !== 6 || !r.e.every(bit)) return null;
  if (!bit(r.ta) || !bit(r.tc)) return null;
  // Only rows where the creator typed something carry information.
  if (!r.e.includes(1) && !r.ta) return null;
  return { v: 1, p: r.p, f: r.f, c: r.c, a: r.a, h: r.h, e: r.e, ta: r.ta, tc: r.tc, b: r.b };
}

export default async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const body = await req.text();
  if (body.length > 1000) return new Response(null, { status: 413 });
  let parsed;
  try { parsed = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
  const row = validate(parsed);
  if (!row) return new Response(null, { status: 400 });

  const month = new Date().toISOString().slice(0, 7);
  const store = getStore("burn-rate");
  await store.setJSON(`${month}/${parsed.sid}-${row.p}-${row.f}`, { ...row, month });
  return new Response(null, { status: 204 });
};

export const config = {
  path: "/api/burn-rate",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
