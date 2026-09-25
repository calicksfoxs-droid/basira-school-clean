import { readFile } from "node:fs/promises";

const path = "dist/server/wrangler.json";
const expectedSecrets = [
  "BASIRA_APP_SECRET",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];

let config;
try {
  config = JSON.parse(await readFile(path, "utf8"));
} catch (error) {
  console.error(`CLOUDFLARE_CONFIG_VERIFY_FAIL: cannot read ${path}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const failures = [];
if (config?.name !== "basira-school-clean") failures.push(`unexpected worker name: ${String(config?.name)}`);
if (config?.vars?.BASIRA_BACKEND !== "supabase") failures.push("BASIRA_BACKEND is not supabase");
if (config?.vars?.NEXT_PUBLIC_APP_URL !== "https://basira-school-clean.calicksfoxs.workers.dev") {
  failures.push("NEXT_PUBLIC_APP_URL mismatch");
}
if (config?.vars?.NEXT_PUBLIC_SUPABASE_URL !== "https://fhedbrmdrgzvbtjvlgfu.supabase.co") {
  failures.push("NEXT_PUBLIC_SUPABASE_URL mismatch");
}
if (config?.vars?.VIDEO_STORAGE_PROVIDER !== "r2") failures.push("VIDEO_STORAGE_PROVIDER is not r2");
if (config?.vars?.R2_BUCKET_NAME !== "basira-videos") failures.push("R2_BUCKET_NAME mismatch");

const required = new Set(config?.secrets?.required ?? []);
for (const secret of expectedSecrets) {
  if (!required.has(secret)) failures.push(`missing generated required secret: ${secret}`);
}

if (failures.length) {
  console.error("CLOUDFLARE_CONFIG_VERIFY_FAIL");
  console.error(JSON.stringify({ path, failures }, null, 2));
  process.exit(1);
}

console.log("CLOUDFLARE_CONFIG_VERIFY_PASS");
console.log(JSON.stringify({
  path,
  worker: config.name,
  backend: config.vars.BASIRA_BACKEND,
  videoStorage: config.vars.VIDEO_STORAGE_PROVIDER,
  r2Bucket: config.vars.R2_BUCKET_NAME,
  requiredSecrets: expectedSecrets,
}, null, 2));
