![GEO Checker — by Dario Dario](https://dariodario.com/og.png)

# GEO Checker

> Check any site's readiness for AI search with our open-source Generative Engine Optimization (GEO) checker.

[![npm](https://img.shields.io/npm/v/@dariodario/geochecker.svg)](https://www.npmjs.com/package/@dariodario/geochecker)
[![license](https://img.shields.io/npm/l/@dariodario/geochecker.svg)](./LICENSE)

GEO (Generative Engine Optimization) is the practice of structuring web pages so that LLMs — ChatGPT, Claude, Gemini, Perplexity, Google AI Overviews — can find, understand, and cite your content.

GEO Checker scores any URL across six categories with concrete, actionable findings.

## Quick start

```bash
npx @dariodario/geochecker https://example.com
```

```
URL:     https://example.com/
Score:   42/100  (F)

STRUCTURE  (25/100)
  ✗ schema           0/100  No structured data detected.
  ✗ structure       25/100  Heading structure has gaps: no H2 sections; thin content (17 words).

CITABILITY  (60/100)
  • citability      60/100  Page has factual claims but no clear source attribution.

CRAWLABILITY  (80/100)
  ✓ crawlability    80/100  Robots.txt allows AI crawlers.

…
```

## What it scores

| Category | What it measures | Why LLMs care |
|---|---|---|
| **Structure** | Schema.org JSON-LD, heading hierarchy, semantic HTML landmarks | LLMs use structured data to identify entities, articles, authors, products |
| **Citability** | Author bylines, publish dates, source attribution, factual density | LLMs preferentially cite content with clear authorship and verifiable claims |
| **Crawlability** | `robots.txt` policy for AI crawlers, by **purpose** (search / live-fetch / training) | If you block the AI *search* crawlers you're invisible to those engines — but blocking *training-only* crawlers is a legitimate opt-out that does **not** reduce citation |
| **Freshness** | Last-modified dates, content recency signals | LLMs weight recent content higher for time-sensitive queries |
| **Authority** | Outbound links, mentions of credentialed sources, internal linking depth | LLMs use authority signals when picking which source to cite |
| **Renderability** | Whether the primary content is in the raw server HTML vs. requiring JavaScript to appear | GPTBot, ClaudeBot, PerplexityBot and most LLM fetchers don't run JS — a client-rendered SPA looks blank to them |

**Answerability (AEO)** signals are folded into the categories they belong to rather than split out: **Structure** rewards question-form headings backed by a self-contained answer, and **Structure**'s schema check rewards `FAQPage`/`QAPage` wired to `acceptedAnswer` — both make content directly extractable by answer engines.

Each check returns a score, a finding, a detailed explanation, and a concrete fix.

> **A good page score is necessary, not sufficient.** The single strongest driver of AI citations in 2025–2026 studies is **off-page authority** — how often your brand is mentioned across the web (Reddit, YouTube, Wikipedia, review sites, earned media). A page scanner can't see that. Use this tool to remove on-page blockers; win the citation with brand presence the scanner can't measure.
>
> **On `llms.txt`:** it's reported informationally and does **not** affect your score. As of 2026 no major AI search engine consumes it for citation (Ahrefs found ~97% of `llms.txt` files get zero bot requests); it's a developer coding-agent convention, not an AI-search signal.

## Programmatic usage

```ts
import { runChecks } from "@dariodario/geochecker";

const report = await runChecks("https://example.com");
console.log(report.overall);          // 0–100
console.log(report.categories);       // per-category scores
console.log(report.checks);           // every individual check + fix
```

### Streaming

For live UIs that show findings as they come in:

```ts
import { runChecksStream } from "@dariodario/geochecker";

for await (const evt of runChecksStream("https://example.com")) {
  if (evt.type === "fetched") console.log("page fetched");
  else if (evt.type === "check") console.log(evt.result.id, evt.result.score);
  else if (evt.type === "done") console.log("score:", evt.report.overall);
}
```

### Custom checks

```ts
import { runChecks, defineCheck } from "@dariodario/geochecker";

const wordCountCheck = defineCheck(async (page) => {
  const text = page.html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).length;
  return {
    id: "word-count",
    category: "structure",
    score: words >= 300 ? 100 : Math.round((words / 300) * 100),
    status: words >= 300 ? "pass" : "warn",
    finding: `Page has ${words} words.`,
    detail: "LLMs prefer pages with substantive content (300+ words).",
    fix: "Expand the page with detailed coverage of the topic.",
    weight: 1,
  };
});

const report = await runChecks("https://example.com", {
  extraChecks: [wordCountCheck],
});
```

## CLI options

| Flag | Description |
|---|---|
| `--json` | Output the full report as JSON (machine-readable) |
| `--category <name>` | Show only one category (`structure`, `citability`, `crawlability`, `freshness`, `authority`, `renderability`) |
| `--min-score <n>` | Exit with code 1 if overall < `n`. Use as a CI quality gate. |
| `-h`, `--help` | Show help |

### As a CI gate

```yaml
# .github/workflows/seo.yml
- run: npx @dariodario/geochecker https://your-staging-site.com --min-score 75
```

## Hosted version

Want comparison against a competitor, score history over time, branded PDF reports, or scheduled scans? The hosted version at **[dariodario.com/geo-check](https://dariodario.com/geo-check)** runs the same engine plus those features. Free for single-URL scans.

## Contributing

PRs welcome — particularly for new checks. Please open a [Discussion](https://github.com/dariodario-com/geochecker/discussions) first if proposing a substantial addition.

```bash
git clone https://github.com/dariodario-com/geochecker
cd geochecker
npm install
npm run build
npm test
```

## Releasing (maintainers)

Manual: tag pushes only run build/test in CI; `npm publish` runs from a maintainer's laptop.

```bash
npm version patch  # or minor / major — bumps package.json + creates tag
git push --follow-tags
npm publish --access public
```

`npm publish` will prompt for browser OTP if `npm login` has expired. The CI workflow on the tag push runs typecheck/build/test as a release-readiness gate; a green check means the tarball would have built cleanly.

## About

Built and maintained by [Dario Dario](https://dariodario.com), an AI-native studio in Stockholm. We design and ship AI agents for SMEs.

- Web: [dariodario.com](https://dariodario.com)
- Contact: hello@dariodario.com
- Twitter / X: [@dariodario_com](https://twitter.com/dariodario_com)

## License

[MIT](./LICENSE) — do anything.
