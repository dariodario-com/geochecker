# Changelog

All notable changes to `@dariodario/geochecker` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-07-10

Adds a sixth category and folds answerability (AEO) signals into the categories
they belong to. Additive — existing check ids, categories, and codes are
unchanged; scores for JS-rendered pages will drop (correctly) and pages with
question-form Q&A or wired FAQ schema will tick up slightly.

### Added

- **`renderability` category** — a new built-in check (`checkRenderability`)
  measuring whether the primary content is present in the raw server HTML or
  requires JavaScript to render. Most LLM crawlers (GPTBot, ClaudeBot,
  PerplexityBot) do not execute JS, so a client-rendered SPA shell is invisible
  to them. Category weight `1.1` (below the content axes, above authority).
  Codes: `renderability.server_rendered`, `renderability.thin_raw_html`,
  `renderability.spa_shell`, `renderability.spa_shell_noscript`,
  `renderability.meta_refresh`.
- **Answerability (AEO), folded in — no new category:**
  - `structure` now rewards question-form headings that have a self-contained
    answer immediately beneath, and flags the antipattern of a question heading
    with no answer. New codes: `structure.answerable_headings`,
    `structure.unanswered_questions`.
  - `structure`'s schema check now rewards `FAQPage`/`QAPage` wired to
    `acceptedAnswer` (directly extractable by answer engines) and notes the
    unwired shell. New codes: `schema.faq_wired`, `schema.faq_unwired`.

### Notes

- Consumers that render a fixed list of categories should read
  `report.categories` dynamically — a sixth entry now appears. Unknown category
  keys should fall back to the engine's English strings.

## [2.0.0] - 2026-07-08

Evidence-based recalibration. The AI-search landscape moved meaningfully in the
two months after v1.1.0, and two of the eight checks were giving advice that is
now wrong. This release corrects them, grounded in mid-2026 research (Ahrefs,
the Princeton GEO study, the IETF AIPREF draft, Cloudflare's purpose-based
crawler model).

### Breaking changes

- **Scores will shift.** `crawlability` no longer penalizes blocking
  training-only crawlers, and `llms.txt` no longer affects the score at all.
  A site that blocks GPTBot/CCBot while allowing the AI *search* crawlers now
  scores well where v1 marked it down.
- **Structured `codes` changed** (the machine-readable contract consumers use
  to localize findings):
  - `crawlability`: `ai_bots_blocked`, `ok_explicit_allow`, `partial_explicit`,
    `no_ai_rules` → replaced by `all_blocked`, `some_blocked`, `reachable_all`
    (`no_robots_txt` and `wildcard_block` retained, with new copy).
  - `llms_txt`: `missing`, `minimal`, `ok` → replaced by `not_used`, `present`.
  - If you key UI or logic off these codes, update your mapping. Unknown codes
    should fall back to the engine's English `finding`/`detail`/`fix` strings.

### Changed

- **`crawlability` rebuilt around crawler *purpose*.** Bots are now grouped as
  **search** (build the AI-search index — allowing these drives citation),
  **live-fetch** (real-time, user-triggered), and **training** (model training).
  Only blocking the search/live crawlers lowers your score; blocking
  training-only crawlers is treated as a legitimate opt-out that does not affect
  citation — matching the IETF AIPREF `train-ai` vs `search` split and
  Cloudflare's 2026 purpose-based defaults.
- **Refreshed the AI-crawler list.** Added `OAI-SearchBot`, `Claude-SearchBot`,
  `Claude-User`, `ChatGPT-User`, `Perplexity-User`, `MistralAI-User`,
  `Meta-ExternalAgent`, `Meta-ExternalFetcher`, `Meta-WebIndexer`, `Amazonbot`,
  `DuckAssistBot`, `Google-CloudVertexBot`, `cohere-ai`. Removed deprecated
  `Claude-Web` and `anthropic-ai`. Removed `Google-Extended` and
  `Applebot-Extended` — these are robots.txt *control tokens*, not crawlers, and
  blocking them has no effect on search visibility.
- **`llms.txt` is now informational only (weight 0).** As of 2026 no major AI
  search engine consumes it for retrieval or citation (Ahrefs: ~97% of
  `llms.txt` files receive zero bot requests; Google confirms it is unused). It
  remains a useful convention for developer coding agents, and its presence is
  still reported — but its absence is no longer penalized.
- **`schema` down-weighted (1.4 → 1.0) and reframed.** Controlled 2026 tests
  (Ahrefs difference-in-differences) show adding JSON-LD alone does not lift AI
  citations. Schema is kept as an entity-resolution/hygiene signal; the copy now
  steers toward attribute completeness over mere presence.

### Added

- Guidance that **off-page authority is the strongest driver of AI citations**
  (brand mentions across Reddit, YouTube, Wikipedia, reviews, earned media) and
  is invisible to a page-level scanner — a good page score is necessary but not
  sufficient.

## [1.1.0] - 2026-05-03

### Added

- Every built-in check now emits a stable, language-independent `codes:
  CheckCode[]` array alongside its English prose, so frontends can render
  localized copy without parsing strings.

## [1.0.0] - 2026-05-03

- Initial public release. Scores any URL across five GEO categories — structure,
  citability, crawlability, freshness, authority — with a finding, detail, and
  concrete fix per check. CLI (`npx @dariodario/geochecker <url>`), programmatic
  `runChecks` / `runChecksStream`, and `defineCheck` for custom checks.

[2.0.0]: https://github.com/dariodario-com/geochecker/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/dariodario-com/geochecker/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dariodario-com/geochecker/releases/tag/v1.0.0
