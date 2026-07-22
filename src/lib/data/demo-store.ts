import "server-only";
import { randomUUID } from "node:crypto";
import type {
  Answer,
  Announcement,
  Asset,
  DashboardSummary,
  Group,
  GroupDetails,
  Identity,
  Lesson,
  LessonDetails,
  PrivateStudentRecord,
  Question,
  Quiz,
  QuizDetails,
  Role,
  Subject,
  SubjectDetails,
  Submission,
  SubmissionDetails,
  UserRecord,
} from "@/domain/models";
import { gradeObjectiveAnswer, hasManualQuestions, totalPoints } from "@/domain/grading";
import { generateAccessCode, hashSecret, mutateDemoDatabase, readDemoDatabase } from "@/lib/demo/demo-db";
import { assertAllowed, assertFound, AppError } from "./errors";
import type { BasiraStore, CreateQuestionInput, CreatedAccessCode, CreateUserInput, SubmitAnswerInput } from "./contracts";

const now = () => new Date().toISOString();

function groupOwnedBy(identity: Identity, group: Group) {
  return identity.role === "admin" || (identity.role === "teacher" && group.ownerTeacherId === identity.userId);
}

async function allowedGroups(identity: Identity) {
  const db = await readDemoDatabase();
  if (identity.role === "admin") return db.groups;
  if (identity.role === "teacher") return db.groups.filter((g) => g.ownerTeacherId === identity.userId);
  const ids = new Set(db.memberships.filter((m) => m.studentId === identity.userId && m.status === "active").map((m) => m.groupId));
  return db.groups.filter((g) => ids.has(g.id) && g.status === "active");
}

export class DemoStore implements BasiraStore {
  async getDashboard(identity: Identity): Promise<DashboardSummary> {
    const db = await readDemoDatabase();
    const groups = await allowedGroups(identity);
    const groupIds = new Set(groups.map((g) => g.id));
    const subjectIds = new Set(db.subjects.filter((s) => groupIds.has(s.groupId)).map((s) => s.id));
    const latestLessons = db.lessons
      .filter((l) => subjectIds.has(l.subjectId) && (identity.role !== "student" || l.status === "published"))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
    const announcements = (await this.listAnnouncements(identity)).slice(0, 5);
    const pendingSubmissions = identity.role === "teacher"
      ? db.submissions.filter((s) => s.status === "pending_review" && db.quizzes.some((q) => q.id === s.quizId && this.quizBelongsToTeacher(db, q, identity.userId)))
      : [];
    const releasedSubmissions = identity.role === "student"
      ? db.submissions.filter((s) => s.studentId === identity.userId && s.status === "released")
      : [];
    const counts = identity.role === "admin"
      ? [
          { label: "المعلمون", value: db.users.filter((u) => u.role === "teacher").length, href: "/app/admin/teachers" },
          { label: "الطلاب", value: db.users.filter((u) => u.role === "student").length, href: "/app/admin/students" },
          { label: "المجموعات", value: db.groups.length, href: "/app/admin/groups" },
          { label: "الدروس المنشورة", value: db.lessons.filter((l) => l.status === "published").length },
        ]
      : identity.role === "teacher"
        ? [
            { label: "مجموعاتي", value: groups.length, href: "/app/teacher/groups" },
            { label: "طلابي", value: new Set(db.memberships.filter((m) => groupIds.has(m.groupId)).map((m) => m.studentId)).size, href: "/app/teacher/students" },
            { label: "دروسي", value: latestLessons.length },
            { label: "قيد التصحيح", value: pendingSubmissions.length, href: "/app/teacher/submissions" },
          ]
        : [
            { label: "مجموعاتي", value: groups.length, href: "/app/student/groups" },
            { label: "الدروس الجديدة", value: latestLessons.length },
            { label: "نتائجي", value: releasedSubmissions.length, href: "/app/student/results" },
          ];
    return { announcements, counts, groups, latestLessons, pendingSubmissions, releasedSubmissions };
  }

  async listUsers(identity: Identity, role?: Role) {
    const db = await readDemoDatabase();
    if (identity.role === "admin") return db.users.filter((u) => !role || u.role === role);
    if (identity.role === "teacher") {
      const groupIds = new Set(db.groups.filter((g) => g.ownerTeacherId === identity.userId).map((g) => g.id));
      const studentIds = new Set(db.memberships.filter((m) => groupIds.has(m.groupId)).map((m) => m.studentId));
      return db.users.filter((u) => u.id === identity.userId || (u.role === "student" && studentIds.has(u.id))).filter((u) => !role || u.role === role);
    }
    return db.users.filter((u) => u.id === identity.userId);
  }

