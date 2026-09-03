import { parse } from "node-html-parser";
import type { CheckCode, CheckResult, FetchedPage } from "../types.js";
import { statusFor } from "../scoring.js";

export async function checkOg(page: FetchedPage): Promise<CheckResult> {
	const root = parse(page.html);

	const title = root.querySelector("title")?.text?.trim() ?? "";
	const desc =
		root.querySelector('meta[name="description"]')?.getAttribute("content") ??
		"";
	const ogTitle =
		root.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
		"";
	const ogDesc =
		root.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
		"";
	const ogImage =
		root.querySelector('meta[property="og:image"]')?.getAttribute("content") ??
		"";
	const ogType =
		root.querySelector('meta[property="og:type"]')?.getAttribute("content") ??
		"";

	const issues: string[] = [];
	const codes: CheckCode[] = [];
	let score = 0;

	if (title.length >= 25 && title.length <= 70) score += 20;
	else if (title.length > 0) {
		score += 10;
		issues.push(`title length ${title.length} (target 25–70)`);
		codes.push({ code: "og.title_length", data: { length: title.length } });
	} else {
		issues.push("missing <title>");
		codes.push({ code: "og.title_missing" });
	}

	if (desc.length >= 70 && desc.length <= 170) score += 20;
	else if (desc.length > 0) {
		score += 10;
		issues.push(`meta description length ${desc.length} (target 70–170)`);
		codes.push({ code: "og.description_length", data: { length: desc.length } });
	} else {
		issues.push("missing meta description");
		codes.push({ code: "og.description_missing" });
	}

	if (ogTitle) score += 15;
	else {
		issues.push("missing og:title");
		codes.push({ code: "og.no_og_title" });
	}

	if (ogDesc) score += 15;
	else {
		issues.push("missing og:description");
		codes.push({ code: "og.no_og_description" });
	}

	if (ogImage) score += 20;
	else {
		issues.push("missing og:image");
		codes.push({ code: "og.no_og_image" });
	}

	if (ogType) score += 10;

	score = Math.min(100, score);

	if (codes.length === 0) codes.push({ code: "og.ok" });

	const finding =
		issues.length === 0
			? "Title, description, and Open Graph tags all present and well-sized."
			: `Meta gaps: ${issues.join("; ")}.`;

	const detail = `<title>: ${title.length} chars. meta description: ${desc.length} chars. og:title: ${ogTitle ? "yes" : "no"}. og:description: ${ogDesc ? "yes" : "no"}. og:image: ${ogImage ? "yes" : "no"}. og:type: ${ogType || "unset"}.`;

	const fix =
		issues.length === 0
			? "Maintain. Verify og:image renders correctly at 1200×630 in social previews."
			: "Set <title> to 25–70 chars, meta description to 70–170 chars, and add og:title, og:description, og:image (1200×630), og:type. These appear in social previews and some LLM-generated link cards.";

	return {
		id: "og_meta",
		category: "structure",
		score,
		status: statusFor(score, issues.length > 0),
		finding,
		detail,
		fix,
		weight: 0.7,
		codes,
	};
}
