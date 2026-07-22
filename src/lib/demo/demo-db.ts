import "server-only";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { AccessCredential, DemoDatabase, Role, UserRecord } from "@/domain/models";
import { env } from "@/lib/env";
import { fingerprintEnrollmentReference, maskEnrollmentReference } from "@/lib/core/enrollment-reference";

let mutationQueue: Promise<void> = Promise.resolve();

function now() {
  return new Date().toISOString();
}

export function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(secret, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function codeParts(publicRef?: string, secret?: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const generate = (size: number) => Array.from(randomBytes(size), (b) => alphabet[b % alphabet.length]).join("");
  return {
    publicRef: publicRef ?? generate(4),
    secret: secret ?? generate(8),
  };
}

export function generateAccessCode() {
  const parts = codeParts();
  return { ...parts, code: `BSR-${parts.publicRef}-${parts.secret}` };
}

export function parseAccessCode(code: string) {
  const match = /^BSR-([A-Z0-9]{4})-([A-Z0-9]{8})$/.exec(code.trim().toUpperCase());
  return match ? { publicRef: match[1], secret: match[2] } : null;
}

function createUser(id: string, displayName: string, role: Role, createdBy?: string): UserRecord {
  const createdAt = now();
  return { id, displayName, role, status: "active", createdBy, sessionInvalidBefore: createdAt, createdAt };
}

function credential(id: string, userId: string, publicRef: string, secret: string, issuedBy: string): AccessCredential {
  return {
    id,
    userId,
    publicRef,
    secretHash: hashSecret(secret),
    codeHint: `BSR-${publicRef}-••••••••`,
    state: "unused",
    issuedBy,
    createdAt: now(),
  };
}

function seedDatabase(): DemoDatabase {
  const adminId = "00000000-0000-4000-8000-000000000001";
  const teacherId = "00000000-0000-4000-8000-000000000002";
  const studentId = "00000000-0000-4000-8000-000000000003";
  const groupId = "10000000-0000-4000-8000-000000000001";
  const subjectId = "20000000-0000-4000-8000-000000000001";
  const lessonId = "30000000-0000-4000-8000-000000000001";
  const quizId = "40000000-0000-4000-8000-000000000001";
  const q1 = "41000000-0000-4000-8000-000000000001";
  const q2 = "41000000-0000-4000-8000-000000000002";
  const q3 = "41000000-0000-4000-8000-000000000003";
  const q4 = "41000000-0000-4000-8000-000000000004";
  const unitId = "25000000-0000-4000-8000-000000000001";
  const enrollmentReference = "BSR-S-ABCDEFGHJKLM";
  const users = [
    createUser(adminId, "مدير بصيرة", "admin"),
    createUser(teacherId, "أ. أحمد", "teacher", adminId),
    createUser(studentId, "سارة محمد", "student", teacherId),
  ];
  return {
    users,
    credentials: [
      credential(randomUUID(), adminId, "ADMN", "DEMO2026", adminId),
      credential(randomUUID(), teacherId, "TCHR", "DEMO2026", adminId),
      credential(randomUUID(), studentId, "STDN", "DEMO2026", teacherId),
    ],
    groups: [{ id: groupId, name: "الصف الثالث — فيزياء", ownerTeacherId: teacherId, status: "active", description: "مجموعة تجريبية", createdBy: teacherId, createdAt: now() }],
    memberships: [{ id: randomUUID(), groupId, studentId, status: "active", joinedAt: now() }],
    privateRecords: [{ id: randomUUID(), teacherId, studentId, groupId, contactNumber: "55500000", amountNote: "300 ر.ق", paymentNote: "تجريبي فقط", updatedAt: now() }],
    subjects: [{ id: subjectId, groupId, title: "الفيزياء", description: "أساسيات الحركة", displayOrder: 1, status: "active", createdAt: now() }],
    lessons: [{ id: lessonId, subjectId, title: "الحركة في خط مستقيم", description: "درس تمهيدي بسيط", displayOrder: 1, structureMode: "direct", status: "published", publishedAt: now(), createdAt: now() }],
    lessonParts: [],
    assets: [],
    quizzes: [{ id: quizId, lessonId, title: "اختبار الحركة", instructions: "أجب عن جميع الأسئلة", status: "published", totalPoints: 10, hasManualQuestions: true, createdAt: now() }],
    questions: [
      { id: q1, quizId, type: "mcq", prompt: "وحدة قياس السرعة هي:", points: 2, displayOrder: 1, required: true, options: [
        { id: randomUUID(), text: "م/ث", displayOrder: 1, isCorrect: true },
        { id: randomUUID(), text: "كجم", displayOrder: 2, isCorrect: false },
        { id: randomUUID(), text: "نيوتن", displayOrder: 3, isCorrect: false },
      ] },
      { id: q2, quizId, type: "true_false", prompt: "السرعة كمية متجهة دائمًا.", points: 2, displayOrder: 2, required: true, correctBoolean: false },
      { id: q3, quizId, type: "essay_text", prompt: "اشرح الفرق بين المسافة والإزاحة.", points: 3, displayOrder: 3, required: true },
      { id: q4, quizId, type: "essay_file", prompt: "ارفع صورة لحل المسألة الموجودة في الملزمة.", points: 3, displayOrder: 4, required: true },
    ],
    submissions: [],
    answers: [],
    announcements: [
      { id: randomUUID(), createdBy: adminId, creatorRole: "admin", targetType: "global", title: "أهلًا بك في بصيرة", body: "منصة بسيطة تجمع دروسك وملفاتك واختباراتك في مكان واحد.", ctaLabel: "فتح الرئيسية", ctaPath: "/app", isActive: true, displayOrder: 1, createdAt: now() },
      { id: randomUUID(), createdBy: teacherId, creatorRole: "teacher", targetType: "group", groupId, title: "الاختبار التجريبي متاح", body: "افتح درس الحركة ثم ابدأ الاختبار عند الاستعداد.", ctaLabel: "فتح الدرس", ctaPath: `/app/student/lessons/${lessonId}`, isActive: true, displayOrder: 2, createdAt: now() },
    ],
    learningSubjects: [{
      id: subjectId, teacherId, title: "الفيزياء", description: "أساسيات الحركة",
      bannerTitle: "ابدأ رحلتك في الفيزياء", bannerBody: "كل ما تحتاجه في مكان واحد.",
      status: "published", displayOrder: 1, createdAt: now(), updatedAt: now(),
    }],
    learningGroups: [{
      id: groupId, subjectId, name: "مجموعة الفيزياء", description: "مجموعة تجريبية",
      status: "active", createdAt: now(),
    }],
    learningMemberships: [{
      id: randomUUID(), groupId, studentId, status: "active", enrolledBy: teacherId, joinedAt: now(),
    }],
    learningUnits: [{
      id: unitId, subjectId, title: "الحركة", description: "أساسيات الحركة والقوى",
      displayOrder: 1, status: "published", createdAt: now(),
    }],
    learningLessons: [{
      id: lessonId, unitId, subjectId, title: "الحركة في خط مستقيم",
      description: "درس تمهيدي بسيط", displayOrder: 1, structureMode: "direct",
      status: "published", publishedAt: now(), createdAt: now(),
    }],
    learningProgress: [],
    learningEnrollmentReferences: [{
      id: randomUUID(), studentId, fingerprint: fingerprintEnrollmentReference(enrollmentReference),
      maskedReference: maskEnrollmentReference(enrollmentReference), rotatedAt: now(), createdAt: now(),
    }],
    platformSettings: {
      platformName: "بصيرة", timezone: "Asia/Riyadh", updatedAt: now(), updatedBy: adminId,
    },
    userPreferences: users.map((user) => ({
      userId: user.id, theme: "system" as const, reducedMotion: false, locale: "ar" as const, updatedAt: now(),
    })),
  };
}

function withCoreDefaults(database: DemoDatabase): DemoDatabase {
  const legacy = database as DemoDatabase & Partial<Pick<DemoDatabase,
    "learningSubjects" | "learningGroups" | "learningMemberships" | "learningUnits" |
    "learningLessons" | "learningProgress" | "learningEnrollmentReferences" | "platformSettings" | "userPreferences"
  >>;
  legacy.learningSubjects ??= [];
  legacy.learningGroups ??= [];
  legacy.learningMemberships ??= [];
  legacy.learningUnits ??= [];
  legacy.learningLessons ??= [];
  legacy.learningProgress ??= [];
  legacy.learningEnrollmentReferences ??= [];
  legacy.platformSettings ??= { platformName: "بصيرة", timezone: "Asia/Riyadh", updatedAt: now() };
  legacy.userPreferences ??= [];
  for (const subject of legacy.learningSubjects) {
    if (!legacy.subjects.some((item) => item.id === subject.id)) {
      legacy.subjects.push({
        id: subject.id, ownerTeacherId: subject.teacherId, title: subject.title,
        description: subject.description, displayOrder: subject.displayOrder,
        status: subject.status, createdAt: subject.createdAt,
      });
    }
  }
  for (const lesson of legacy.learningLessons) {
    if (!legacy.lessons.some((item) => item.id === lesson.id)) {
      legacy.lessons.push({
        id: lesson.id, subjectId: lesson.subjectId, unitId: lesson.unitId,
        title: lesson.title, description: lesson.description,
        displayOrder: lesson.displayOrder, structureMode: lesson.structureMode,
        status: lesson.status, publishedAt: lesson.publishedAt, createdAt: lesson.createdAt,
      });
    }
  }
  return legacy;
}

function dbPath() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), env.BASIRA_DEMO_DB_PATH);
}