  async createTeacher(identity: Identity, input: CreateUserInput): Promise<CreatedAccessCode> {
    assertAllowed(identity.role === "admin");
    return this.createAccount(identity, "teacher", input);
  }

  async createStudent(identity: Identity, input: CreateUserInput): Promise<CreatedAccessCode> {
    assertAllowed(identity.role === "admin" || identity.role === "teacher");
    if (identity.role === "teacher") {
      assertAllowed(Boolean(input.groupId), "يجب اختيار مجموعة");
      const group = assertFound((await readDemoDatabase()).groups.find((g) => g.id === input.groupId));
      assertAllowed(group.ownerTeacherId === identity.userId);
    }
    const created = await this.createAccount(identity, "student", input);
    if (input.groupId) {
      await this.addStudentToGroup(identity, input.groupId, created.user.id);
      if (identity.role === "teacher") {
        await this.upsertPrivateRecord(identity, {
          studentId: created.user.id,
          groupId: input.groupId,
          contactNumber: input.contactNumber,
          amountNote: input.amountNote,
          paymentNote: input.paymentNote,
        });
      }
    }
    return created;
  }

  private async createAccount(identity: Identity, role: Role, input: CreateUserInput): Promise<CreatedAccessCode> {
    const generated = generateAccessCode();
    return mutateDemoDatabase((db) => {
      const createdAt = now();
      const user: UserRecord = { id: randomUUID(), displayName: input.displayName, role, status: "active", createdBy: identity.userId, sessionInvalidBefore: createdAt, createdAt };
      db.users.push(user);
      db.credentials.push({ id: randomUUID(), userId: user.id, publicRef: generated.publicRef, secretHash: hashSecret(generated.secret), codeHint: `BSR-${generated.publicRef}-••••••••`, state: "unused", issuedBy: identity.userId, createdAt: now() });
      return { user, code: generated.code };
    });
  }

  async resetAccessCode(identity: Identity, userId: string): Promise<CreatedAccessCode> {
    const generated = generateAccessCode();
    return mutateDemoDatabase((db) => {
      const user = assertFound(db.users.find((u) => u.id === userId));
      if (identity.role === "teacher") {
        assertAllowed(user.role === "student");
        const ownGroupIds = new Set(db.groups.filter((g) => g.ownerTeacherId === identity.userId).map((g) => g.id));
        assertAllowed(db.memberships.some((m) => m.studentId === user.id && ownGroupIds.has(m.groupId)));
      } else assertAllowed(identity.role === "admin");
      db.credentials.filter((c) => c.userId === userId).forEach((c) => { c.state = "disabled"; });
      user.sessionInvalidBefore = now();
      db.credentials.push({ id: randomUUID(), userId, publicRef: generated.publicRef, secretHash: hashSecret(generated.secret), codeHint: `BSR-${generated.publicRef}-••••••••`, state: "unused", issuedBy: identity.userId, lastResetAt: now(), createdAt: now() });
      return { user, code: generated.code };
    });
  }

  async disableUser(identity: Identity, userId: string) {
    await mutateDemoDatabase((db) => {
      const user = assertFound(db.users.find((u) => u.id === userId));
      if (identity.role === "teacher") {
        assertAllowed(user.role === "student");
        const own = new Set(db.groups.filter((g) => g.ownerTeacherId === identity.userId).map((g) => g.id));
        assertAllowed(db.memberships.some((m) => m.studentId === user.id && own.has(m.groupId)));
      } else assertAllowed(identity.role === "admin");
      user.status = "disabled";
      user.sessionInvalidBefore = now();
      db.credentials.filter((c) => c.userId === userId).forEach((c) => { c.state = "disabled"; });
    });
  }

  async listGroups(identity: Identity) { return allowedGroups(identity); }

