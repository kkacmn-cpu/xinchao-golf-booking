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
console.log(JSON.stringify({ indexablePages: expected.size, sitemapUrls: urls.size, internalLinksChecked, internalTargets: internalTargets.size, errors }, null, 2));
if (errors.length) process.exitCode = 1;
