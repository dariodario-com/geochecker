import { parse } from "node-html-parser";
import type { CheckCode, CheckResult, FetchedPage } from "../types.js";
import { statusFor } from "../scoring.js";

export async function checkStructure(
	page: FetchedPage,
): Promise<CheckResult> {
	const root = parse(page.html);
	const h1s = root.querySelectorAll("h1");
	const h2s = root.querySelectorAll("h2");
	const h3s = root.querySelectorAll("h3");

	const semantic = {
		article: root.querySelectorAll("article").length,
		section: root.querySelectorAll("section").length,
		nav: root.querySelectorAll("nav").length,
		main: root.querySelectorAll("main").length,
		header: root.querySelectorAll("header").length,
		footer: root.querySelectorAll("footer").length,
	};

	const text = root.querySelector("body")?.text ?? root.text;
	const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

	const empty = isEmptyShell(root, wordCount);

	let score = 0;
	const issues: string[] = [];
	const codes: CheckCode[] = [];

	if (empty) {
		score = 5;
		issues.push("page renders empty without JS");
		codes.push({ code: "structure.empty_shell", data: { wordCount } });
	} else {
		if (h1s.length === 1) score += 25;
		else if (h1s.length === 0) {
			score += 0;
			issues.push("no H1");
			codes.push({ code: "structure.no_h1" });
		} else {
			score += 10;
			issues.push(`${h1s.length} H1 elements`);
			codes.push({ code: "structure.multiple_h1", data: { count: h1s.length } });
		}

		if (h2s.length >= 2) score += 20;
		else if (h2s.length === 1) score += 10;
		else {
			issues.push("no H2 sections");
			codes.push({ code: "structure.no_h2_sections" });
		}

		if (h3s.length > 0) score += 5;

		const semanticCount =
			(semantic.main > 0 ? 1 : 0) +
			(semantic.article > 0 ? 1 : 0) +
			(semantic.section > 0 ? 1 : 0) +
			(semantic.nav > 0 ? 1 : 0) +
			(semantic.header > 0 ? 1 : 0) +
			(semantic.footer > 0 ? 1 : 0);
		score += Math.min(20, semanticCount * 4);

		if (wordCount >= 800) score += 25;
		else if (wordCount >= 400) score += 15;
		else if (wordCount >= 150) score += 5;
		else {
			issues.push(`thin content (${wordCount} words)`);
			codes.push({ code: "structure.thin_content", data: { wordCount } });
		}

		if (semantic.main === 0) {
			issues.push("no <main> landmark");
			codes.push({ code: "structure.no_main" });
		}

		if (codes.length === 0) {
			codes.push({
				code: "structure.ok",
				data: { h1: h1s.length, h2: h2s.length, wordCount },
			});
		}
	}

	score = Math.min(100, Math.max(0, score));

	const finding = empty
		? "Page returns an empty shell — content requires JavaScript to render."
		: issues.length === 0
			? `Single H1, ${h2s.length} H2 sections, ${wordCount} words, semantic landmarks present.`
			: `Heading structure has gaps: ${issues.join("; ")}.`;

	const detail = empty
		? "The fetched HTML contains no visible content. Most LLM crawlers do not execute JavaScript and will see this page as blank."
		: `H1: ${h1s.length}, H2: ${h2s.length}, H3: ${h3s.length}. Semantic landmarks — main: ${semantic.main}, article: ${semantic.article}, section: ${semantic.section}, nav: ${semantic.nav}. Word count: ${wordCount}.`;

	const fix = empty
		? "Server-render or pre-render the primary content. SvelteKit, Next.js, and Astro all support this; for SPAs, add a static fallback or use a service like Prerender.io."
		: issues.length === 0
			? "Maintain the current heading discipline. Group related H2 sections under a single thematic H1."
			: "Use one H1 per page, group content under H2 sections, and wrap primary content in <main> with <article> for standalone pieces.";

	return {
		id: "structure",
		category: "structure",
		score,
		status: statusFor(score),
		finding,
		detail,
		fix,
		weight: 1.3,
		codes,
	};
}

function isEmptyShell(
	root: ReturnType<typeof parse>,
	wordCount: number,
): boolean {
	if (wordCount > 80) return false;
	const body = root.querySelector("body");
	if (!body) return true;
	const visibleChildren = body.querySelectorAll("p, h1, h2, h3, li, article");
	return visibleChildren.length < 3 && wordCount < 80;
}
