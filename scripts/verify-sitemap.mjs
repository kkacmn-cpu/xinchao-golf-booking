import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");
const entries = [...sitemap.matchAll(/<loc\s*>\s*([^<]+?)\s*<\/loc\s*>/g)].map((match) => match[1].trim());
const openingTags = (sitemap.match(/<loc\b/g) || []).length;
if (!entries.length || entries.length !== openingTags || !sitemap.includes("</urlset>")) {
  throw new Error("Sitemap XML URL entries are incomplete.");
}
const urls = new Set(entries);
if (urls.size !== entries.length) throw new Error("Sitemap contains duplicate URLs.");
const origin = new URL(entries[0]).origin;
const errors = [];
const pages = [join(root, "index.html")];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.name === "index.html") pages.push(path);
  }
}
for (const section of ["golf", "guide", "region"]) collect(join(root, section));

const expected = new Set();
const internalTargets = new Set();
let internalLinksChecked = 0;
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const pathname = "/" + relative(root, page).split(sep).join("/").replace(/index\.html$/, "");
  const ownUrl = new URL(pathname, origin).href;
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  if (/\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\)/.test(article)) {
    errors.push(`Unrendered Markdown link in article: ${pathname}`);
  }
  // Static pages must not ship links to absent routes, even if the sitemap is valid.
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = (match[1] ?? match[2]).replaceAll("&amp;", "&");
    try {
      const target = new URL(href, ownUrl);
      if (target.origin !== origin) continue;
      internalLinksChecked++;
      internalTargets.add(target.pathname);
      const file = resolve(root, "." + decodeURIComponent(target.pathname));
      const inRoot = file === root || file.startsWith(root + sep);
      const candidates = [file, join(file, "index.html"), file + ".html"];
      if (!inRoot || !candidates.some((item) => existsSync(item) && statSync(item).isFile())) {
        errors.push(`Missing internal target: ${pathname} -> ${href}`);
      }
    } catch {
      errors.push(`Invalid internal link: ${pathname} -> ${href}`);
    }
  }
  if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) continue;
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  if (canonical !== ownUrl) errors.push(`Canonical mismatch: ${pathname}`);
  if (!urls.has(ownUrl)) errors.push(`Missing from sitemap: ${pathname}`);
  expected.add(ownUrl);
}
for (const url of urls) {
  if (!expected.has(url)) errors.push(`Unexpected sitemap URL: ${url}`);
}
const timezoneGuidePath = join(root, "guide", "vietnam-golf-booking-korea-vietnam-local-time", "index.html");
const timezoneGuide = readFileSync(timezoneGuidePath, "utf8");
const timezoneHead = timezoneGuide.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
if ((timezoneGuide.match(/<h1\b/gi) || []).length !== 1) errors.push("Vietnam booking time guide must have exactly one H1.");
if (!timezoneGuide.includes("한국시간에서 2시간을 빼면") || !timezoneGuide.includes("2026년 10월 3일 00시 30분")) errors.push("Vietnam booking time guide is missing its direct answer or date-rollover example.");
if (!timezoneGuide.includes("time-zones/tzdb-2026d/asia") || !timezoneGuide.includes("2026-09-30")) errors.push("Vietnam booking time guide must record the IANA source and verification date.");
const timezoneJsonLd = [...timezoneHead.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
for (const script of timezoneJsonLd) {
  try {
    JSON.parse(script[1]);
  } catch {
    errors.push("Vietnam booking time guide contains invalid JSON-LD.");
  }
}
if (!timezoneJsonLd.some((script) => script[1].includes('"@type":"Article"'))) errors.push("Vietnam booking time guide Article schema is missing.");
if (!timezoneJsonLd.some((script) => script[1].includes('"@type":"FAQPage"'))) errors.push("Vietnam booking time guide FAQ schema is missing.");
console.log(JSON.stringify({ indexablePages: expected.size, sitemapUrls: urls.size, internalLinksChecked, internalTargets: internalTargets.size, errors }, null, 2));
if (errors.length) process.exitCode = 1;