export function demoUploadDir() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), env.BASIRA_DEMO_UPLOAD_DIR);
}

async function ensureDatabase() {
  const file = dbPath();
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await readFile(file, "utf8");
  } catch {
    await writeFile(file, JSON.stringify(seedDatabase(), null, 2), "utf8");
  }
}

export async function readDemoDatabase(): Promise<DemoDatabase> {
  await ensureDatabase();
  return withCoreDefaults(JSON.parse(await readFile(dbPath(), "utf8")) as DemoDatabase);
}

export async function mutateDemoDatabase<T>(fn: (database: DemoDatabase) => T | Promise<T>): Promise<T> {
  let result!: T;
  let error: unknown;
  mutationQueue = mutationQueue.then(async () => {
    try {
      const database = await readDemoDatabase();
      result = await fn(database);
      const temp = `${dbPath()}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(database, null, 2), "utf8");
      let replaced = false;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await rename(temp, dbPath());
          replaced = true;
          break;
        } catch (renameError) {
          const code = (renameError as NodeJS.ErrnoException).code;
          if (code !== "EPERM" && code !== "EACCES") throw renameError;
          await delay(20 * (attempt + 1));
        }
      }
      if (!replaced) {
        // Windows may keep the destination open briefly (indexer/AV). A direct
        // queued write is safer than failing the user's action after retries.
        await writeFile(dbPath(), JSON.stringify(database, null, 2), "utf8");
        await rm(temp, { force: true });
      }
    } catch (caught) {
      error = caught;
    }
  });
  await mutationQueue;
  if (error) throw error;
  return result;
}

export async function resetDemoDatabase() {
  await mkdir(path.dirname(dbPath()), { recursive: true });
  await writeFile(dbPath(), JSON.stringify(seedDatabase(), null, 2), "utf8");
}

export const DEMO_CODES = {
  admin: "BSR-ADMN-DEMO2026",
  teacher: "BSR-TCHR-DEMO2026",
  student: "BSR-STDN-DEMO2026",
} as const;
