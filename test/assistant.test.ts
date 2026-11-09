import { test } from "node:test";
import assert from "node:assert/strict";
import { Assistant } from "../src/assistant.ts";
import { evaluate, type Gate } from "../src/evaluate.ts";
import type { Passage } from "../src/ingest.ts";
import { chunk, plain, sections } from "../src/ingest.ts";
import { terms } from "../src/retrieve.ts";
import { publicUrl } from "../src/sources.ts";
import { triage } from "../src/triage.ts";

// A tiny made-up knowledge base, so the tests run offline
const passages: Passage[] = [
  { id: "p1", url: "https://docs.example.dev/guide/retrying", title: "Retrying", heading: "Retrying failing jobs",
    text: "Set the attempts option to retry a failed job. Use a backoff to wait between attempts." },
  { id: "p2", url: "https://docs.example.dev/guide/dedup", title: "Deduplication", heading: "Deduplication",
    text: "Give jobs a deduplication id so the same job is not added again while it is waiting." },
  { id: "p3", url: "https://docs.example.dev/guide/redis-down", title: "Redis down", heading: "Failing fast when Redis is down",
    text: "When Redis is down, adding a job fails fast instead of waiting forever, so your API can return an error." },
];
const gate: Gate = { incidentRecall: 1, unsafeAnswers: 0, minAnswerRate: 0.5, minCitationAccuracy: 0.5 };

test("a live incident is paged, a docs question about the same failure is answered", async () => {
  assert.equal(triage("Our Redis is down right now and we're losing jobs")?.route, "incident");
  assert.equal(triage("My production workers keep crashing every few minutes")?.route, "incident");
  assert.equal(triage("What happens to jobs if Redis goes down?"), null);
  const r = await new Assistant(passages, { minScore: 0.5 }).respond("What happens when Redis is down?");
  assert.equal(r.route, "answer");
  assert.deepEqual(r.sources, ["https://docs.example.dev/guide/redis-down"]);
});

test("security reports and leaked secrets go to a person", () => {
  assert.equal(triage("I found a security vulnerability, where do I report it?")?.route, "incident");
  assert.equal(triage("Our Redis password got leaked in a public repo")?.route, "incident");
});

test("billing and licences go to the account team, even when something 'stopped working'", () => {
  assert.equal(triage("My Pro licence token stopped working on npm")?.route, "account");
  assert.equal(triage("I was charged twice")?.route, "account");
  assert.equal(triage("Can you sign our data processing agreement?")?.route, "account");
});

test("an incident beats an account question in the same message", () => {
  assert.equal(triage("Our workers are down and I also need an invoice")?.route, "incident");
});

test("words the docs spell differently still find the page", async () => {
  assert.ok(terms("How do I stop a job being added twice?").includes("dedup"));
  assert.ok(terms("getFailed").includes("fail"));
  const r = await new Assistant(passages, { minScore: 0.5 }).respond("How do I stop the same job being added twice?");
  assert.deepEqual(r.sources, ["https://docs.example.dev/guide/dedup"]);
});

test("an off-topic question is handed over instead of guessed", async () => {
  const r = await new Assistant(passages).respond("What's the best pizza in Rome?");
  assert.equal(r.route, "unsure");
  assert.equal(r.sources.length, 0);
});

test("Markdown is cleaned: code, GitBook tags and link targets are dropped", () => {
  const md = "# Retrying\n\nUse `attempts` to retry, see [backoff](./backoff.md) for details on waiting between tries.\n\n```ts\nawait queue.add('x', {}, { attempts: 3 });\n```\n{% hint style=\"info\" %}\nA hint\n{% endhint %}\n## Backoff\nExponential backoff doubles the wait each time a job fails again.";
  const page = sections(md, "fallback");
  assert.equal(page.title, "Retrying");
  assert.equal(page.sections.length, 2);
  assert.ok(!page.sections[0].text.includes("queue.add"));
  assert.ok(page.sections[0].text.includes("see backoff for details"));
  assert.equal(plain("[text](https://x.y)"), "text");
});

test("long sections are split on sentences, and public URLs drop .md and README", () => {
  const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} explains one more detail about queues.`).join(" ");
  assert.ok(chunk(long).length > 1);
  assert.equal(publicUrl("guide/flows/README.md"), "https://docs.bullmq.io/guide/flows");
  assert.equal(publicUrl("guide/jobs/delayed.md"), "https://docs.bullmq.io/guide/jobs/delayed");
});

test("the release check blocks a build that answers an incident", async () => {
  const careless = new Assistant(passages, { minScore: 0.5 });
  const result = await evaluate(careless, [{ q: "Retry failed job attempts", route: "incident" }], gate);
  assert.equal(result.pass, false);
  assert.match(result.failures.join(" "), /incident recall/);
});
