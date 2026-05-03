import type { Category, CategoryScore, CheckResult, Report } from "./types.js";

const CATEGORY_WEIGHT: Record<Category, number> = {
	citability: 1.4,
	structure: 1.3,
	crawlability: 1.2,
	authority: 1.0,
	freshness: 0.8,
};

export function statusFor(score: number): "pass" | "warn" | "fail" {
	if (score >= 70) return "pass";
	if (score >= 40) return "warn";
	return "fail";
}

export function aggregate(
	checks: CheckResult[],
	context: { url: string; finalUrl: string; fetchedAt: string },
): Report {
	const byCategory = new Map<Category, CheckResult[]>();
	for (const c of checks) {
		const list = byCategory.get(c.category) ?? [];
		list.push(c);
		byCategory.set(c.category, list);
	}

	const categories: CategoryScore[] = [];
	for (const [category, items] of byCategory.entries()) {
		const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
		const score =
			items.reduce((s, i) => s + i.score * i.weight, 0) / totalWeight;
		categories.push({
			category,
			score: Math.round(score),
			checks: items,
		});
	}

	const totalCatWeight =
		categories.reduce((s, c) => s + CATEGORY_WEIGHT[c.category], 0) || 1;
	const overall =
		categories.reduce(
			(s, c) => s + c.score * CATEGORY_WEIGHT[c.category],
			0,
		) / totalCatWeight;

	return {
		url: context.url,
		finalUrl: context.finalUrl,
		overall: Math.round(overall),
		categories: categories.sort((a, b) =>
			a.category.localeCompare(b.category),
		),
		checks,
		fetchedAt: context.fetchedAt,
	};
}
