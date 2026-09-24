import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/app/login/page.tsx",
  "src/app/app/admin/page.tsx",
  "src/app/app/teacher/page.tsx",
  "src/app/app/student/page.tsx",
  "src/app/api/health/route.ts",
  "scripts/prepare-build-info.mjs",
  "src/app/api/uploads/authorize/route.ts",
  "src/app/api/uploads/finalize/route.ts",
  "src/components/files/upload-panel.tsx",
  "src/components/lessons/lesson-view.tsx",
  "supabase/migrations/015_core1_shared_login_rate_limit.sql",
  "supabase/migrations/016_core1_asset_aperture.sql",
  "src/app/api/files/[id]/route.ts",
  "src/lib/auth/index.ts",
  "src/lib/data/demo-store.ts",
  "src/lib/data/supabase-store.ts",
  "src/lib/core/demo-learning-core-store.ts",
  "src/lib/core/supabase-learning-core-store.ts",
  "src/app/api/learning/enrollment-reference/route.ts",
  "supabase/migrations/001_basira_clean.sql",
  "supabase/migrations/002_independent_learning_core.sql",
];
const failures = [];
for (const file of required) {
  try { await readFile(path.join(root, file)); } catch { failures.push(`Missing ${file}`); }
}

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(full));
    else result.push(full);
  }
  return result;
}
const sourceFiles = await filesUnder(path.join(root, "src"));
for (const file of sourceFiles.filter((value) => /\.(ts|tsx|js|jsx)$/.test(value))) {
  const content = await readFile(file, "utf8");
  const relative = path.relative(root, file);
  if (/NEXT_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET|PRIVATE)/.test(content)) failures.push(`Potential public secret name in ${relative}`);
  if (/serviceRoleKey/.test(content) && !relative.endsWith(path.join("lib", "supabase", "admin.ts")) && !relative.endsWith(path.join("lib", "env.ts"))) failures.push(`Service role reference outside server env/admin module: ${relative}`);
  if (/dangerouslySetInnerHTML/.test(content)) failures.push(`Unsafe HTML rendering in ${relative}`);
}
const migration = await readFile(path.join(root, "supabase/migrations/001_basira_clean.sql"), "utf8");
for (const expected of ["enable row level security", "session_is_current", "quiz_question_answers", "finalize_lesson_asset_phase13a", "submit_quiz_phase13a", "grade_submission_phase13a", "Required essay file is missing"]) {
  if (!migration.toLowerCase().includes(expected.toLowerCase())) failures.push(`Migration missing required lock: ${expected}`);
}
const coreMigration = await readFile(path.join(root, "supabase/migrations/002_independent_learning_core.sql"), "utf8");
for (const expected of ["subject_units", "owner_teacher_id", "student_in_learning_subject_v1", "enroll_student_by_reference_v1", "fingerprint", "masked_reference"]) {
  if (!coreMigration.toLowerCase().includes(expected.toLowerCase())) failures.push(`Core migration missing required lock: ${expected}`);
}
const referenceTable = coreMigration.match(/create table if not exists public\.student_enrollment_references[\s\S]*?\n\);/iu)?.[0] ?? "";
if (!referenceTable) failures.push("Enrollment reference table declaration not found");
if (/\b(reference|secret|plaintext)\s+text\b/iu.test(referenceTable)) failures.push("Enrollment reference table stores recoverable plaintext");
const referenceRoute = await readFile(path.join(root, "src/app/api/learning/enrollment-reference/route.ts"), "utf8");
if (!/Cache-Control.*no-store/isu.test(referenceRoute)) failures.push("Enrollment reference reveal response is cacheable");
const bucketBlockMatch = migration.match(/insert into storage\.buckets[\s\S]*?on conflict/iu);
if (!bucketBlockMatch) {
  failures.push("Storage bucket declaration block not found");
} else {
  const bucketBlock = bucketBlockMatch[0].replace(/\s+/gu, "").toLowerCase();
  for (const tuple of [
    "('lesson-videos','lesson-videos',false",
    "('lesson-handouts','lesson-handouts',false",
    "('submission-files','submission-files',false",
  ]) {
    if (!bucketBlock.includes(tuple)) failures.push(`Missing private Storage bucket tuple: ${tuple}`);
  }
  if (/\([^)]*true/iu.test(bucketBlockMatch[0])) failures.push("A Storage bucket may be public");
}
const limiterMigration = await readFile(path.join(root, "supabase/migrations/015_core1_shared_login_rate_limit.sql"), "utf8");
const recordLimiter = limiterMigration.match(/create or replace function public\.record_login_failure_v1[\s\S]*?\n\$\$;/iu)?.[0] ?? "";
if (!recordLimiter.includes("pg_advisory_xact_lock")) failures.push("Shared limiter record RPC is not same-key serialized");

