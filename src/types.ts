export type Status = "pass" | "warn" | "fail";

export type Category =
	| "structure"
	| "citability"
	| "crawlability"
	| "freshness"
	| "authority";

export type CheckResult = {
	id: string;
	category: Category;
	score: number;
	status: Status;
	finding: string;
	detail: string;
	fix: string;
	weight: number;
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
