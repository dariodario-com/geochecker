import { fetchPage } from "./fetch.js";
import { aggregate } from "./scoring.js";
import type { Check, CheckResult, FetchedPage, Report } from "./types.js";

import { checkSchema } from "./checks/schema.js";
import { checkStructure } from "./checks/structure.js";
import { checkCitability } from "./checks/citability.js";
import { checkCrawlability } from "./checks/crawlability.js";
import { checkLlmsTxt } from "./checks/llmstxt.js";
import { checkFreshness } from "./checks/freshness.js";
import { checkOg } from "./checks/og.js";
import { checkAuthority } from "./checks/authority.js";

/** Built-in checks run by `runChecks` in default order. */
export const builtinChecks: Check[] = [
	checkSchema,
	checkStructure,
	checkCitability,
	checkCrawlability,
	checkLlmsTxt,
	checkFreshness,
	checkOg,
	checkAuthority,
];

export type RunOptions = {
	/** Called after the page is fetched, before any checks run. */
	onFetched?: (page: FetchedPage) => void;
	/** Called once per check as it completes. */
	onCheck?: (result: CheckResult) => void;
	/** Replace the default check set entirely. */
	checks?: Check[];
	/** Add to the default check set (runs in addition to builtins). */
	extraChecks?: Check[];
};

/**
 * Score a single URL across all GEO categories.
 * @example
 *   const report = await runChecks("https://example.com");
 *   console.log(report.overall);
 */
export async function runChecks(
	url: string,
	opts: RunOptions = {},
): Promise<Report> {
	const page = await fetchPage(url);
	opts.onFetched?.(page);

	const all = [...(opts.checks ?? builtinChecks), ...(opts.extraChecks ?? [])];
	const results = await Promise.all(
		all.map(async (check) => {
			const r = await check(page);
			opts.onCheck?.(r);
			return r;
		}),
	);

	return aggregate(results, {
		url: page.url,
		finalUrl: page.finalUrl,
		fetchedAt: page.fetchedAt,
	});
}

export type StreamEvent =
	| { type: "fetched"; page: FetchedPage }
	| { type: "check"; result: CheckResult }
	| { type: "done"; report: Report };

/**
 * Score a URL and stream events as they arrive (page fetch, each check, final report).
 * Useful for live UIs.
 * @example
 *   for await (const evt of runChecksStream("https://example.com")) {
 *     if (evt.type === "check") render(evt.result);
 *   }
 */
export async function* runChecksStream(
	url: string,
	opts: Omit<RunOptions, "onCheck" | "onFetched"> = {},
): AsyncGenerator<StreamEvent, void, unknown> {
	const events: StreamEvent[] = [];
	let terminated = false;
	let runError: unknown = null;
	let resolveNext: (() => void) | null = null;
	const wake = () => {
		const r = resolveNext;
		resolveNext = null;
		r?.();
	};

	runChecks(url, {
		...opts,
		onFetched: (page) => {
			events.push({ type: "fetched", page });
			wake();
		},
		onCheck: (result) => {
			events.push({ type: "check", result });
			wake();
		},
	})
		.then((report) => {
			events.push({ type: "done", report });
		})
		.catch((err) => {
			runError = err;
		})
		.finally(() => {
			terminated = true;
			wake();
		});

	while (true) {
		while (events.length) yield events.shift()!;
		if (terminated) {
			if (runError) throw runError;
			return;
		}
		await new Promise<void>((resolve) => {
			resolveNext = resolve;
		});
	}
}

/**
 * Helper for defining a custom check that augments the built-in set.
 * Returns the check function as-is, but provides type inference.
 * @example
 *   const myCheck = defineCheck(async (page) => ({
 *     id: "my-check",
 *     category: "structure",
 *     score: 100,
 *     status: "pass",
 *     finding: "Looks great.",
 *     detail: "...",
 *     fix: "Nothing to do.",
 *     weight: 1,
 *   }));
 */
export function defineCheck(check: Check): Check {
	return check;
}

export type {
	Check,
	Report,
	CheckResult,
	CategoryScore,
	Category,
	Status,
	FetchedPage,
} from "./types.js";