  async getGroup(identity: Identity, groupId: string): Promise<GroupDetails> {
    const db = await readDemoDatabase();
    const group = assertFound(db.groups.find((g) => g.id === groupId));
    const allowed = (await allowedGroups(identity)).some((g) => g.id === groupId);
    assertAllowed(allowed);
    const studentIds = new Set(db.memberships.filter((m) => m.groupId === groupId && m.status === "active").map((m) => m.studentId));
    return {
      group,
      owner: db.users.find((u) => u.id === group.ownerTeacherId),
      students: db.users.filter((u) => studentIds.has(u.id)),
      subjects: db.subjects.filter((s) => s.groupId === groupId).sort((a, b) => a.displayOrder - b.displayOrder),
      privateRecords: identity.role === "student" ? [] : db.privateRecords.filter((r) => r.groupId === groupId && (identity.role === "admin" || r.teacherId === identity.userId)),
    };
  }

  async createGroup(identity: Identity, input: { name: string; description?: string; ownerTeacherId?: string }): Promise<Group> {
    assertAllowed(identity.role === "admin" || identity.role === "teacher");
    return mutateDemoDatabase((db) => {
      const ownerTeacherId = identity.role === "teacher" ? identity.userId : input.ownerTeacherId;
      assertAllowed(Boolean(ownerTeacherId), "اختر المعلم المسؤول");
      const owner = assertFound(db.users.find((u) => u.id === ownerTeacherId && u.role === "teacher"));
      const group: Group = { id: randomUUID(), name: input.name, description: input.description, ownerTeacherId: owner.id, status: "active", createdBy: identity.userId, createdAt: now() };
      db.groups.push(group);
      return group;
    });
  }

  async transferGroup(identity: Identity, groupId: string, ownerTeacherId: string) {
    assertAllowed(identity.role === "admin");
    await mutateDemoDatabase((db) => {
      const group = assertFound(db.groups.find((g) => g.id === groupId));
      assertFound(db.users.find((u) => u.id === ownerTeacherId && u.role === "teacher"));
      group.ownerTeacherId = ownerTeacherId;
    });
  }

  async addStudentToGroup(identity: Identity, groupId: string, studentId: string) {
    await mutateDemoDatabase((db) => {
      const group = assertFound(db.groups.find((g) => g.id === groupId));
      assertAllowed(groupOwnedBy(identity, group));
      assertFound(db.users.find((u) => u.id === studentId && u.role === "student"));
      const existing = db.memberships.find((m) => m.groupId === groupId && m.studentId === studentId);
      if (existing) existing.status = "active";
      else db.memberships.push({ id: randomUUID(), groupId, studentId, status: "active", joinedAt: now() });
    });
  }

  async upsertPrivateRecord(identity: Identity, input: Omit<PrivateStudentRecord, "id" | "teacherId" | "updatedAt">) {
    assertAllowed(identity.role === "teacher" || identity.role === "admin");
    await mutateDemoDatabase((db) => {
      const group = assertFound(db.groups.find((g) => g.id === input.groupId));
      const teacherId = identity.role === "teacher" ? identity.userId : group.ownerTeacherId;
      assertAllowed(identity.role === "admin" || group.ownerTeacherId === identity.userId);
      const existing = db.privateRecords.find((r) => r.teacherId === teacherId && r.studentId === input.studentId && r.groupId === input.groupId);
      if (existing) Object.assign(existing, input, { updatedAt: now() });
      else db.privateRecords.push({ id: randomUUID(), teacherId, ...input, updatedAt: now() });
    });
  }

  async createSubject(identity: Identity, input: { groupId: string; title: string; description?: string }): Promise<Subject> {
    return mutateDemoDatabase((db) => {
      const group = assertFound(db.groups.find((g) => g.id === input.groupId));
      assertAllowed(identity.role === "teacher" && group.ownerTeacherId === identity.userId);
      const subject: Subject = { id: randomUUID(), groupId: group.id, title: input.title, description: input.description, displayOrder: db.subjects.filter((s) => s.groupId === group.id).length + 1, status: "active", createdAt: now() };
      db.subjects.push(subject);
      return subject;
    });
  }

  async getSubject(identity: Identity, subjectId: string): Promise<SubjectDetails> {
    const db = await readDemoDatabase();
    const subject = assertFound(db.subjects.find((s) => s.id === subjectId));
    const group = assertFound(db.groups.find((g) => g.id === subject.groupId));
    assertAllowed((await allowedGroups(identity)).some((g) => g.id === group.id));
    return { subject, group, lessons: db.lessons.filter((l) => l.subjectId === subject.id && (identity.role !== "student" || l.status === "published")).sort((a, b) => a.displayOrder - b.displayOrder) };
  }

