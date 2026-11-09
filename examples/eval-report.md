# Docs assistant: release check

Result: **PASS**

66 labelled questions · answer writer: extractive (quotes the docs)

| Check | Result |
| --- | ---: |
| Live incidents and security reports recognised (must be 100%) | 100% |
| Incident or account questions answered from the docs (must be 0) | 0 |
| Routine questions answered without a person | 100% |
| …of those, answered from the right page | 93% |
| Off-topic questions answered anyway | 0 |
| All questions routed as labelled | 100% |
| Time to reply, p95 | 0.7 ms |

## Where each question went

| Expected ↓ / Got → | answer | incident | account | unsure |
| --- | ---: | ---: | ---: | ---: |
| answer | 40 | · | · | · |
| incident | · | 10 | · | · |
| account | · | · | 10 | · |
| unsure | · | · | · | 6 |

## Misses

| Question | Expected | Got | Problem | Why |
| --- | --- | --- | --- | --- |
| How do I listen for completed events from a queue? | answer | answer | answered from the wrong page | "Listening for the Deduplicated Event" (score 11.7) |
| How do I get the list of failed jobs from a queue? | answer | answer | answered from the wrong page | "Stalled" (score 6.7) |
| How do I migrate from Bull to BullMQ? | answer | answer | answered from the wrong page | "Migrating legacy repeatable jobs" (score 11.5) |

## Sample replies

**How do I retry a failed job automatically?**

> Depending on your Queue settings, the job may stay in the failed set forever, or it could be automatically removed. Often it is desirable to automatically retry failed jobs so that we do not give up until a certain amount of retries have failed. (From "Retrying failing jobs"; the page has the code.)
> Source: https://docs.bullmq.io/guide/retrying-failing-jobs

**What backoff strategies are built in for retries?**

> The current built-in backoff functions are fixed and exponential. (From "Built-in backoff strategies"; the page has the code.)
> Source: https://docs.bullmq.io/guide/retrying-failing-jobs

**How do I add a job that should only run after a delay?**

> If you want to reschedule a delayed job after inserting it, use the changeDelay method. For example: Only jobs currently in the delayed state can have their delay changed. (From "Change delay"; the page has the code.)
> Source: https://docs.bullmq.io/guide/jobs/delayed

**How do I set the concurrency of a worker?**

> BullMQ allows you to set a concurrency setting on your workers. This setting is local for the worker and exploits the NodeJS event loop so that jobs that are IO-heavy will benefit from higher throughput, as the worker does not need to wait for a job to complete before it can pick the next one. (From "BullMQ concurrency"; the page has the code.)
> Source: https://docs.bullmq.io/guide/parallelism-and-concurrency

_The questions were written for this demo; a real check uses anonymised questions from the product's own support channels._
