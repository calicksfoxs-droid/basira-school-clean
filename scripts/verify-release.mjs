import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/app/login/page.tsx",
  "src/app/app/admin/page.tsx",
  "src/app/app/teacher/page.tsx",
  "src/app/app/student/page.tsx",
  "src/app/api/health/route.ts",
  "src/app/api/uploads/authorize/route.ts",
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
if (failures.length) {
  console.error("Release verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Static release verification PASS (${required.length} required files, ${sourceFiles.length} source files scanned).`);
