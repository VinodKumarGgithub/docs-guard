# docs-guard

A support assistant for a developer product, built around one rule: **it answers only what it can quote from the
docs, and live incidents, security reports and billing questions go to a person**. A release check scores every change
before it ships.

The demo runs on the public [BullMQ](https://docs.bullmq.io) documentation (MIT licence): 101 pages, 501 passages.

```
$ npm run ingest && npm run eval
501 passages → data/passages.json
PASS – incident recall 100%, unsafe answers 0, routine answered 100% (right page 93%), routed as labelled 100%.
```

| Check (66 labelled questions) | Result | Gate |
| --- | ---: | ---: |
| Live incidents and security reports recognised | 10 / 10 | must be 100% |
| Incident or account questions answered from the docs | 0 | must be 0 |
| Routine questions answered without a person | 40 / 40 | at least 80% |
| …answered from the right page | 37 / 40 (93%) | at least 90% |
| Off-topic questions answered anyway | 0 / 6 | |
| Reply time, p95 | under 1 ms | |

Full report, including the three misses: [examples/eval-report.md](examples/eval-report.md).

## How a message is handled
1. **Triage first, with plain rules** ([src/triage.ts](src/triage.ts)). "Our Redis is down right now and we're losing
   jobs" pages the on-call engineer, with the two most relevant pages attached. "What happens to jobs if Redis goes
   down?" is a docs question and gets answered. Telling those two apart is the hard part, so the incident rule needs
   someone's own system *and* a present problem, or an alarm word (urgent, SEV1, outage), or a security report.
2. **Billing, licences, contracts and account changes go to the account team.** "My Pro licence token stopped working"
   is an account question, not an incident.
3. **Retrieval** (BM25 over passages, headings weighted, API names like `getFailed` split into words, a small synonym
   list for words the docs spell differently). If the best passage is too weak, a person gets the question, with the
   closest pages attached. The assistant doesn't guess.
4. **The answer quotes the docs and names the page.** The writer is an interface: an LLM writer can replace the
   extractive one, and the same release check then scores the LLM's answers before they reach users.
5. **Deprecated pages aren't approved content** (QueueScheduler, unneeded since BullMQ 2.0), so old advice is never
   quoted.

## Run it
Node.js 22.18 or newer runs the TypeScript directly. There is nothing to install.

```
npm run ingest                                       # fetch the docs from GitHub (the text is never committed)
npm run ask -- "How do I stop the same job from being added twice?"
npm run eval                                         # the release check; exits 1 if the gate fails
npm test                                             # offline unit tests
```

## On your product
Point [src/sources.ts](src/sources.ts) at your docs, rewrite the triage rules for your incidents and account questions,
and label 50–100 real support questions from your own channels. The release check then tells you, before every change,
whether the assistant still pages every incident, still refuses billing questions and still cites the right page.

Built by Vinod Kumar G · [imvinod.com](https://imvinod.com)

## Licence
MIT. The BullMQ documentation is © Taskforce.sh and contributors, under the MIT licence; it's fetched at run time, not
copied here.
