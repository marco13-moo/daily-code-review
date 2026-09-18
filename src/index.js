import { GitHub } from "./github.js";
import { analyzeFiles, isEligible, renderReview, wasReviewed } from "./analyzer.js";

export function repositories(value) {
  const repos = (value || "").split(",").map(item => item.trim()).filter(Boolean);
  if (!repos.length) throw new Error("REVIEW_REPOSITORIES must contain an explicit comma-separated allowlist");
  if (repos.some(repo => !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))) {
    throw new Error("REVIEW_REPOSITORIES contains an invalid owner/repository entry");
  }
  return [...new Set(repos)];
}

export async function run(env = process.env, api = new GitHub(env.GITHUB_TOKEN)) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required");
  const dryRun = env.DRY_RUN !== "false";
  const me = await api.user();
  const summary = { repositories: 0, pullRequests: 0, reviewed: 0, skipped: 0, findings: 0, omittedPatches: 0, dryRun };

  for (const repo of repositories(env.REVIEW_REPOSITORIES)) {
    summary.repositories += 1;
    for (const pr of await api.pulls(repo)) {
      summary.pullRequests += 1;
      if (!isEligible(pr, me.login)) {
        summary.skipped += 1;
        continue;
      }
      const priorReviews = await api.reviews(repo, pr.number);
      if (wasReviewed(priorReviews, pr.head.sha)) {
        summary.skipped += 1;
        continue;
      }
      const { findings, omittedPatches } = analyzeFiles(await api.files(repo, pr.number));
      summary.findings += findings.length;
      summary.omittedPatches += omittedPatches.length;
      if (!findings.length) {
        summary.skipped += 1;
        continue;
      }
      const body = renderReview({ sha: pr.head.sha, findings, omittedPatches });
      if (dryRun) console.log(`[dry-run] ${repo}#${pr.number}\n${body}`);
      else await api.review(repo, pr.number, body);
      summary.reviewed += 1;
    }
  }

  // A machine-readable terminal record supports Actions observability without
  // committing synthetic artifacts to manufacture contribution activity.
  console.log(JSON.stringify(summary));
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
