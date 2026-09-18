# Daily Code Review

This repository runs a guarded, dependency-free reviewer over open pull requests in an explicit repository allowlist. It analyzes added lines and submits a GitHub `COMMENT` review only when it finds a concrete security or workflow risk.

It replaces the former review simulation. The workflow no longer manufactures commits, pull requests, or issues merely to create activity. Every submitted review is attached to a real pull request and contains an actionable finding.

## Safeguards

- Scans only repositories in `REVIEW_REPOSITORIES`.
- Skips draft, closed, bot-authored, and self-authored pull requests.
- Deduplicates reviews against the pull request's exact head SHA.
- Submits comments only; it never approves or requests changes automatically.
- Ignores deleted lines and reports files whose patches GitHub omitted.
- Tests the analyzer before every scheduled execution.
- Uses immutable commit SHAs for third-party Actions.
- Defaults manual executions to dry-run mode.

## GitHub configuration

1. Create a dedicated GitHub App installation token or fine-grained token with read access to repository contents and pull requests, plus pull-request write access. Restrict it to the repositories that may be reviewed.
2. Add the credential as the Actions secret `GH_REVIEW_TOKEN` (this repository already has a secret under that name; confirm that its scope is suitably narrow before enabling live reviews).
3. Add `REVIEW_REPOSITORIES` as an Actions variable containing a comma-separated allowlist, for example `marco13-moo/api,marco13-moo/web`.
4. Run **Daily code review** manually with `dry_run` enabled and inspect the workflow summary.
5. Run it manually with `dry_run` disabled only after the findings and scope are correct. Scheduled runs submit actionable findings automatically.

GitHub attributes each review to the account or App represented by `GH_REVIEW_TOKEN`. Use a transparent bot identity; this project does not impersonate a person or promise personal contribution-graph credit.

## Local verification

```sh
npm test

GITHUB_TOKEN=... \
REVIEW_REPOSITORIES=owner/repository \
DRY_RUN=true \
npm start
```

## Current rules

- Private keys and hard-coded credential-like values
- Dynamic code execution through `eval` or `exec`
- GitHub Actions workflows granting `write-all`
- Untrusted GitHub event data interpolated directly into shell commands
- Actions pinned to floating branches such as `main`, `master`, or `latest`

Matches are review prompts for human validation, not proof of a vulnerability.
