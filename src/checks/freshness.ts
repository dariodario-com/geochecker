import { parse } from "node-html-parser";
import type { CheckResult, FetchedPage } from "../types.js";
import { statusFor } from "../scoring.js";
import { detectGenre } from "../genre.js";

const DAY = 86_400_000;

export async function checkFreshness(
	page: FetchedPage,
): Promise<CheckResult> {
	const root = parse(page.html);
	const dates: { source: string; date: Date }[] = [];

	const lastModHeader = page.headers["last-modified"];
	if (lastModHeader) {
		const d = parseDate(lastModHeader);
		if (d) dates.push({ source: "Last-Modified header", date: d });
	}

	const ogPublished = root
		.querySelector('meta[property="article:published_time"]')
		?.getAttribute("content");
	const ogModified = root
		.querySelector('meta[property="article:modified_time"]')
		?.getAttribute("content");
	if (ogPublished) {
		const d = parseDate(ogPublished);
		if (d) dates.push({ source: "article:published_time", date: d });
	}
	if (ogModified) {
		const d = parseDate(ogModified);
		if (d) dates.push({ source: "article:modified_time", date: d });
	}

	const timeEls = root.querySelectorAll("time[datetime]");
	for (const t of timeEls.slice(0, 3)) {
		const d = parseDate(t.getAttribute("datetime") || "");
		if (d) dates.push({ source: "<time datetime>", date: d });
	}

	for (const block of root.querySelectorAll('script[type="application/ld+json"]')) {
		try {
			const json = JSON.parse(block.text);
			const items = Array.isArray(json) ? json : [json];
			for (const item of items) {
				const pub = item?.datePublished;
				const mod = item?.dateModified;
				if (typeof pub === "string") {
					const d = parseDate(pub);
					if (d) dates.push({ source: "schema datePublished", date: d });
				}
				if (typeof mod === "string") {
					const d = parseDate(mod);
					if (d) dates.push({ source: "schema dateModified", date: d });
				}
			}
		} catch {
			/* ignore */
		}
	}

	const genre = detectGenre(page);

	if (dates.length === 0) {
		const score = genre === "article" ? 30 : 60;
		return {
			id: "freshness",
			category: "freshness",
			score,
			status: statusFor(score),
			finding:
				genre === "article"
					? "No freshness signals detected on an article-genre page."
					: "No freshness signals detected (brand page; lower priority).",
			detail:
				"No Last-Modified header, no <time datetime>, no schema datePublished/dateModified, no Open Graph article timestamps.",
			fix:
				genre === "article"
					? "Expose at least one date signal: a Last-Modified header, a <time datetime=\"YYYY-MM-DD\"> element near the title, or schema datePublished/dateModified."
					: "Optional for brand pages. If you make claims that change over time (pricing, statistics, product capabilities), add a 'last updated' date so LLMs can reason about staleness.",
			weight: 0.9,
		};
	}

	const newest = dates.reduce((a, b) => (a.date > b.date ? a : b));
	const ageDays = Math.floor((Date.now() - newest.date.getTime()) / DAY);

	let score: number;
	if (ageDays < 0) score = 60;
	else if (ageDays < 90) score = 100;
	else if (ageDays < 365) score = 85;
	else if (ageDays < 730) score = 60;
	else if (ageDays < 1825) score = 40;
	else score = 20;

	const finding = `Newest date signal: ${newest.date.toISOString().split("T")[0]} (${ageDays} day${ageDays === 1 ? "" : "s"} ago).`;

	const detail = `${dates.length} freshness signal(s) found: ${[...new Set(dates.map((d) => d.source))].join(", ")}.`;

	const fix =
		ageDays < 365
			? "Maintain visible date signals on updated content. When you revise a page, update dateModified."
			: ageDays < 730
				? "Refresh content older than a year. LLMs weight recency for any topic where facts change."
				: "Republish or sunset stale content. A page with a 2+ year-old date risks being cited as outdated.";

	return {
		id: "freshness",
		category: "freshness",
		score,
		status: statusFor(score),
		finding,
		detail,
		fix,
		weight: 1.0,
	};
}

function parseDate(s: string): Date | null {
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? null : d;
}