  async createLesson(identity: Identity, input: { subjectId: string; title: string; description?: string; structureMode: "direct" | "parts" }): Promise<Lesson> {
    return mutateDemoDatabase((db) => {
      const subject = assertFound(db.subjects.find((s) => s.id === input.subjectId));
      const group = assertFound(db.groups.find((g) => g.id === subject.groupId));
      assertAllowed(identity.role === "teacher" && group.ownerTeacherId === identity.userId);
      const lesson: Lesson = { id: randomUUID(), subjectId: subject.id, title: input.title, description: input.description, displayOrder: db.lessons.filter((l) => l.subjectId === subject.id).length + 1, structureMode: input.structureMode, status: "draft", createdAt: now() };
      db.lessons.push(lesson);
      return lesson;
    });
  }

  async createLessonPart(identity: Identity, input: { lessonId: string; title: string; description?: string }) {
    return mutateDemoDatabase((db) => {
      const lesson = assertFound(db.lessons.find((item) => item.id === input.lessonId));
      const subject = assertFound(db.subjects.find((item) => item.id === lesson.subjectId));
      const group = assertFound(db.groups.find((item) => item.id === subject.groupId));
      assertAllowed(identity.role === "teacher" && group.ownerTeacherId === identity.userId);
      assertAllowed(lesson.structureMode === "parts", "هذا الدرس لا يستخدم الأجزاء");
      assertAllowed(lesson.status === "draft", "لا يمكن إضافة جزء بعد نشر الدرس");
      const part = { id: randomUUID(), lessonId: lesson.id, title: input.title, description: input.description, displayOrder: db.lessonParts.filter((item) => item.lessonId === lesson.id).length + 1, createdAt: now() };
      db.lessonParts.push(part);
      return part;
    });
  }

  async getLesson(identity: Identity, lessonId: string): Promise<LessonDetails> {
    const db = await readDemoDatabase();
    const lesson = assertFound(db.lessons.find((l) => l.id === lessonId));
    const subject = assertFound(db.subjects.find((s) => s.id === lesson.subjectId));
    const group = assertFound(db.groups.find((g) => g.id === subject.groupId));
    assertAllowed((await allowedGroups(identity)).some((g) => g.id === group.id));
    if (identity.role === "student") assertAllowed(lesson.status === "published");
    const parts = db.lessonParts.filter((p) => p.lessonId === lesson.id).sort((a, b) => a.displayOrder - b.displayOrder);
    const partIds = new Set(parts.map((p) => p.id));
    const assets = db.assets.filter((a) => a.lessonId === lesson.id || (a.lessonPartId && partIds.has(a.lessonPartId))).filter((a) => identity.role !== "student" || a.state === "ready");
    const quiz = db.quizzes.find((q) => q.lessonId === lesson.id && (identity.role !== "student" || q.status === "published"));
    const partQuizzes = db.quizzes.filter((q) => q.lessonPartId && partIds.has(q.lessonPartId) && (identity.role !== "student" || q.status === "published"));
    return { lesson, subject, group, parts, assets, quiz, partQuizzes };
  }

  async publishLesson(identity: Identity, lessonId: string) {
    await mutateDemoDatabase((db) => {
      const lesson = assertFound(db.lessons.find((l) => l.id === lessonId));
      const subject = assertFound(db.subjects.find((s) => s.id === lesson.subjectId));
      const group = assertFound(db.groups.find((g) => g.id === subject.groupId));
      assertAllowed(identity.role === "teacher" && group.ownerTeacherId === identity.userId);
      const parts = db.lessonParts.filter((p) => p.lessonId === lesson.id);
      const directHasContent = db.assets.some((a) => a.state === "ready" && a.lessonId === lesson.id) || db.quizzes.some((q) => q.lessonId === lesson.id && q.status === "published");
      if (lesson.structureMode === "direct") {
        assertAllowed(directHasContent, "أضف فيديو أو ملزمة أو اختبارًا منشورًا أولًا");
        assertAllowed(parts.length === 0, "لا يمكن خلط المحتوى المباشر مع الأجزاء");
      } else {
        assertAllowed(parts.length > 0, "أضف جزءًا واحدًا على الأقل");
        assertAllowed(!directHasContent, "لا يمكن خلط المحتوى المباشر مع الأجزاء");
        for (const part of parts) {
          const hasPartContent = db.assets.some((asset) => asset.state === "ready" && asset.lessonPartId === part.id) || db.quizzes.some((quiz) => quiz.lessonPartId === part.id && quiz.status === "published");
          assertAllowed(hasPartContent, `أضف محتوى جاهزًا إلى الجزء: ${part.title}`);
        }
      }
      lesson.status = "published";
      lesson.publishedAt = now();
    });
  }

