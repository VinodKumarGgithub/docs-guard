import { mkdirSync, writeFileSync } from "node:fs";
import { BRANCH, DOCS_DIR, EXCLUDE, INCLUDE, REPO, publicUrl } from "./sources.ts";

export interface Passage { id: string; url: string; title: string; heading: string; text: string }

/** Markdown → readable text: code blocks, GitBook tags, HTML, images and link targets are dropped; link text is kept. */
export function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")            // code blocks: the assistant quotes prose, a reader opens the page for code
    .replace(/\{%[\s\S]*?%\}/g, " ")            // GitBook tags ({% hint %}, {% tabs %} …)
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")      // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")    // links → their text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")              // list bullets
    .replace(/^\s*\|?[-:| ]+\|?\s*$/gm, " ")    // table separator rows
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");
}

/** A Markdown page as (heading, text) sections, split on #–#### headings. */
export function sections(md: string, fallbackTitle: string): { title: string; sections: { heading: string; text: string }[] } {
  const body = md.replace(/^---[\s\S]*?---\s*/, "");   // front matter
  const title = body.match(/^#\s+(.+)$/m)?.[1].trim() ?? fallbackTitle;
  const out: { heading: string; text: string }[] = [];
  let heading = title;
  let buf: string[] = [];
  let inCode = false;
  const flush = () => {
    const text = plain(buf.join("\n")).split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(l => l.length > 2).join(" ");
    if (text.split(" ").length >= 8) out.push({ heading, text });
    buf = [];
  };
  for (const line of body.split("\n")) {
    if (/^```/.test(line.trim())) inCode = !inCode;
    const h = !inCode && line.match(/^#{1,4}\s+(.+)$/);
    if (h) { flush(); heading = plain(h[1]).trim() || heading; continue; }
    buf.push(line);
  }
  flush();
  return { title, sections: out };
}

/** Sections longer than ~140 words are split on sentence boundaries, so each passage answers one thing. */
export function chunk(text: string, max = 140): string[] {
  const safe = text.replace(/\b(e\.g|i\.e|etc|approx|vs)\./gi, m => m.replace(/\./g, "․")); // keep abbreviations inside their sentence
  const sentences = (safe.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [safe]).map(x => x.replace(/․/g, "."));
  const chunks: string[] = [];
  let cur: string[] = [];
  for (const s of sentences) {
    if (cur.length && (cur.join(" ") + " " + s).split(/\s+/).length > max) { chunks.push(cur.join(" ").trim()); cur = []; }
    cur.push(s.trim());
  }
  if (cur.length) chunks.push(cur.join(" ").trim());
  return chunks;
}

const UA = { "user-agent": "docs-guard/0.1 (public-docs demo)" };

export async function ingest(out = "data/passages.json"): Promise<Passage[]> {
  const tree = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`, { headers: UA });
  if (!tree.ok) throw new Error(`GitHub tree: ${tree.status}`);
  const paths = ((await tree.json()) as { tree: { path: string }[] }).tree.map(t => t.path)
    .filter(p => p.startsWith(DOCS_DIR) && p.endsWith(".md")).map(p => p.slice(DOCS_DIR.length))
    .filter(p => INCLUDE.test(p) && !EXCLUDE.test(p));
  const passages: Passage[] = [];
  for (const path of paths) {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${DOCS_DIR}${path}`, { headers: UA });
    if (!res.ok) { console.warn(`skipped ${path}: ${res.status}`); continue; }
    const page = sections(await res.text(), path);
    const seen = new Set<string>();
    for (const s of page.sections) for (const text of chunk(s.text)) {
      if (seen.has(text)) continue;
      seen.add(text);
      passages.push({ id: `p${passages.length + 1}`, url: publicUrl(path), title: page.title, heading: s.heading, text });
    }
  }
  console.log(`${paths.length} pages`);
  mkdirSync("data", { recursive: true });
  writeFileSync(out, JSON.stringify(passages, null, 1));
  return passages;
}
