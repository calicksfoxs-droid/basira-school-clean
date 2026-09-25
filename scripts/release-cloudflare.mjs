import { execFileSync, spawnSync } from "node:child_process";

const PROD_URL = "https://basira-school-clean.calicksfoxs.workers.dev";
const EXPECTED_SECRETS = [
  "BASIRA_APP_SECRET",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function fail(message) {
  console.error(`CLOUDFLARE_RELEASE_FAIL: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32",
    env: options.env ?? process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stderr.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
  return options.capture ? result.stdout : "";
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
}

const head = git("rev-parse", "HEAD").toLowerCase();
if (!/^[0-9a-f]{40}$/.test(head)) fail("Unable to resolve exact 40-character Git SHA.");

const dirty = git("status", "--porcelain");
if (dirty) fail("Working tree is not clean. Commit or discard local changes before release.");

for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!process.env[key]) fail(`Missing required operator environment variable: ${key}`);
}

console.log(`Release source SHA: ${head}`);

const buildEnv = {
  ...process.env,
  GITHUB_SHA: head,
  BASIRA_BACKEND: "demo",
  BASIRA_APP_SECRET: "cloudflare-build-only-secret-not-used-at-runtime-2026",
  NEXT_PUBLIC_APP_URL: PROD_URL,
  NEXT_PUBLIC_SUPABASE_URL: "https://fhedbrmdrgzvbtjvlgfu.supabase.co",
  RUN_UI_E2E: "1",
};

console.log("\n[1/6] Verifying release...");
run("npm", ["run", "verify:release"], { env: buildEnv });

console.log("\n[2/6] Building Vinext Cloudflare candidate...");
run("npm", ["run", "build:vinext"], { env: buildEnv });

console.log("\n[3/6] Validating remote Worker secret bindings...");
const secretList = run("npx", ["wrangler", "secret", "list", "--config", "dist/server/wrangler.json"], {
  capture: true,
  env: process.env,
});
for (const secret of EXPECTED_SECRETS) {
  if (!secretList.includes(secret)) fail(`Cloudflare Worker is missing required secret binding: ${secret}`);
}
console.log("Required Worker secret bindings are present.");

console.log("\n[4/6] Capturing rollback target...");
const beforeRaw = run("npx", ["wrangler", "deployments", "list", "--config", "dist/server/wrangler.json", "--json"], {
  capture: true,
  env: process.env,
});
let before = [];
try { before = JSON.parse(beforeRaw); } catch { fail("Could not parse Cloudflare deployment list before deploy."); }
const rollbackId = before?.[0]?.id ?? before?.[0]?.deployment_id ?? null;
console.log(`Previous deployment / rollback target: ${rollbackId ?? "unavailable"}`);

console.log("\n[5/6] Deploying exact candidate...");
run("npm", ["run", "deploy:vinext"], { env: { ...process.env, GITHUB_SHA: head } });

console.log("\n[6/6] Verifying deployed health and provenance...");
const expectedShort = head.slice(0, 12);
let health;
let lastError;
for (let attempt = 0; attempt < 12; attempt += 1) {
  try {
    const response = await fetch(`${PROD_URL}/api/health?deep=1`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (
      body?.ok === true &&
      body?.backend === "supabase" &&
      body?.database === "ready" &&
      String(body?.commit ?? "").toLowerCase() === expectedShort
    ) {
      health = body;
      break;
    }
    lastError = new Error(`Health mismatch: ${JSON.stringify(body)}`);
  } catch (error) {
    lastError = error;
  }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
if (!health) fail(lastError instanceof Error ? lastError.message : "Deep health verification failed.");

const afterRaw = run("npx", ["wrangler", "deployments", "list", "--config", "dist/server/wrangler.json", "--json"], {
  capture: true,
  env: process.env,
});
let after = [];
try { after = JSON.parse(afterRaw); } catch { fail("Could not parse Cloudflare deployment list after deploy."); }
const deploymentId = after?.[0]?.id ?? after?.[0]?.deployment_id ?? null;

console.log("\nCLOUDFLARE_RELEASE_PASS");
console.log(JSON.stringify({
  url: PROD_URL,
  commit: health.commit,
  backend: health.backend,
  database: health.database,
  deploymentId,
  rollbackId,
}, null, 2));
