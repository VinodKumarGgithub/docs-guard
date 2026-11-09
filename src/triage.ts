/**
 * Triage, before any answer is attempted. Plain rules on purpose: they can be read, reviewed and tested, and no wording
 * in the question can talk them out of a hand-over. Order matters: an incident beats an account question, so "our
 * workers are down and I can't find my invoice" pages on-call.
 *
 * The hard part is telling a live incident ("our Redis is down right now") from a docs question about the same thing
 * ("what happens to jobs if Redis goes down?"). Incident rules need someone's own system plus a present problem, or an
 * explicit alarm word.
 */
export type Route = "incident" | "account" | "answer" | "unsure";

const MINE = String.raw`\b(our|my|production|prod|live)\b`;
const SYSTEM = String.raw`\b(workers?|queues?|jobs?|redis|servers?|production|prod|app|service|cluster|processing|deploy\w*)\b`;
const BROKEN = String.raw`\b(down|crash\w*|stuck|stopped|dead|lost|losing|failing|piling up|not (processing|working|running))\b`;

export const RULES: { route: Route; name: string; pattern: RegExp }[] = [
  { route: "incident", name: "alarm word", pattern: /\b(urgent|asap|emergency|sev[- ]?[12]|p[01] incident|outage|on-?call)\b/i },
  // someone's own system, named, and broken now; "my licence token stopped working" is an account question, not an incident
  { route: "incident", name: "own system broken now", pattern: new RegExp(
    `${MINE}[^.?!]{0,30}${SYSTEM}[^.?!]{0,40}${BROKEN}|${SYSTEM}[^.?!]{0,30}${BROKEN}[^.?!]{0,30}\\b(right now|since|for (the last )?(an? |\\d+ )?(hour|minute|day)s?|this morning|in production)\\b`, "i") },
  { route: "incident", name: "data loss now", pattern: /\b(we|i) (are|am|have been|keep) (losing|dropping)\b|jobs (are|were) (being )?(lost|dropped|deleted)\b/i },
  { route: "incident", name: "security report", pattern: /\b(vulnerabilit\w*|security (issue|hole|flaw|bug|problem)|exploit\w*|cve-?\d*|breach|leak(ed)? (our|my|the) \w+|(password|token|key|credentials?) (was |were |got )?leaked)\b/i },
  { route: "account", name: "billing", pattern: /\b(charged|charge me|invoice|receipt|vat|billing|refund|payment|credit card|subscription|discount|quote for|price for|pricing for)\b/i },
  { route: "account", name: "licence or plan", pattern: /\b(licen[cs]e (key|token)|pro (licen[cs]e|token|subscription|plan)|npm token|upgrade (my|our) plan|cancel (my|our))\b/i },
  { route: "account", name: "contracts and compliance", pattern: /\b(dpa|data processing agreement|soc ?2|iso ?27001|support contract|sla\b|security questionnaire|gdpr request)\b/i },
  { route: "account", name: "my account", pattern: /\b(my|our) (account|email address|billing email|seats?|team members?)\b/i },
];

export function triage(question: string): { route: Route; rule: string } | null {
  for (const r of RULES) if (r.pattern.test(question)) return { route: r.route, rule: r.name };
  return null;
}
