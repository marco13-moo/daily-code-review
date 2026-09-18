import test from "node:test";
import assert from "node:assert/strict";
import { repositories, run } from "../src/index.js";

test("normalizes and deduplicates the explicit allowlist", () => {
  assert.deepEqual(repositories("owner/api, owner/web,owner/api"), ["owner/api", "owner/web"]);
  assert.throws(() => repositories(""), /explicit/);
  assert.throws(() => repositories("not-a-repository"), /invalid/);
});

test("dry-run analyzes findings without posting", async () => {
  let posted = false;
  const api = {
    user: async () => ({ login: "review-bot" }),
    pulls: async () => [{ number: 7, draft: false, state: "open", user: { login: "alice" }, head: { sha: "sha7" } }],
    reviews: async () => [],
    files: async () => [{ filename: ".github/workflows/release.yml", patch: "+permissions: write-all" }],
    review: async () => { posted = true; }
  };
  const summary = await run({ GITHUB_TOKEN: "test", REVIEW_REPOSITORIES: "owner/repo", DRY_RUN: "true" }, api);
  assert.equal(summary.reviewed, 1);
  assert.equal(summary.findings, 1);
  assert.equal(posted, false);
});

test("live mode submits once and then skips the identical head SHA", async () => {
  const posted = [];
  const prior = [];
  const api = {
    user: async () => ({ login: "review-bot" }),
    pulls: async () => [{ number: 9, draft: false, state: "open", user: { login: "alice" }, head: { sha: "sha9" } }],
    reviews: async () => prior,
    files: async () => [{ filename: "unsafe.js", patch: "+eval(input)" }],
    review: async (_repo, _number, body) => { posted.push(body); prior.push({ body }); }
  };
  await run({ GITHUB_TOKEN: "test", REVIEW_REPOSITORIES: "owner/repo", DRY_RUN: "false" }, api);
  const second = await run({ GITHUB_TOKEN: "test", REVIEW_REPOSITORIES: "owner/repo", DRY_RUN: "false" }, api);
  assert.equal(posted.length, 1);
  assert.equal(second.skipped, 1);
});
