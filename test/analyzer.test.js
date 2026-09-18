import test from "node:test";
import assert from "node:assert/strict";
import { addedText, analyzeFiles, isEligible, renderReview, wasReviewed } from "../src/analyzer.js";

test("analyzes only added lines", () => {
  assert.equal(addedText("--- a/x\n+++ b/x\n-old\n+new"), "+new");
  const result = analyzeFiles([{ filename: "app.js", patch: "-token='oldsecret123'\n+token='newsecret123'" }]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].rule, "credential");
});

test("reports omitted GitHub patches as a coverage limitation", () => {
  const result = analyzeFiles([{ filename: "large.generated.js" }]);
  assert.deepEqual(result, { findings: [], omittedPatches: ["large.generated.js"] });
});

test("deduplicates by exact head SHA marker", () => {
  const body = renderReview({ sha: "abc123", findings: [{ severity: "high", path: "x", rule: "r", message: "m" }] });
  assert.equal(wasReviewed([{ body }], "abc123"), true);
  assert.equal(wasReviewed([{ body }], "def456"), false);
});

test("rejects drafts, bots, closed pull requests, and self-authored pull requests", () => {
  const base = { draft: false, state: "open", user: { login: "alice" }, head: { sha: "a" } };
  assert.equal(isEligible(base, "review-bot"), true);
  assert.equal(isEligible({ ...base, draft: true }, "review-bot"), false);
  assert.equal(isEligible({ ...base, state: "closed" }, "review-bot"), false);
  assert.equal(isEligible({ ...base, user: { login: "review-bot" } }, "review-bot"), false);
  assert.equal(isEligible({ ...base, user: { login: "dependabot[bot]" } }, "review-bot"), false);
});