const assetMigration = await readFile(path.join(root, "supabase/migrations/016_core1_asset_aperture.sql"), "utf8");
for (const expected of [
  "p_kind not in ('video','handout')",
  "p_mime_type not in ('video/mp4','video/webm')",
  "p_mime_type<>'application/pdf'",
  "drop policy if exists storage_teacher_lesson_aids_manage_v1",
]) {
  if (!assetMigration.includes(expected)) failures.push(`Core 1.0 asset DB aperture missing: ${expected}`);
}

const fileRoute = await readFile(path.join(root, "src/app/api/files/[id]/route.ts"), "utf8");
if (fileRoute.includes('"lesson-aids"') || fileRoute.includes('"submission-files"')) failures.push("File route still serves disabled asset buckets");
for (const expected of ["video/mp4", "video/webm", "application/pdf"]) {
  if (!fileRoute.includes(expected)) failures.push(`File route missing supported MIME guard: ${expected}`);
}

const finalizeRoute = await readFile(path.join(root, "src/app/api/uploads/finalize/route.ts"), "utf8");
for (const expected of [
  'payload.kind !== "video" && payload.kind !== "handout"',
  'payload.mimeType === "video/mp4"',
  'payload.mimeType === "video/webm"',
  'payload.mimeType === "application/pdf"',
]) {
  if (!finalizeRoute.includes(expected)) failures.push(`Upload finalize missing Core 1.0 aperture guard: ${expected}`);
}
if (finalizeRoute.includes('"lesson-aids"')) failures.push("Upload finalize still exposes lesson-aids");

const uploadPanel = await readFile(path.join(root, "src/components/files/upload-panel.tsx"), "utf8");
if (/\baid\b|image\/(jpeg|png|webp)/iu.test(uploadPanel)) failures.push("Upload panel still exposes disabled aid/image-handout capability");

const lessonView = await readFile(path.join(root, "src/components/lessons/lesson-view.tsx"), "utf8");
if (/kind="aid"|asset\.kind === "aid"|المساعدات/iu.test(lessonView)) failures.push("Lesson view still exposes disabled aid capability");

for (const storeFile of ["src/lib/data/demo-store.ts", "src/lib/data/supabase-store.ts"]) {
  const storeSource = await readFile(path.join(root, storeFile), "utf8");
  const attachBlock = storeSource.match(/async attachAsset[\s\S]*?\n  async getAsset/iu)?.[0] ?? "";
  if (!attachBlock) failures.push(`attachAsset block missing in ${storeFile}`);
  if (/input\.kind === "aid"/u.test(attachBlock)) failures.push(`attachAsset still accepts aid in ${storeFile}`);
  for (const expected of ["video/mp4", "video/webm", "application/pdf"]) {
    if (!attachBlock.includes(expected)) failures.push(`attachAsset missing ${expected} guard in ${storeFile}`);
  }
}

const healthRoute = await readFile(path.join(root, "src/app/api/health/route.ts"), "utf8");
if (!healthRoute.includes('BUILD_COMMIT') || !healthRoute.includes('@/generated/build-info')) {
  failures.push("Health route is not bound to generated build provenance");
}
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
for (const scriptName of ["build", "build:vinext", "typecheck", "test"]) {
  if (!String(packageJson.scripts?.[scriptName] ?? "").includes("prepare-build-info.mjs")) {
    failures.push(`Script ${scriptName} does not prepare build provenance`);
  }
}

if (failures.length) {
  console.error("Release verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Static release verification PASS (${required.length} required files, ${sourceFiles.length} source files scanned).`);
