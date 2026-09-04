export type Status = "pass" | "warn" | "fail";

export type Category =
	| "structure"
	| "citability"
	| "crawlability"
	| "freshness"
	| "authority"
	| "renderability"
	| "indexability"
	| "answerability";

/**
 * A structured, language-independent identifier for a specific finding within
 * a check. Frontends use these to render localized copy. Each code is
 * namespaced by check id (e.g. `structure.no_h2_sections`). Optional `data`
 * carries values for interpolation (e.g. `{ wordCount: 17 }` for
 * `structure.thin_content`).
 *
 * Code IDs are stable within a major version; the English prose in
 * `CheckResult.finding` may be rewritten freely. Treat codes as the contract.
 */
export type CheckCode = {
	code: string;
	data?: Record<string, unknown>;
};

export type CheckResult = {
	id: string;
	category: Category;
	score: number;
	status: Status;
	finding: string;
	detail: string;
	fix: string;
	weight: number;
	/**
	 * Structured codes describing the specific issues observed. Optional for
	 * backwards compatibility — older checks may not emit these. All built-in
	 * checks emit codes from v1.1.0 onwards.
	 */
	codes?: CheckCode[];
};

export type FetchedPage = {
	url: string;
	finalUrl: string;
	status: number;
	html: string;
	headers: Record<string, string>;
	fetchedAt: string;
};

export type CategoryScore = {
	category: Category;
	score: number;
	checks: CheckResult[];
};

export type Report = {
	url: string;
	finalUrl: string;
	overall: number;
	categories: CategoryScore[];
	checks: CheckResult[];
	fetchedAt: string;
};

export type Check = (input: FetchedPage) => Promise<CheckResult>;
