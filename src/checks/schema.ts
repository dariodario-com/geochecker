import { parse } from "node-html-parser";
import type { CheckResult, FetchedPage } from "../types.js";
import { statusFor } from "../scoring.js";

const RECOGNIZED = new Set([
	"Organization",
	"LocalBusiness",
	"Article",
	"NewsArticle",
	"BlogPosting",
	"Product",
	"FAQPage",
	"HowTo",
	"Person",
	"WebSite",
	"WebPage",
	"BreadcrumbList",
	"SoftwareApplication",
	"Service",
]);

type Json = Record<string, unknown>;

export async function checkSchema(page: FetchedPage): Promise<CheckResult> {
	const root = parse(page.html);
	const blocks = root
		.querySelectorAll('script[type="application/ld+json"]')
		.map((n) => n.text);

	const parsed: Json[] = [];
	let invalid = 0;
	for (const block of blocks) {
		try {
			const json = JSON.parse(block) as Json | Json[];
			if (Array.isArray(json)) {
				for (const j of json) if (j && typeof j === "object") parsed.push(j);
			} else if (json && typeof json === "object") {
				parsed.push(json);
			}
		} catch {
			invalid += 1;
		}
	}

	const types = new Set<string>();
	const items = flatten(parsed);
	for (const item of items) {
		const t = item["@type"];
		if (typeof t === "string") types.add(t);
		else if (Array.isArray(t)) for (const v of t) if (typeof v === "string") types.add(v);
	}

	const recognized = [...types].filter((t) => RECOGNIZED.has(t));
	const hasOrg = types.has("Organization") || types.has("LocalBusiness");
	const articleish =
		types.has("Article") ||
		types.has("NewsArticle") ||
		types.has("BlogPosting");

	let score = 0;
	if (parsed.length === 0) {
		score = 0;
	} else {
		score += 35;
		if (recognized.length > 0) score += 25;
		if (hasOrg) score += 20;
		if (articleish) score += 15;
		if (invalid === 0) score += 5;
	}
	score = Math.min(100, score);

	let finding: string;
	let detail: string;
	let fix: string;

	if (parsed.length === 0) {
		finding = "No structured data detected.";
		detail =
			"No JSON-LD blocks found in the page source. LLMs use structured data to identify entities, articles, and authority signals.";
		fix =
			"Add a JSON-LD <script type=\"application/ld+json\"> block. Start with Organization (name, url, sameAs to social profiles) and add Article or Product schema on relevant pages.";
	} else if (invalid > 0) {
		finding = `${parsed.length} JSON-LD block(s) found, ${invalid} could not be parsed.`;
		detail = `Recognized types: ${[...types].join(", ") || "none"}. ${invalid} block(s) contained invalid JSON.`;
		fix = "Validate JSON-LD with a linter before deploy. Invalid blocks are silently dropped by Google and most LLM crawlers.";
	} else if (!hasOrg) {
		finding = "Structured data present, but no Organization schema.";
		detail = `Recognized types: ${[...types].join(", ") || "none"}. Without Organization, entity resolution falls back to name-matching.`;
		fix =
			"Add Organization schema with name, url, logo, and sameAs links to your verified social profiles (LinkedIn, X, GitHub).";
	} else {
		finding = `${parsed.length} structured data block(s), Organization present.`;
		detail = `Recognized types: ${[...types].join(", ")}.`;
		fix =
			"Extend with content-specific types (Article, Product, FAQPage) on the pages they apply to.";
	}

	return {
		id: "schema",
		category: "structure",
		score,
		status: statusFor(score),
		finding,
		detail,
		fix,
		weight: 1.4,
	};
}

function flatten(items: Json[]): Json[] {
	const out: Json[] = [];
	const walk = (node: unknown) => {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const n of node) walk(n);
			return;
		}
		out.push(node as Json);
		const graph = (node as Json)["@graph"];
		if (Array.isArray(graph)) for (const g of graph) walk(g);
	};
	for (const item of items) walk(item);
	return out;
}
