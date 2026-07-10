import { parse } from "node-html-parser";
import type { CheckCode, CheckResult, FetchedPage } from "../types.js";
import { statusFor } from "../scoring.js";

/**
 * Renderability — can a crawler that does NOT execute JavaScript read the
 * primary content? GPTBot, ClaudeBot, PerplexityBot, and most LLM fetchers
 * take the raw server HTML and never hydrate. A client-rendered SPA that
 * ships an empty root div plus a bundle is invisible to them regardless of
 * how good its content is once JS runs.
 *
 * Measured on the raw fetched HTML (no browser), which is exactly what those
 * crawlers see. Distinct from `structure` (which assumes content is present
 * and grades its shape): this axis grades whether the content is present at
 * all before JS.
 */
export async function checkRenderability(page: FetchedPage): Promise<CheckResult> {
	const root = parse(page.html);
	const body = root.querySelector("body");

	const bodyText = (body?.text ?? root.text).trim();
	const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
	const hasMainOrArticle =
		(body?.querySelectorAll("main").length ?? 0) > 0 ||
		(body?.querySelectorAll("article").length ?? 0) > 0;

	const shell = detectSpaShell(root, wordCount);
	const noscriptWords = noscriptWordCount(root);
	const metaRefresh = hasMetaRefresh(root);

	const codes: CheckCode[] = [];
	let score: number;

	if (metaRefresh) {
		// Content gated behind a client-side redirect: a non-JS crawler lands on
		// a near-empty interstitial.
		score = 25;
		codes.push({ code: "renderability.meta_refresh" });
	} else if (wordCount >= 250 && hasMainOrArticle && !shell) {
		score = 100;
		codes.push({ code: "renderability.server_rendered", data: { wordCount } });
	} else {
		score = 0;
		if (wordCount >= 250) score += 70;
		else if (wordCount >= 100) score += 45;
		else if (wordCount >= 40) score += 20;
		else score += 5;

		if (hasMainOrArticle) score += 15;
		if (!shell) score += 15;

		if (shell) {
			// A hollow SPA shell. A noscript fallback with real content softens
			// the blow (some crawlers read it) but is not a substitute for SSR.
			if (noscriptWords >= 30) {
				score = Math.max(score, 40);
				codes.push({ code: "renderability.spa_shell_noscript", data: { wordCount, noscriptWords } });
			} else {
				codes.push({ code: "renderability.spa_shell", data: { wordCount } });
			}
		} else if (wordCount < 250) {
			codes.push({ code: "renderability.thin_raw_html", data: { wordCount } });
		}
	}

	score = Math.min(100, Math.max(0, score));

	const finding = metaRefresh
		? "Content sits behind a client-side redirect — crawlers see an interstitial."
		: shell
			? "Page ships as a JavaScript shell — little to no content in the raw HTML."
			: wordCount >= 250 && hasMainOrArticle
				? `Content is server-rendered (${wordCount} words in raw HTML, main/article present).`
				: `Raw HTML carries ${wordCount} words — thinner than ideal for non-JS crawlers.`;

	const detail = `Raw-HTML word count: ${wordCount}. main/article present: ${hasMainOrArticle}. SPA shell: ${shell}. <noscript> words: ${noscriptWords}. meta-refresh: ${metaRefresh}. Measured on the un-hydrated server response — what GPTBot/ClaudeBot/PerplexityBot receive.`;

	const fix =
		score >= 70
			? "Keep the primary content in the server response. If you add client-only sections, ensure the substance stays server-rendered."
			: shell || metaRefresh
				? "Server-render or pre-render the content. SvelteKit, Next.js, Nuxt, and Astro do this by default; for a pure SPA, add prerendering (Prerender.io, a static export, or a crawler-facing SSR route)."
				: "Increase the substantive text delivered in the initial HTML response. Aim for the main body copy to be present before any JavaScript runs.";

	return {
		id: "renderability",
		category: "renderability",
		score,
		status: statusFor(score),
		finding,
		detail,
		fix,
		weight: 1,
		codes,
	};
}

/** Hollow single-page-app shell: an (near-)empty mount node plus script bundles. */
function detectSpaShell(root: ReturnType<typeof parse>, wordCount: number): boolean {
	if (wordCount > 120) return false;
	const scripts = root.querySelectorAll("script[src]").length;
	if (scripts === 0) return false;
	const mounts = root.querySelectorAll(
		"#app, #root, #svelte, #__next, #__nuxt, [data-reactroot]",
	);
	for (const m of mounts) {
		const mWords = (m.text ?? "").trim().split(/\s+/).filter(Boolean).length;
		if (mWords < 20) return true;
	}
	// No recognizable mount node but still almost no text and scripts present.
	return mounts.length === 0 && wordCount < 40;
}

function noscriptWordCount(root: ReturnType<typeof parse>): number {
	let words = 0;
	for (const n of root.querySelectorAll("noscript")) {
		words += (n.text ?? "").trim().split(/\s+/).filter(Boolean).length;
	}
	return words;
}

function hasMetaRefresh(root: ReturnType<typeof parse>): boolean {
	const meta = root.querySelector('meta[http-equiv="refresh" i]');
	const content = meta?.getAttribute("content") ?? "";
	// Only a redirecting refresh (has a url=) hides content; a self-refresh does not.
	return /url=/i.test(content);
}
