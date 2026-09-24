import { spawnSync } from "node:child_process";

const shouldRun = process.env.RUN_UI_E2E === "1" || process.env.GITHUB_REF_NAME === "ui/core-1.0";

if (!shouldRun) {
  console.log("Core 1.0 UI E2E skipped for this ref.");
  process.exit(0);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["playwright", "install", "--with-deps", "chromium"]);
run("npx", ["playwright", "test", "--project=desktop-chromium"]);
run("npx", ["playwright", "test", "test/e2e/roles.spec.ts", "--project=mobile-chromium", "--grep", "يعرض شريط التنقل السفلي"]);
