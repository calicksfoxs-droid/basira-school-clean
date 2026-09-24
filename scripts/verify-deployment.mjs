const [baseUrl, expectedCommit] = process.argv.slice(2);

if (!baseUrl || !expectedCommit) {
  console.error("Usage: npm run verify:deployment -- <base-url> <40-char-commit-sha>");
  process.exit(2);
}

if (!/^https:\/\//iu.test(baseUrl)) {
  console.error("Deployment URL must use https://");
  process.exit(2);
}

if (!/^[0-9a-f]{40}$/iu.test(expectedCommit)) {
  console.error("Expected commit must be a full 40-character Git SHA.");
  process.exit(2);
}

const url = new URL("/api/health?deep=1", baseUrl);
const response = await fetch(url, {
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(20_000),
});

if (!response.ok) {
  console.error(`Health probe failed with HTTP ${response.status}`);
  process.exit(1);
}

const body = await response.json();
const expectedShort = expectedCommit.slice(0, 12).toLowerCase();

const failures = [];
if (body?.ok !== true) failures.push("ok !== true");
if (body?.service !== "basira-school-platform") failures.push("unexpected service");
if (body?.backend !== "supabase") failures.push("backend !== supabase");
if (body?.database !== "ready") failures.push("database !== ready");
if (String(body?.commit ?? "").toLowerCase() !== expectedShort) {
  failures.push(`commit mismatch: expected ${expectedShort}, got ${String(body?.commit)}`);
}

if (failures.length) {
  console.error("DEPLOYMENT_VERIFY_FAIL");
  console.error(JSON.stringify({ url: url.toString(), body, failures }, null, 2));
  process.exit(1);
}

console.log("DEPLOYMENT_VERIFY_PASS");
console.log(JSON.stringify({
  url: baseUrl.replace(/\/$/u, ""),
  commit: body.commit,
  backend: body.backend,
  database: body.database,
}, null, 2));
