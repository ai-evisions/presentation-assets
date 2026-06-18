#!/usr/bin/env node
/**
 * evisions presentation-assets build.
 * Takes hand-picked originals from originals/ (gitignored), writes web-optimized
 * derivatives to optimized/ (committed + served), and regenerates manifest.json
 * with jsDelivr URLs. Zero npm deps; uses macOS `sips`. Run: `node build.mjs`.
 * Version the served URLs by setting ASSET_VERSION (defaults to v1); see publish.sh.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "originals");
const OUT = join(ROOT, "optimized");
const REPO = "ai-evisions/presentation-assets";
const VERSION = process.env.ASSET_VERSION || "v1";
const MAX_EDGE = 1600;
const JPEG_Q = 82;

// src = filename in originals/ ; out = curated filename in optimized/
const ASSETS = [
  { src: "evisions_logo_black_RGB.svg", out: "logo-evisions-horizontal-black.svg", mode: "copy",
    description: "Horizontal evisions logo lockup (brandmark + wordmark) in black, vector SVG.",
    tags: ["logo", "brand", "vector"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "Group 34 Kopie.svg", out: "brandmark-tile-dark.svg", mode: "copy",
    description: "evisions brandmark (arch + arrow) on a dark #202020 square tile, vector SVG.",
    tags: ["brandmark", "brand", "dark", "vector"], orientation: "square", people: false, usage: "client-safe" },
  { src: "brandmark-1.png", out: "brandmark-arch-arrow.png", mode: "copy",
    description: "evisions brandmark (orange arc + dark arrow), standalone glyph.",
    tags: ["brandmark", "logo", "brand"], orientation: "square", people: false, usage: "client-safe" },
  { src: "evisions_linkedin_cover_PERSONAL_logo (1).png", out: "brand-linkedin-cover-dark.png", mode: "copy",
    description: "Dark evisions LinkedIn cover banner: centered logo over a dotted globe with the brand gradient accent line.",
    tags: ["brand", "banner", "social", "dark"], orientation: "banner", people: false, usage: "client-safe",
    note: "Original filename was marked PERSONAL (personal-profile cover variant)." },
  { src: "25.png", out: "office-building-exterior-signage.jpg", mode: "jpeg",
    description: "evisions illuminated logo sign on the brick facade of the office building against a clear blue sky.",
    tags: ["office", "exterior", "signage", "brand"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "27.png", out: "mockup-stationery-letterhead.jpg", mode: "jpeg",
    description: "Flat-lay stationery mockup on a dark surface: letterhead, patterned business cards, pencils and paperclips.",
    tags: ["mockup", "stationery", "brand", "pattern"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "28.png", out: "mockup-hoodie-pattern-back.jpg", mode: "jpeg",
    description: "Merch mockup: person from behind in a dark hoodie printed with the arrow pattern and brandmark, on a dark tiled wall.",
    tags: ["mockup", "merch", "apparel", "pattern"], orientation: "landscape", people: true, usage: "client-safe",
    note: "Person shown from behind, not identifiable." },
  { src: "30.png", out: "mockup-socks-global-sockcess.jpg", mode: "jpeg",
    description: "Merch mockup: folded socks in the arrow pattern, label 'Global sockcess starts with us!', on concrete.",
    tags: ["mockup", "merch", "socks", "pattern", "playful"], orientation: "portrait", people: false, usage: "client-safe" },
  { src: "31.png", out: "mockup-socks-global-sockcess-02.jpg", mode: "jpeg",
    description: "Merch mockup: folded patterned socks with the 'Global sockcess' label (alternate of the socks mockup).",
    tags: ["mockup", "merch", "socks", "pattern", "playful"], orientation: "portrait", people: false, usage: "client-safe",
    note: "Near-duplicate of mockup-socks-global-sockcess.jpg; consider keeping only one." },
  { src: "32.png", out: "mockup-notebook-brain-404.jpg", mode: "jpeg",
    description: "Merch mockup: black notebook with orange band, cover text 'Write it down before your brain 404s'.",
    tags: ["mockup", "merch", "notebook", "playful"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "26.png", out: "mockup-wrapping-paper-pattern.jpg", mode: "jpeg",
    description: "Mockup: rolled wrapping paper printed with the evisions arrow pattern on a dark surface.",
    tags: ["mockup", "pattern", "merch"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "ZO2_8842 Kopie.jpg", out: "office-podcast-studio-neon.jpg", mode: "jpeg",
    description: "Office podcast/recording studio: neon evisions brandmark on an acoustic-panel wall, round wooden table, broadcast mics, velvet chairs.",
    tags: ["office", "studio", "podcast", "neon", "brand"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "ZO2_8836 Kopie.jpg", out: "office-podcast-studio-neon-02.jpg", mode: "jpeg",
    description: "Office podcast/recording studio, wider angle with curtain: neon evisions brandmark, mics and table.",
    tags: ["office", "studio", "podcast", "neon", "brand"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "JW1_0791 Kopie.jpg", out: "office-awards-iea24.jpg", mode: "jpeg",
    description: "IEA24 (Internet Effectiveness Awards) glass trophies on a white table, with colleagues blurred in the background.",
    tags: ["office", "awards", "proof", "team"], orientation: "landscape", people: true, usage: "client-safe",
    note: "Background people are blurred / not the focus." },
  { src: "JW1_0848 Kopie.jpg", out: "office-frosted-glass-pattern.jpg", mode: "jpeg",
    description: "Frosted glass office partition with the evisions arrow pattern cut into it, office bokeh behind.",
    tags: ["office", "pattern", "brand", "detail"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "evisions_logo_white_RGB.svg", out: "logo-evisions-horizontal-white.svg", mode: "copy",
    description: "Horizontal evisions logo lockup (brandmark + wordmark) in white — for use on dark backgrounds.",
    tags: ["logo", "brand", "vector", "white"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "evisions_logo_white_RGB.png", out: "logo-evisions-horizontal-white.png", mode: "copy",
    description: "Horizontal evisions logo lockup (brandmark + wordmark) in white, PNG — for use on dark backgrounds.",
    tags: ["logo", "brand", "white"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "evisions_pattern_expand.png", out: "brandmark-pattern-expand.png", mode: "copy",
    description: "evisions brandmark tiled repeat pattern — used as slide background texture on light-background divider slides.",
    tags: ["brandmark", "brand", "pattern", "texture"], orientation: "landscape", people: false, usage: "client-safe" },
  { src: "JW1_3928 Kopie.jpg", out: "team-group-photo-rustonka.jpg", mode: "jpeg",
    description: "Large evisions team group photo outdoors at the Rustonka plaza, around 30 people plus a dog, office buildings behind.",
    tags: ["team", "people", "office", "group"], orientation: "landscape", people: true, usage: "client-safe" },
];

function dims(p) {
  try {
    const o = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", p], { encoding: "utf8" });
    const w = +(o.match(/pixelWidth:\s*(\d+)/) || [])[1];
    const h = +(o.match(/pixelHeight:\s*(\d+)/) || [])[1];
    return w && h ? { width: w, height: h } : null;
  } catch { return null; }
}

mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const a of ASSETS) {
  const srcPath = join(SRC, a.src);
  const outPath = join(OUT, a.out);
  if (a.mode === "copy") {
    copyFileSync(srcPath, outPath);
  } else {
    const d = dims(srcPath);
    const target = d ? Math.min(MAX_EDGE, Math.max(d.width, d.height)) : MAX_EDGE;
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(JPEG_Q),
      "-Z", String(target), srcPath, "--out", outPath]);
  }
  const od = a.out.endsWith(".svg") ? "vector" : dims(outPath);
  const entry = {
    file: a.out,
    path: `optimized/${a.out}`,
    url: `https://cdn.jsdelivr.net/gh/${REPO}@${VERSION}/optimized/${a.out}`,
    description: a.description,
    tags: a.tags,
    orientation: a.orientation,
    dimensions: od,
    people: a.people,
    usage: a.usage,
  };
  if (a.note) entry.note = a.note;
  manifest.push(entry);
  console.log(`${a.mode === "copy" ? "copied " : "optimized"}  ${a.out}`);
}

writeFileSync(join(ROOT, "manifest.json"), JSON.stringify({
  name: "evisions-presentation-assets",
  description: "Curated, client-safe evisions images for AI-built HTML/PPTX presentation decks. Served via jsDelivr; reference `url` in decks, or embed from `path` for offline/PPTX.",
  version: VERSION,
  repo: REPO,
  cdn_pattern: `https://cdn.jsdelivr.net/gh/${REPO}@${VERSION}/optimized/<file>`,
  note: "Public repo. Only client-safe images belong here. usage=review means confirm consent/personal-data before client-facing use.",
  count: manifest.length,
  assets: manifest,
}, null, 2) + "\n");
console.log(`\nmanifest.json written: ${manifest.length} assets, version ${VERSION}`);
