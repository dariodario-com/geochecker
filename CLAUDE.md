# geochecker — contributor and agent guide

The standalone open-source GEO scorer, published to npm as
**`@dariodario/geochecker`**. MIT.

GEO (Generative Engine Optimization) is about whether an LLM can find, parse and
cite a page. This package fetches one URL and scores it across six categories with
nine built-in checks. It has **one runtime dependency** (`node-html-parser`), makes
no third-party API calls, and only ever fetches the target page plus its
`robots.txt` and `llms.txt`. Keep it that way — a scorer other people install
should not grow a supply chain or phone home.

## Layout

- `src/checks/*.ts` — one file per check. Each returns a `CheckResult`
  (`score`, `status`, `finding`, `detail`, `fix`, `codes`).
- `src/scoring.ts` — `statusFor()` plus category aggregation and weights.
- `src/index.ts` — `runChecks`, `runChecksStream`, `defineCheck`, public types.
- `src/genre.ts`, `src/fetch.ts` — page classification and the single fetch.
- `tests/smoke.test.ts` — Node's built-in test runner, no extra deps.

## Working on it

```bash
npm run typecheck
npm run build      # tests run against dist/ — BUILD BEFORE TESTING
npm test
```

That order is the one real trap: `tests/` imports from `../dist/index.js`, so
skipping the build means testing the previous version and wondering why your
change did nothing.

## Changing a score or a status

Both are visible to every consumer, so treat them as close to breaking:

1. Bump the version and add a `CHANGELOG.md` entry saying **plainly what moves and
   what does not** — "scores unchanged, some statuses shift" is exactly the
   sentence a consumer needs in order to decide whether to care.
2. Structured `codes` are the contract, not the English prose. Consumers localise
   from codes, so a code id is stable within a major version while `finding` text
   can be rewritten freely.

## Design note: score vs status

`score` measures **magnitude**. `status` answers **"is there something here to
do?"**. Conflating them caused a real bug: a check aggregating several signals
could score 80, be labelled `pass`, and sit directly under the sentence "Heading
structure has gaps". Green beside a complaint is a contradiction, and a reader
resolves it by trusting neither half.

So `statusFor(score, hasFindings)` caps a passing score at `warn` when the check
named a problem, and findings can only make a label worse, never better — a poor
score must not be laundered into something reassuring.

## Adding a check

Use `defineCheck` for a custom one, or add a file under `src/checks/` and register
it in the builtin list. Emit at least one structured `code`, give it a `category`
and a `weight`, and pass `hasFindings` to `statusFor` so the label matches your own
finding text.
