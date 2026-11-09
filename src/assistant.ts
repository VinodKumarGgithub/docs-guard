import type { Passage } from "./ingest.ts";
import { Index, terms, type Hit } from "./retrieve.ts";
import { triage, type Route } from "./triage.ts";

export interface Reply {
  question: string;
  route: Route;
  reason: string; // the rule that fired, or why retrieval answered or didn't
  text: string; // what the user would see
  sources: string[];
  handover?: { to: string; suggested: { url: string; heading: string }[] }; // the packet a person picks up
  ms: number;
}

/** Anything that turns retrieved passages into an answer. The extractive one quotes the docs; an LLM writer can replace
 *  it, and the release check then tests the LLM's answers the same way. */
export interface Writer { name: string; write(question: string, hits: Hit[]): Promise<{ text: string; sources: string[] }> }

export const extractive: Writer = {
  name: "extractive (quotes the docs)",
  async write(question, hits) {
    const top = hits[0].passage;
    const want = new Set(terms(question));
    const sentences = (top.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [top.text]).map(s => s.trim());
    const overlap = (s: string) => terms(s).filter(t => want.has(t)).length;
    // FAQ-style passages hold "question? answer." pairs: when one of their questions matches, quote the answer after it
    const asked = sentences.map((s, i) => ({ i, n: s.endsWith("?") ? overlap(s) : 0 })).sort((a, b) => b.n - a.n)[0];
    let picked: number[];
    if (asked?.n >= 2 || (asked?.n && asked.n === want.size)) {
      picked = [];
      for (let i = asked.i + 1; i < sentences.length && !sentences[i].endsWith("?") && picked.length < 2; i++) picked.push(i);
    } else {
      picked = sentences.map((s, i) => ({ i, n: s.endsWith("?") ? -1 : overlap(s) })).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 2).map(x => x.i);
    }
    const text = picked.sort((a, b) => a - b).map(i => sentences[i]).join(" ");
    return { text: `${text} (From "${top.heading}"; the page has the code.)`, sources: [top.url] };
  },
};

export class Assistant {
  private index: Index;
  private writer: Writer;
  private minScore: number;
  private minCoverage: number;

  constructor(passages: Passage[], { writer = extractive, minScore = 4, minCoverage = 0.4 } = {}) {
    this.index = new Index(passages);
    this.writer = writer;
    this.minScore = minScore;
    this.minCoverage = minCoverage;
  }

  async respond(question: string): Promise<Reply> {
    const start = performance.now();
    const hits = this.index.search(question, 3);
    const suggested = hits.slice(0, 2).map(h => ({ url: h.passage.url, heading: h.passage.heading }));
    const done = (r: Omit<Reply, "question" | "ms">): Reply => ({ question, ...r, ms: performance.now() - start });
    const flagged = triage(question);
    if (flagged?.route === "incident") return done({ route: "incident", reason: flagged.rule, sources: [],
      text: "This sounds like a live incident or a security report, so I've paged the on-call engineer with your message instead of answering from the docs.",
      handover: { to: "on-call engineer", suggested } });
    if (flagged?.route === "account") return done({ route: "account", reason: flagged.rule, sources: [],
      text: "Billing, licences, contracts and account changes need a person, so I've passed your message to the team.",
      handover: { to: "account team", suggested } });
    const best = hits[0];
    if (!best || best.score < this.minScore || best.coverage < this.minCoverage) return done({ route: "unsure",
      reason: best ? `best match too weak (score ${best.score.toFixed(1)}, ${Math.round(best.coverage * 100)}% of the question's words)` : "nothing matched",
      sources: [], text: "I couldn't find this in the docs, so I've passed it to a person rather than guess.",
      handover: { to: "support engineer", suggested } });
    const answer = await this.writer.write(question, hits);
    return done({ route: "answer", reason: `"${best.passage.heading}" (score ${best.score.toFixed(1)})`, ...answer });
  }
}
