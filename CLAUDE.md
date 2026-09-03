# geochecker — the published GEO scoring package

> **ACTIVE as of 2026-09-03** (was marked dormant after 2026-07-10).

The standalone open-source GEO scorer, published to **public npm** as
`@dariodario/geochecker`. MIT, under Eric's name.

## What actually runs in production — read this before you assume otherwise

An earlier version of this file said "the live scan engine is elsewhere". That is
only half true and it is the dangerous half:

- **The CHECKS ARE HERE.** `dd-1/dd/geo-api/routes.ts` imports `runChecks` from this
  package. Every score and every finding a visitor sees on
  `dariodario.com/geochecker` is produced by `src/checks/*` in this repo.
  **An edit here reaches production** — after a publish and a dd-1 dependency bump.
- **The plumbing is elsewhere.** SSE streaming, the report cache, the durable
  `DD_GEO_REPORTS` store, Turnstile, rate limiting and the scan-token gate all live
  in `dd-1/dd/geo-api`. Looking for how a scan is *served*? That is there, not here.
- dario-1 additionally consumes the package for GEO types and the version/stars
  display.

## Shipping a change

1. `npm run typecheck && npm run build && npm test` — the tests run against
   `dist/`, so **build before testing** or you are testing the previous version.
2. Bump the version + add a `CHANGELOG.md` entry. Status/score changes are visible
   to every consumer, so say plainly what moves and what does not.
3. **Publishing is Eric's call** — a public package under his name. Do not
   `npm publish` without being asked.
4. After publishing, bump `@dariodario/geochecker` in **dd-1**'s `package.json` +
   lockfile, or production keeps running the old version: dd-1's Docker build uses
   `npm ci`, which honours the lockfile and ignores a newer `^` match.

## Design note: score vs status

`score` measures MAGNITUDE. `status` answers "is there something here to do?".
Conflating them is what produced the 2.2.0 bug — a check scored 80, was labelled
`pass`, and sat directly under "Heading structure has gaps". `statusFor(score,
hasFindings)` now caps a passing score at `warn` when the check named a problem,
and findings can only make a label worse, never better.

Repo: `dariodario-com/geochecker`.