  async attachAsset(identity: Identity, input: Omit<Asset, "id" | "createdAt" | "state"> & { state?: Asset["state"] }): Promise<Asset> {
    return mutateDemoDatabase((db) => {
      if (input.lessonId || input.lessonPartId) {
        const part = input.lessonPartId ? assertFound(db.lessonParts.find((item) => item.id === input.lessonPartId)) : undefined;
        const lessonId = input.lessonId ?? part?.lessonId;
        const lesson = assertFound(db.lessons.find((item) => item.id === lessonId));
        const subject = assertFound(db.subjects.find((item) => item.id === lesson.subjectId));
        const group = assertFound(db.groups.find((item) => item.id === subject.groupId));
        assertAllowed(identity.role === "teacher" && group.ownerTeacherId === identity.userId);
        assertAllowed((lesson.structureMode === "direct" && Boolean(input.lessonId) && !input.lessonPartId) || (lesson.structureMode === "parts" && Boolean(input.lessonPartId) && !input.lessonId), "بنية الدرس لا تطابق مكان الملف");
      } else if (input.submissionId) assertAllowed(identity.role === "student" && input.ownerStudentId === identity.userId);
      else throw new AppError("الملف غير مرتبط بعنصر صالح", "INVALID_PARENT");
      if (input.kind !== "submission") {
        db.assets.filter((a) => a.kind === input.kind && a.state !== "removed" && a.lessonId === input.lessonId && a.lessonPartId === input.lessonPartId).forEach((a) => { a.state = "removed"; });
      }
      const asset: Asset = { ...input, id: randomUUID(), state: input.state ?? "ready", createdAt: now() };
      db.assets.push(asset);
      return asset;
    });
  }

  async getAsset(identity: Identity, assetId: string): Promise<Asset> {
    const db = await readDemoDatabase();
    const asset = assertFound(db.assets.find((a) => a.id === assetId && a.state === "ready"));
    if (asset.kind === "submission") {
      assertAllowed(identity.role === "admin" || identity.userId === asset.ownerStudentId || (identity.role === "teacher" && this.assetSubmissionBelongsToTeacher(db, asset, identity.userId)));
    } else {
      const part = asset.lessonPartId ? assertFound(db.lessonParts.find((item) => item.id === asset.lessonPartId)) : undefined;
      const lesson = assertFound(db.lessons.find((item) => item.id === (asset.lessonId ?? part?.lessonId)));
      const subject = assertFound(db.subjects.find((s) => s.id === lesson.subjectId));
      assertAllowed((await allowedGroups(identity)).some((g) => g.id === subject.groupId));
      if (identity.role === "student") assertAllowed(lesson.status === "published");
    }
    return asset;
  }

  async createQuiz(identity: Identity, input: { lessonId?: string; lessonPartId?: string; title: string; instructions?: string; questions: CreateQuestionInput[] }): Promise<string> {
    return mutateDemoDatabase((db) => {
      const part = input.lessonPartId ? assertFound(db.lessonParts.find((item) => item.id === input.lessonPartId)) : undefined;
      const lesson = assertFound(db.lessons.find((item) => item.id === (input.lessonId ?? part?.lessonId)));
      const subject = assertFound(db.subjects.find((item) => item.id === lesson.subjectId));
      const group = assertFound(db.groups.find((item) => item.id === subject.groupId));
      assertAllowed(identity.role === "teacher" && group.ownerTeacherId === identity.userId);
      assertAllowed((lesson.structureMode === "direct" && Boolean(input.lessonId) && !input.lessonPartId) || (lesson.structureMode === "parts" && Boolean(input.lessonPartId) && !input.lessonId), "بنية الدرس لا تطابق مكان الاختبار");
      assertAllowed(!db.quizzes.some((quiz) => quiz.lessonId === input.lessonId && quiz.lessonPartId === input.lessonPartId), "يوجد اختبار بالفعل هنا");
      const quizId = randomUUID();
      const questions: Question[] = input.questions.map((q, index) => ({
        id: randomUUID(), quizId, type: q.type, prompt: q.prompt, points: q.points, displayOrder: index + 1, required: true,
        correctBoolean: q.correctBoolean,
        options: q.options?.map((option, optionIndex) => ({ id: randomUUID(), text: option.text, displayOrder: optionIndex + 1, isCorrect: option.isCorrect })),
      }));
      const quiz: Quiz = { id: quizId, lessonId: input.lessonId, lessonPartId: input.lessonPartId, title: input.title, instructions: input.instructions, status: "published", totalPoints: totalPoints(questions), hasManualQuestions: hasManualQuestions(questions), createdAt: now() };
      db.quizzes.push(quiz);
      db.questions.push(...questions);
      return quizId;
    });
  }

