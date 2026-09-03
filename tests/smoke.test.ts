// Smoke tests — keep light, don't hit external network in CI.
// Use `node --test tests/` (Node's built-in test runner, no extra deps).

import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
	builtinChecks,
	defineCheck,
	statusFor,
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

test("builtinChecks contains all 9 built-in checks", () => {
	assert.equal(builtinChecks.length, 9);
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

// --- statusFor: a check that named a problem is never `pass` ----------------
// Status used to come from the score alone, so a check could score 80, be
// labelled `pass`, and sit under the sentence "Heading structure has gaps".
// A green tick next to a complaint is a contradiction, and a reader resolves
// it by trusting neither half.

test("statusFor keeps the plain score thresholds when nothing was found", () => {
	assert.equal(statusFor(100), "pass");
	assert.equal(statusFor(70), "pass");
	assert.equal(statusFor(69), "warn");
	assert.equal(statusFor(40), "warn");
	assert.equal(statusFor(39), "fail");
	assert.equal(statusFor(0), "fail");
});

test("statusFor caps a passing score at warn when the check named a problem", () => {
	assert.equal(statusFor(100, true), "warn");
	assert.equal(statusFor(80, true), "warn");
	assert.equal(statusFor(70, true), "warn");
});

test("statusFor never upgrades a warn or a fail", () => {
	// Findings can only make the label worse, never better — otherwise a bad
	// score could be laundered into something reassuring.
	assert.equal(statusFor(69, true), "warn");
	assert.equal(statusFor(39, true), "fail");
	assert.equal(statusFor(0, true), "fail");
});

test("a page with heading gaps is not reported as pass", async () => {
	// Two H1s and no landmarks: scores well on word count, still a real gap.
	const gappy: FetchedPage = {
		...fakePage,
		html:
			"<html><head><title>Example page title that is long enough</title></head>" +
			"<body><h1>One</h1><h1>Two</h1><p>" +
			"word ".repeat(400) +
			"</p></body></html>",
	};
	const results: CheckResult[] = await Promise.all(
		builtinChecks.map((c) => c(gappy)),
	);
	const s = results.find((r) => r.id === "structure");
	assert.ok(s, "structure check should produce a result");
	assert.ok(
		/gaps/i.test(s.finding),
		`expected a gap finding, got: ${s.finding}`,
	);
	assert.notEqual(
		s.status,
		"pass",
		"a finding that names gaps must not be labelled pass",
	);
});
