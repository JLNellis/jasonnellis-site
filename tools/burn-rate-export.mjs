// Export the Burn Rate result log to CSV on stdout.
//
//   NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... node tools/burn-rate-export.mjs > burn-rate.csv
//   ... node tools/burn-rate-export.mjs 2026-10   # one month only
//
// Site ID: Netlify → Site configuration → General. Token: User settings →
// Applications → Personal access tokens.
//
// Columns e_* are 1 when the creator typed that stage's hours themselves,
// 0 when it was left on the prefilled default. Filter on those before
// quoting any per-stage number.
import { getStore } from "@netlify/blobs";

const { NETLIFY_SITE_ID: siteID, NETLIFY_AUTH_TOKEN: token } = process.env;
if (!siteID || !token) {
  console.error("Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN.");
  process.exit(1);
}

const STAGES = ["idea", "script", "shoot", "edit", "pack", "comm"];
const store = getStore({ name: "burn-rate", siteID, token });
const { blobs } = await store.list({ prefix: process.argv[2] ? `${process.argv[2]}/` : undefined });

const head = ["month", "platform", "format", "cadence", "avail", ...STAGES.map((s) => `h_${s}`), "h_total", ...STAGES.map((s) => `e_${s}`), "typed_avail", "typed_cadence", "verdict"];
const lines = [head.join(",")];
for (const { key } of blobs) {
  const r = await store.get(key, { type: "json" });
  if (!r) continue;
  const total = r.h.reduce((a, b) => a + b, 0);
  lines.push([r.month, r.p, r.f, r.c, r.a, ...r.h, total, ...r.e, r.ta, r.tc, `"${r.b}"`].join(","));
}
console.log(lines.join("\n"));
console.error(`${lines.length - 1} rows`);