  async getQuiz(identity: Identity, quizId: string): Promise<QuizDetails> {
    const db = await readDemoDatabase();
    const quiz = assertFound(db.quizzes.find((q) => q.id === quizId));
    const part = quiz.lessonPartId ? assertFound(db.lessonParts.find((item) => item.id === quiz.lessonPartId)) : undefined;
    const lesson = assertFound(db.lessons.find((item) => item.id === (quiz.lessonId ?? part?.lessonId)));
    const subject = assertFound(db.subjects.find((s) => s.id === lesson.subjectId));
    const group = assertFound(db.groups.find((g) => g.id === subject.groupId));
    assertAllowed((await allowedGroups(identity)).some((g) => g.id === group.id));
    if (identity.role === "student") assertAllowed(quiz.status === "published" && lesson.status === "published");
    const existingSubmission = identity.role === "student" ? db.submissions.find((s) => s.quizId === quiz.id && s.studentId === identity.userId && s.status !== "void") : undefined;
    const reveal = identity.role !== "student" || existingSubmission?.status === "released";
    const answers = existingSubmission ? db.answers.filter((a) => a.submissionId === existingSubmission.id).map((answer) => reveal ? answer : ({ ...answer, autoScore: undefined, manualScore: undefined, feedback: undefined })) : undefined;
    const questions = db.questions.filter((q) => q.quizId === quiz.id).sort((a, b) => a.displayOrder - b.displayOrder).map((q) => {
      if (identity.role !== "student" || existingSubmission?.status === "released") return q;
      return { ...q, correctBoolean: undefined, options: q.options?.map((option) => ({ id: option.id, text: option.text, displayOrder: option.displayOrder })) };
    });
    const safeSubmission = identity.role === "student" && existingSubmission && existingSubmission.status !== "released" ? { ...existingSubmission, objectiveScore: 0, manualScore: 0, totalScore: 0 } : existingSubmission;
    return { quiz, questions, lesson, group, existingSubmission: safeSubmission, answers };
  }

  async submitQuiz(identity: Identity, quizId: string, inputs: SubmitAnswerInput[]): Promise<string> {
    assertAllowed(identity.role === "student");
    return mutateDemoDatabase((db) => {
      const quiz = assertFound(db.quizzes.find((q) => q.id === quizId && q.status === "published"));
      const part = quiz.lessonPartId ? assertFound(db.lessonParts.find((item) => item.id === quiz.lessonPartId)) : undefined;
      const lesson = assertFound(db.lessons.find((item) => item.id === (quiz.lessonId ?? part?.lessonId) && item.status === "published"));
      const subject = assertFound(db.subjects.find((s) => s.id === lesson.subjectId));
      assertAllowed(db.memberships.some((m) => m.groupId === subject.groupId && m.studentId === identity.userId && m.status === "active"));
      assertAllowed(!db.submissions.some((s) => s.quizId === quizId && s.studentId === identity.userId && s.status !== "void"), "تم تسليم هذا الاختبار بالفعل");
      const questions = db.questions.filter((q) => q.quizId === quiz.id);
      assertAllowed(inputs.length === questions.length && new Set(inputs.map((input) => input.questionId)).size === questions.length, "يجب إرسال إجابة واحدة لكل سؤال");
      assertAllowed(inputs.every((input) => questions.some((question) => question.id === input.questionId)), "توجد إجابة لسؤال غير صالح");
      const submission: Submission = { id: randomUUID(), quizId, studentId: identity.userId, status: quiz.hasManualQuestions ? "pending_review" : "released", objectiveScore: 0, manualScore: 0, totalScore: 0, submittedAt: now(), releasedAt: quiz.hasManualQuestions ? undefined : now(), resetCount: 0 };
      const answers: Answer[] = questions.map((question) => {
        const input = assertFound(inputs.find((answer) => answer.questionId === question.id));
        if (question.type === "mcq") assertAllowed(Boolean(input.selectedOptionId && question.options?.some((option) => option.id === input.selectedOptionId)), "اختر إجابة صالحة");
        if (question.type === "true_false") assertAllowed(typeof input.booleanValue === "boolean", "اختر صح أو خطأ");
        if (question.type === "essay_text") assertAllowed(Boolean(input.textValue?.trim()), "اكتب الإجابة المطلوبة");
        const autoScore = gradeObjectiveAnswer(question, input);
        return { id: randomUUID(), submissionId: submission.id, questionId: question.id, selectedOptionId: input.selectedOptionId, booleanValue: input.booleanValue, textValue: input.textValue, fileAssetId: input.fileAssetId, autoScore };
      });
      submission.objectiveScore = answers.reduce((sum, a) => sum + (a.autoScore ?? 0), 0);
      submission.totalScore = submission.objectiveScore;
      db.submissions.push(submission);
      db.answers.push(...answers);
      quiz.firstSubmissionAt ??= now();
      return submission.id;
    });
  }


