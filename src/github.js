export class GitHub {
  constructor(token, baseUrl = "https://api.github.com") {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
        "user-agent": "daily-code-review",
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`GitHub ${response.status} ${path}: ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  }

  /** Read all pages up to a deliberate ceiling to keep scheduled runs bounded. */
  async paginate(path, maxPages = 10) {
    const records = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const batch = await this.request(`${path}${separator}per_page=100&page=${page}`);
      records.push(...batch);
      if (batch.length < 100) return records;
    }
    throw new Error(`Pagination ceiling exceeded for ${path}`);
  }

  user() { return this.request("/user"); }
  pulls(repo) { return this.paginate(`/repos/${repo}/pulls?state=open&sort=updated&direction=desc`); }
  files(repo, number) { return this.paginate(`/repos/${repo}/pulls/${number}/files`); }
  reviews(repo, number) { return this.paginate(`/repos/${repo}/pulls/${number}/reviews`); }
  review(repo, number, body) {
    return this.request(`/repos/${repo}/pulls/${number}/reviews`, { method: "POST", body: JSON.stringify({ event: "COMMENT", body }) });
  }
}
