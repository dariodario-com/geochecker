import type { CheckCode, CheckResult, FetchedPage } from "../types.js";
import { fetchText, originOf } from "../fetch.js";
import { statusFor } from "../scoring.js";

const AI_BOTS = [
	"GPTBot",
	"ClaudeBot",
	"Claude-Web",
	"anthropic-ai",
	"Google-Extended",
	"PerplexityBot",
	"CCBot",
	"Applebot-Extended",
	"Bytespider",
];

type RobotsRule = {
	agents: string[];
	disallows: string[];
	allows: string[];
};

export async function checkCrawlability(
	page: FetchedPage,
): Promise<CheckResult> {
	const robotsUrl = `${originOf(page.finalUrl)}/robots.txt`;
	const res = await fetchText(robotsUrl);

	if (!res || res.status >= 400) {
		return {
			id: "crawlability",
			category: "crawlability",
			score: 60,
			status: statusFor(60),
			finding: "No robots.txt found. AI crawlers will use default behavior (allow).",
			detail: `Fetched ${robotsUrl} → ${res?.status ?? "no response"}. Without explicit rules, well-behaved crawlers proceed by default.`,
			fix: "Add a robots.txt that explicitly allows or blocks each AI crawler (GPTBot, ClaudeBot, Claude-Web, Google-Extended, PerplexityBot, CCBot). Silence is permissive but ambiguous.",
			weight: 1.2,
			codes: [
				{ code: "crawlability.no_robots_txt", data: { status: res?.status ?? null } },
			],
		};
	}

	const rules = parseRobots(res.text);

	const blocked: string[] = [];
	const explicitlyAllowed: string[] = [];
	const silent: string[] = [];

	for (const bot of AI_BOTS) {
		const match = rules.find((r) =>
			r.agents.some((a) => a.toLowerCase() === bot.toLowerCase()),
		);
		if (!match) {
			silent.push(bot);
			continue;
		}
		const blocksRoot = match.disallows.some((d) => d === "/" || d === "");
		const allowsRoot = match.allows.some((a) => a === "/" || a === "");
		if (blocksRoot && !allowsRoot) blocked.push(bot);
		else explicitlyAllowed.push(bot);
	}

	const wildcardBlocks = rules.find((r) => r.agents.includes("*"))
		?.disallows.some((d) => d === "/");

	let score: number;
	let finding: string;
	const codes: CheckCode[] = [];

	if (blocked.length > 0 || wildcardBlocks) {
		score = 0;
		const list = wildcardBlocks ? "all crawlers (User-agent: *)" : blocked.join(", ");
		finding = `AI crawlers blocked: ${list}.`;
		if (wildcardBlocks) {
			codes.push({ code: "crawlability.wildcard_block" });
		} else {
			codes.push({ code: "crawlability.ai_bots_blocked", data: { blocked } });
		}
	} else if (explicitlyAllowed.length >= 3) {
		score = 100;
		finding = `${explicitlyAllowed.length} AI crawlers explicitly allowed in robots.txt.`;
		codes.push({
			code: "crawlability.ok_explicit_allow",
			data: { count: explicitlyAllowed.length, names: explicitlyAllowed },
		});
	} else if (explicitlyAllowed.length > 0) {
		score = 75;
		finding = `${explicitlyAllowed.length} AI crawler(s) addressed; ${silent.length} silent (default-allow).`;
		codes.push({
			code: "crawlability.partial_explicit",
			data: {
				allowedCount: explicitlyAllowed.length,
				silentCount: silent.length,
				allowed: explicitlyAllowed,
			},
		});
	} else {
		score = 60;
		finding = "robots.txt present but no AI crawler rules.";
		codes.push({ code: "crawlability.no_ai_rules" });
	}

	const detail = [
		`Blocked: ${blocked.length ? blocked.join(", ") : "none"}.`,
		`Explicitly allowed: ${explicitlyAllowed.length ? explicitlyAllowed.join(", ") : "none"}.`,
		`Silent (default-allow): ${silent.length ? silent.join(", ") : "none"}.`,
	].join(" ");

	const fix =
		blocked.length > 0 || wildcardBlocks
			? "Remove the disallow directives for AI crawlers you want to be cited by, or add User-agent-specific Allow rules for the bots you do want."
			: explicitlyAllowed.length === 0
				? "Add explicit User-agent blocks for GPTBot, ClaudeBot, Claude-Web, Google-Extended, and PerplexityBot with Allow: / to remove ambiguity."
				: "Maintain. Review the silent-default bots and decide whether to address them explicitly.";

	return {
		id: "crawlability",
		category: "crawlability",
		score,
		status: statusFor(score),
		finding,
		detail,
		fix,
		weight: 1.5,
		codes,
	};
}

function parseRobots(text: string): RobotsRule[] {
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.replace(/#.*$/, "").trim())
		.filter(Boolean);

	const rules: RobotsRule[] = [];
	let current: RobotsRule | null = null;
	let lastWasAgent = false;

	for (const line of lines) {
		const idx = line.indexOf(":");
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim().toLowerCase();
		const value = line.slice(idx + 1).trim();

		if (key === "user-agent") {
			if (!lastWasAgent) {
				current = { agents: [], disallows: [], allows: [] };
				rules.push(current);
			}
			current?.agents.push(value);
			lastWasAgent = true;
		} else if (key === "disallow" && current) {
			current.disallows.push(value);
			lastWasAgent = false;
		} else if (key === "allow" && current) {
			current.allows.push(value);
			lastWasAgent = false;
		} else {
			lastWasAgent = false;
		}
	}

	return rules;
}