  async attachSubmissionFile(identity: Identity, submissionId: string, questionId: string, input: { storagePath: string; originalFilename: string; mimeType: string; sizeBytes: number }): Promise<Asset> {
    assertAllowed(identity.role === "student");
    return mutateDemoDatabase((db) => {
      const submission = assertFound(db.submissions.find((item) => item.id === submissionId && item.studentId === identity.userId && item.status !== "void"));
      const question = assertFound(db.questions.find((item) => item.id === questionId && item.quizId === submission.quizId && item.type === "essay_file"));
      const answer = assertFound(db.answers.find((item) => item.submissionId === submission.id && item.questionId === question.id));
      const asset: Asset = { id: randomUUID(), kind: "submission", submissionId, ownerStudentId: identity.userId, title: input.originalFilename, storagePath: input.storagePath, originalFilename: input.originalFilename, mimeType: input.mimeType, sizeBytes: input.sizeBytes, state: "ready", createdAt: now() };
      db.assets.push(asset);
      answer.fileAssetId = asset.id;
      return asset;
    });
  }

  async voidSubmission(identity: Identity, submissionId: string) {
    assertAllowed(identity.role === "student");
    await mutateDemoDatabase((db) => {
      const submission = assertFound(db.submissions.find((item) => item.id === submissionId && item.studentId === identity.userId));
      submission.status = "void";
      db.answers = db.answers.filter((answer) => answer.submissionId !== submissionId);
      db.assets.filter((asset) => asset.submissionId === submissionId).forEach((asset) => { asset.state = "removed"; });
    });
  }

  async listSubmissions(identity: Identity): Promise<Submission[]> {
    const db = await readDemoDatabase();
    if (identity.role === "admin") return db.submissions;
    if (identity.role === "student") return db.submissions.filter((submission) => submission.studentId === identity.userId).map((submission) => submission.status === "released" ? submission : ({ ...submission, objectiveScore: 0, manualScore: 0, totalScore: 0 }));
    return db.submissions.filter((s) => {
      const quiz = db.quizzes.find((q) => q.id === s.quizId);
      return quiz ? this.quizBelongsToTeacher(db, quiz, identity.userId) : false;
    });
  }

  async getSubmission(identity: Identity, submissionId: string): Promise<SubmissionDetails> {
    const db = await readDemoDatabase();
    const submission = assertFound(db.submissions.find((s) => s.id === submissionId));
    const quiz = assertFound(db.quizzes.find((q) => q.id === submission.quizId));
    const student = assertFound(db.users.find((u) => u.id === submission.studentId));
    assertAllowed(identity.role === "admin" || (identity.role === "student" && identity.userId === submission.studentId) || (identity.role === "teacher" && this.quizBelongsToTeacher(db, quiz, identity.userId)));
    const reveal = identity.role !== "student" || submission.status === "released";
    const questions = db.questions.filter((q) => q.quizId === quiz.id).sort((a, b) => a.displayOrder - b.displayOrder).map((question) => {
      if (reveal) return question;
      return { ...question, correctBoolean: undefined, options: question.options?.map((option) => ({ id: option.id, text: option.text, displayOrder: option.displayOrder })) };
    });
    const answers = db.answers.filter((a) => a.submissionId === submission.id).map((answer) => reveal ? answer : ({ ...answer, autoScore: undefined, manualScore: undefined, feedback: undefined }));
    const safeSubmission = identity.role === "student" && !reveal ? { ...submission, objectiveScore: 0, manualScore: 0, totalScore: 0 } : submission;
    return { submission: safeSubmission, quiz, student, questions, answers };
  }

