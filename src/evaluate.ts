import type { Assistant, Reply } from "./assistant.ts";
import type { Route } from "./triage.ts";

export interface Case { q: string; route: Route; sources?: string[] }
export interface Gate { incidentRecall: number; unsafeAnswers: number; minAnswerRate: number; minCitationAccuracy: number }

const HUMAN: Route[] = ["incident", "account"];

/** Scores the assistant on labelled questions. The gate fails on any safety miss, whatever the other numbers say. */
export async function evaluate(assistant: Assistant, cases: Case[], gate: Gate) {
  const rows: { c: Case; r: Reply; ok: boolean; problem?: string }[] = [];
  for (const c of cases) {
    const r = await assistant.respond(c.q);
    const cited = c.sources ? r.sources.some(u => c.sources!.some(s => u.includes(s))) : true;
    let problem: string | undefined;
    if (c.route === "incident" && r.route !== "incident") problem = "missed a live incident";
    else if (HUMAN.includes(c.route) && r.route === "answer") problem = "answered an incident or account question from the docs";
    else if (c.route === "answer" && r.route !== "answer") problem = `handed over a routine question (${r.route})`;
    else if (c.route === "answer" && !cited) problem = "answered from the wrong page";
    else if (c.route !== r.route) problem = `routed to ${r.route}`;
    rows.push({ c, r, ok: !problem, problem });
  }
  const of = (route: Route) => rows.filter(x => x.c.route === route);
  const incident = of("incident"), routine = of("answer");
  const answered = routine.filter(x => x.r.route === "answer");
  const metrics = {
    questions: rows.length,
    routedCorrectly: rows.filter(x => x.c.route === x.r.route).length / rows.length,
    incidentRecall: incident.filter(x => x.r.route === "incident").length / Math.max(1, incident.length),
    unsafeAnswers: rows.filter(x => HUMAN.includes(x.c.route) && x.r.route === "answer").length,
    answerRate: answered.length / Math.max(1, routine.length),
    citationAccuracy: answered.filter(x => x.ok).length / Math.max(1, answered.length),
    wrongAnswers: rows.filter(x => x.c.route === "unsure" && x.r.route === "answer").length,
    p95Ms: [...rows.map(x => x.r.ms)].sort((a, b) => a - b)[Math.ceil(rows.length * 0.95) - 1] ?? 0,
  };
  const failures = [
    metrics.incidentRecall < gate.incidentRecall && `incident recall ${pct(metrics.incidentRecall)} (needs ${pct(gate.incidentRecall)})`,
    metrics.unsafeAnswers > gate.unsafeAnswers && `${metrics.unsafeAnswers} incident or account questions answered automatically`,
    metrics.answerRate < gate.minAnswerRate && `answered ${pct(metrics.answerRate)} of routine questions (needs ${pct(gate.minAnswerRate)})`,
    metrics.citationAccuracy < gate.minCitationAccuracy && `citation accuracy ${pct(metrics.citationAccuracy)} (needs ${pct(gate.minCitationAccuracy)})`,
  ].filter((x): x is string => Boolean(x));
  return { rows, metrics, failures, pass: failures.length === 0 };
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function report(result: Awaited<ReturnType<typeof evaluate>>, writer: string): string {
  const { rows, metrics: m, failures, pass } = result;
  const routes: Route[] = ["answer", "incident", "account", "unsure"];
  const lines = [
    "# Docs assistant: release check", "",
    `Result: ${pass ? "**PASS**" : `**BLOCKED** – ${failures.join("; ")}`}`, "",
    `${m.questions} labelled questions · answer writer: ${writer}`, "",
    "| Check | Result |", "| --- | ---: |",
    `| Live incidents and security reports recognised (must be 100%) | ${pct(m.incidentRecall)} |`,
    `| Incident or account questions answered from the docs (must be 0) | ${m.unsafeAnswers} |`,
    `| Routine questions answered without a person | ${pct(m.answerRate)} |`,
    `| …of those, answered from the right page | ${pct(m.citationAccuracy)} |`,
    `| Off-topic questions answered anyway | ${m.wrongAnswers} |`,
    `| All questions routed as labelled | ${pct(m.routedCorrectly)} |`,
    `| Time to reply, p95 | ${m.p95Ms.toFixed(1)} ms |`, "",
    "## Where each question went", "",
    `| Expected ↓ / Got → | ${routes.join(" | ")} |`, `| --- | ${routes.map(() => "---:").join(" | ")} |`,
    ...routes.map(e => `| ${e} | ${routes.map(g => rows.filter(x => x.c.route === e && x.r.route === g).length || "·").join(" | ")} |`),
  ];
  const misses = rows.filter(x => !x.ok);
  lines.push("", `## ${misses.length ? "Misses" : "No misses"}`, "");
  if (misses.length) lines.push("| Question | Expected | Got | Problem | Why |", "| --- | --- | --- | --- | --- |",
    ...misses.map(x => `| ${x.c.q} | ${x.c.route} | ${x.r.route} | ${x.problem} | ${x.r.reason} |`));
  lines.push("", "## Sample replies", "", ...rows.filter(x => x.r.route === "answer").slice(0, 4).flatMap(x =>
    [`**${x.c.q}**`, "", `> ${x.r.text}`, `> Source: ${x.r.sources.join(", ")}`, ""]));
  lines.push("_The questions were written for this demo; a real check uses anonymised questions from the product's own support channels._", "");
  return lines.join("\n");
}
