// Smoke tests — keep light, don't hit external network in CI.
// Use `node --test tests/` (Node's built-in test runner, no extra deps).

import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
	builtinChecks,
	defineCheck,
	type Check,
	type CheckResult,
	type FetchedPage,
} from "../dist/index.js";

const fakePage: FetchedPage = {
	url: "https://example.com/",
	finalUrl: "https://example.com/",
	status: 200,
	html: "<html><head><title>Example</title></head><body><h1>Hello</h1></body></html>",
	headers: { "content-type": "text/html" },
	fetchedAt: new Date().toISOString(),
};

test("builtinChecks contains all 8 categories of checks", () => {
	assert.equal(builtinChecks.length, 8);
});

test("each builtin check returns a well-formed CheckResult", async () => {
	for (const check of builtinChecks) {
		const r: CheckResult = await check(fakePage);
		assert.equal(typeof r.id, "string");
		assert.ok(r.id.length > 0, `id missing for ${check.name}`);
		assert.ok(["pass", "warn", "fail"].includes(r.status), `bad status: ${r.status}`);
		assert.ok(r.score >= 0 && r.score <= 100, `score out of range: ${r.score}`);
		assert.ok(typeof r.fix === "string");
	}
});

test("each builtin check emits at least one structured code", async () => {
	for (const check of builtinChecks) {
		const r: CheckResult = await check(fakePage);
		assert.ok(Array.isArray(r.codes), `codes missing for ${check.name}`);
		assert.ok(r.codes!.length > 0, `no codes emitted by ${check.name}`);
		for (const c of r.codes!) {
			assert.equal(typeof c.code, "string");
			assert.ok(c.code.includes("."), `code "${c.code}" should be namespaced`);
		}
	}
});

test("defineCheck is a passthrough", () => {
	const c: Check = async () => ({
		id: "x", category: "structure", score: 100, status: "pass",
		finding: "ok", detail: "ok", fix: "ok", weight: 1,
	});
	assert.equal(defineCheck(c), c);
});