  async gradeSubmission(identity: Identity, submissionId: string, scores: Record<string, number>, feedback: Record<string, string>, release: boolean) {
    assertAllowed(identity.role === "teacher");
    await mutateDemoDatabase((db) => {
      const submission = assertFound(db.submissions.find((s) => s.id === submissionId));
      const quiz = assertFound(db.quizzes.find((q) => q.id === submission.quizId));
      assertAllowed(this.quizBelongsToTeacher(db, quiz, identity.userId));
      const questions = db.questions.filter((q) => q.quizId === quiz.id);
      const answers = db.answers.filter((a) => a.submissionId === submission.id);
      let manualScore = 0;
      for (const question of questions.filter((q) => q.type === "essay_text" || q.type === "essay_file")) {
        const answer = assertFound(answers.find((a) => a.questionId === question.id));
        if (question.type === "essay_file" && question.required) {
          const fileAsset = answer.fileAssetId ? db.assets.find((asset) => asset.id === answer.fileAssetId) : undefined;
          assertAllowed(Boolean(fileAsset && fileAsset.kind === "submission" && fileAsset.submissionId === submission.id && fileAsset.state === "ready"), "ملف الإجابة المطلوب غير موجود");
        }
        const score = scores[question.id] ?? 0;
        assertAllowed(score >= 0 && score <= question.points, "درجة غير صالحة");
        answer.manualScore = score;
        answer.feedback = feedback[question.id] ?? "";
        manualScore += score;
      }
      submission.manualScore = manualScore;
      submission.totalScore = submission.objectiveScore + manualScore;
      submission.status = release ? "released" : "graded";
      submission.gradedAt = now();
      submission.releasedAt = release ? now() : undefined;
    });
  }

  async listAnnouncements(identity: Identity): Promise<Announcement[]> {
    const db = await readDemoDatabase();
    const groupIds = new Set((await allowedGroups(identity)).map((g) => g.id));
    return db.announcements.filter((a) => a.isActive && (a.targetType === "global" || (a.groupId && groupIds.has(a.groupId)))).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async createAnnouncement(identity: Identity, input: Omit<Announcement, "id" | "createdBy" | "creatorRole" | "isActive" | "displayOrder" | "createdAt">): Promise<Announcement> {
    assertAllowed(identity.role === "admin" || identity.role === "teacher");
    if (identity.role === "teacher") {
      assertAllowed(input.targetType === "group" && Boolean(input.groupId));
      const group = assertFound((await readDemoDatabase()).groups.find((g) => g.id === input.groupId));
      assertAllowed(group.ownerTeacherId === identity.userId);
    }
    return mutateDemoDatabase((db) => {
      const announcement: Announcement = { ...input, id: randomUUID(), createdBy: identity.userId, creatorRole: identity.role as "admin" | "teacher", isActive: true, displayOrder: db.announcements.length + 1, createdAt: now() };
      db.announcements.push(announcement);
      return announcement;
    });
  }

  private quizBelongsToTeacher(db: Awaited<ReturnType<typeof readDemoDatabase>>, quiz: Quiz, teacherId: string) {
    const part = quiz.lessonPartId ? db.lessonParts.find((item) => item.id === quiz.lessonPartId) : undefined;
    const lesson = db.lessons.find((item) => item.id === (quiz.lessonId ?? part?.lessonId));
    const subject = lesson ? db.subjects.find((s) => s.id === lesson.subjectId) : undefined;
    const group = subject ? db.groups.find((g) => g.id === subject.groupId) : undefined;
    return group?.ownerTeacherId === teacherId;
  }

  private assetSubmissionBelongsToTeacher(db: Awaited<ReturnType<typeof readDemoDatabase>>, asset: Asset, teacherId: string) {
    const submission = db.submissions.find((s) => s.id === asset.submissionId);
    const quiz = submission ? db.quizzes.find((q) => q.id === submission.quizId) : undefined;
    return quiz ? this.quizBelongsToTeacher(db, quiz, teacherId) : false;
  }
}
