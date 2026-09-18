const RULES = [
  { id: "private-key", severity: "critical", pattern: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/, message: "A private key appears in the change. Remove it and rotate the exposed credential." },
  { id: "credential", severity: "high", pattern: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i, message: "A hard-coded credential-like value was added. Store secrets in the repository secret manager instead." },
  { id: "dangerous-eval", severity: "high", pattern: /\b(?:eval|exec)\s*\(/, message: "Dynamic code execution was added. Avoid it or validate and constrain the input explicitly." },
  { id: "workflow-write-all", severity: "high", pattern: /^\+\s*permissions:\s*write-all\s*$/m, message: "The workflow requests `write-all`. Declare only the individual permissions the job needs." },
  { id: "shell-injection", severity: "high", pattern: /run:\s*.*\$\{\{\s*github\.event\.(?:issue|pull_request|comment|review)/, message: "Untrusted event data is interpolated directly into a shell command. Pass it through an environment variable and quote it." },
  { id: "floating-action", severity: "medium", pattern: /^\+\s*uses:\s*[^\s]+@(master|main|latest)\s*$/m, message: "The action uses a floating ref. Pin it to a full commit SHA to reduce supply-chain risk." }
];

/** Return only added diff lines, retaining their leading plus for anchored rules. */
export function addedText(patch = "") {
  return patch.split("\n").filter(line => line.startsWith("+") && !line.startsWith("+++")).join("\n");
}

/** Analyze GitHub file records without pretending an omitted patch was scanned. */
export function analyzeFiles(files) {
  const findings = [];
  const omittedPatches = [];
  for (const file of files) {
    if (typeof file.patch !== "string") {
      omittedPatches.push(file.filename);
      continue;
    }
    const text = addedText(file.patch);
    for (const rule of RULES) {
      // Every rule is non-global, so repeated tests remain deterministic.
      if (rule.pattern.test(text)) findings.push({ rule: rule.id, severity: rule.severity, path: file.filename, message: rule.message });
    }
  }
  return { findings, omittedPatches };
}

export function renderReview({ sha, findings, omittedPatches = [] }) {
  const marker = `<!-- daily-review-bot sha=${sha} -->`;
  const rows = findings.map(finding => `- **${finding.severity.toUpperCase()}** \`${finding.path}\` (${finding.rule}): ${finding.message}`);
  const coverage = omittedPatches.length ? ["", `> Coverage note: GitHub omitted patches for ${omittedPatches.length} changed file(s), so those files were not analyzed.`] : [];
  return [marker, "## Automated review findings", "", ...rows, ...coverage, "", "This rule-based review requires human validation before merge."].join("\n");
}

export function wasReviewed(reviews, sha) {
  return reviews.some(review => (review.body || "").includes(`<!-- daily-review-bot sha=${sha} -->`));
}

export function isEligible(pr, authenticatedLogin) {
  return Boolean(!pr.draft && pr.state === "open" && pr.user?.login !== authenticatedLogin && !/\[bot\]$/.test(pr.user?.login || "") && pr.head?.sha);
}
