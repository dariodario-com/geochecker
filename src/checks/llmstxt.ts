import type { CheckCode, CheckResult, FetchedPage } from "../types.js";
import { fetchText, originOf } from "../fetch.js";
import { statusFor } from "../scoring.js";

export async function checkLlmsTxt(
	page: FetchedPage,
): Promise<CheckResult> {
	const url = `${originOf(page.finalUrl)}/llms.txt`;
	const res = await fetchText(url);

	if (!res || res.status >= 400) {
		return {
			id: "llms_txt",
			category: "structure",
			score: 40,
			status: statusFor(40),
			finding: "No /llms.txt found.",
			detail: `Fetched ${url} → ${res?.status ?? "no response"}. The llms.txt convention (llmstxt.org) lets you offer LLMs a curated map of your site's primary content in markdown.`,
			fix: "Publish /llms.txt at your root with a top-level H1 (site name), a short description, and markdown links to your primary content sections. Optionally add /llms-full.txt with the full content concatenated.",
			weight: 0.8,
			codes: [{ code: "llms_txt.missing", data: { status: res?.status ?? null } }],
		};
	}

	const text = res.text.trim();
	const lines = text.split(/\r?\n/);
	const hasH1 = lines.some((l) => /^#\s+\S/.test(l));
	const hasLinks = /\[[^\]]+\]\([^)]+\)/.test(text);
	const sufficient = text.length > 100 && hasH1 && hasLinks;

	const score = sufficient ? 100 : hasH1 || hasLinks ? 60 : 30;
	const codes: CheckCode[] = sufficient
		? [{ code: "llms_txt.ok", data: { bytes: text.length } }]
		: [{ code: "llms_txt.minimal", data: { bytes: text.length, hasH1, hasLinks } }];

	return {
		id: "llms_txt",
		category: "structure",
		score,
		status: statusFor(score),
		finding: sufficient
			? "/llms.txt present and well-formed."
			: "/llms.txt present but minimal.",
		detail: `${text.length} bytes. H1: ${hasH1 ? "yes" : "no"}. Markdown links: ${hasLinks ? "yes" : "no"}.`,
		fix: sufficient
			? "Maintain. Update when the site's information architecture changes."
			: "Add an H1 with the site name, a one-paragraph description, and grouped markdown links to primary content sections (Docs, Blog, About, etc.).",
		weight: 0.8,
		codes,
	};
}
