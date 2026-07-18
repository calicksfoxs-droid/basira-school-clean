import { beforeEach, describe, expect, it } from "vitest";
import type { Identity } from "@/domain/models";
import { DemoStore } from "@/lib/data/demo-store";
import { readDemoDatabase, resetDemoDatabase } from "@/lib/demo/demo-db";

const admin: Identity = { userId: "00000000-0000-4000-8000-000000000001", displayName: "مدير بصيرة", role: "admin", status: "active" };
const teacher: Identity = { userId: "00000000-0000-4000-8000-000000000002", displayName: "أ. أحمد", role: "teacher", status: "active" };
const student: Identity = { userId: "00000000-0000-4000-8000-000000000003", displayName: "سارة محمد", role: "student", status: "active" };
const seededGroupId = "10000000-0000-4000-8000-000000000001";
const seededLessonId = "30000000-0000-4000-8000-000000000001";
const seededQuizId = "40000000-0000-4000-8000-000000000001";

describe.sequential("DemoStore role, grading, and replacement invariants", () => {
  beforeEach(async () => {
    await resetDemoDatabase();
  });

  it("isolates unassigned groups and private teacher records", async () => {
    const store = new DemoStore();
    const foreign = await store.createGroup(admin, { name: "مجموعة غير مسندة", ownerTeacherId: teacher.userId });

    await expect(store.getGroup(student, foreign.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const own = await store.getGroup(student, seededGroupId);
    expect(own.privateRecords).toEqual([]);
    expect(own.students.map((item) => item.id)).toContain(student.userId);
  });

  it("hides objective scores and correct answers until a mixed result is released", async () => {
    const store = new DemoStore();
    const teacherQuiz = await store.getQuiz(teacher, seededQuizId);
    const mcq = teacherQuiz.questions.find((question) => question.type === "mcq");
    const tf = teacherQuiz.questions.find((question) => question.type === "true_false");
    const essay = teacherQuiz.questions.find((question) => question.type === "essay_text");
    const file = teacherQuiz.questions.find((question) => question.type === "essay_file");
    const correctOption = mcq?.options?.find((option) => option.isCorrect);
    expect(correctOption).toBeDefined();
    expect(tf?.correctBoolean).toBe(false);

    const before = await store.getQuiz(student, seededQuizId);
    expect(before.questions.find((question) => question.type === "mcq")?.options?.some((option) => option.isCorrect)).toBe(false);
    expect(before.questions.find((question) => question.type === "true_false")?.correctBoolean).toBeUndefined();

    const submissionId = await store.submitQuiz(student, seededQuizId, [
      { questionId: mcq!.id, selectedOptionId: correctOption!.id },
      { questionId: tf!.id, booleanValue: false },
      { questionId: essay!.id, textValue: "المسافة كمية قياسية والإزاحة كمية متجهة." },
      { questionId: file!.id },
    ]);

    const pending = await store.getSubmission(student, submissionId);
    expect(pending.submission.status).toBe("pending_review");
    expect(pending.submission.totalScore).toBe(0);
    expect(pending.answers.every((answer) => answer.autoScore === undefined)).toBe(true);
    expect(pending.questions.find((question) => question.type === "true_false")?.correctBoolean).toBeUndefined();

    await store.attachSubmissionFile(student, submissionId, file!.id, { storagePath: `${seededGroupId}/${submissionId}/solution.pdf`, originalFilename: "solution.pdf", mimeType: "application/pdf", sizeBytes: 75 });
    await store.gradeSubmission(teacher, submissionId, { [essay!.id]: 3, [file!.id]: 3 }, { [essay!.id]: "إجابة واضحة", [file!.id]: "حل صحيح" }, true);
    const released = await store.getSubmission(student, submissionId);
    expect(released.submission.status).toBe("released");
    expect(released.submission.totalScore).toBe(10);
    expect(released.questions.find((question) => question.type === "true_false")?.correctBoolean).toBe(false);
    expect(released.questions.find((question) => question.type === "mcq")?.options?.find((option) => option.isCorrect)?.id).toBe(correctOption!.id);
  });


  it("rejects grading a required essay-file answer until a ready file exists", async () => {
    const store = new DemoStore();
    const quiz = await store.getQuiz(teacher, seededQuizId);
    const mcq = quiz.questions.find((question) => question.type === "mcq")!;
    const tf = quiz.questions.find((question) => question.type === "true_false")!;
    const essay = quiz.questions.find((question) => question.type === "essay_text")!;
    const file = quiz.questions.find((question) => question.type === "essay_file")!;
    const correctOption = mcq.options!.find((option) => option.isCorrect)!;
    const submissionId = await store.submitQuiz(student, seededQuizId, [
      { questionId: mcq.id, selectedOptionId: correctOption.id },
      { questionId: tf.id, booleanValue: false },
      { questionId: essay.id, textValue: "إجابة" },
      { questionId: file.id },
    ]);

    await expect(store.gradeSubmission(teacher, submissionId, { [essay.id]: 2, [file.id]: 2 }, {}, true)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await store.attachSubmissionFile(student, submissionId, file.id, { storagePath: `${seededGroupId}/${submissionId}/required.pdf`, originalFilename: "required.pdf", mimeType: "application/pdf", sizeBytes: 64 });
    await expect(store.gradeSubmission(teacher, submissionId, { [essay.id]: 2, [file.id]: 2 }, {}, true)).resolves.toBeUndefined();
  });

  it("replaces lesson assets without deleting the prior record first", async () => {
    const store = new DemoStore();
    const first = await store.attachAsset(teacher, { kind: "video", lessonId: seededLessonId, title: "الفيديو الأول", storagePath: `${seededGroupId}/first.mp4`, originalFilename: "first.mp4", mimeType: "video/mp4", sizeBytes: 100 });
    const second = await store.attachAsset(teacher, { kind: "video", lessonId: seededLessonId, title: "الفيديو الثاني", storagePath: `${seededGroupId}/second.mp4`, originalFilename: "second.mp4", mimeType: "video/mp4", sizeBytes: 200 });
    const database = await readDemoDatabase();
    expect(database.assets.find((asset) => asset.id === first.id)?.state).toBe("removed");
    expect(database.assets.find((asset) => asset.id === second.id)?.state).toBe("ready");
  });

  it("invalidates demo sessions logically when an access code is reset", async () => {
    const store = new DemoStore();
    const before = (await readDemoDatabase()).users.find((item) => item.id === student.userId)?.sessionInvalidBefore;
    const result = await store.resetAccessCode(teacher, student.userId);
    const database = await readDemoDatabase();
    const after = database.users.find((item) => item.id === student.userId)?.sessionInvalidBefore;
    expect(result.code).toMatch(/^BSR-[A-Z0-9]{4}-[A-Z0-9]{8}$/);
    expect(new Date(after!).getTime()).toBeGreaterThanOrEqual(new Date(before!).getTime());
    expect(database.credentials.filter((item) => item.userId === student.userId && item.state !== "disabled")).toHaveLength(1);
  });

  it("supports an optional one-level lesson-parts flow", async () => {
    const store = new DemoStore();
    const subject = await store.createSubject(teacher, { groupId: seededGroupId, title: "الكيمياء" });
    const lesson = await store.createLesson(teacher, { subjectId: subject.id, title: "الروابط الكيميائية", structureMode: "parts" });
    const part = await store.createLessonPart(teacher, { lessonId: lesson.id, title: "الجزء الأول" });
    await store.attachAsset(teacher, { kind: "handout", lessonPartId: part.id, title: "ملزمة الروابط", storagePath: `${seededGroupId}/bonding.pdf`, originalFilename: "bonding.pdf", mimeType: "application/pdf", sizeBytes: 120 });
    await store.publishLesson(teacher, lesson.id);

    const studentLesson = await store.getLesson(student, lesson.id);
    expect(studentLesson.lesson.status).toBe("published");
    expect(studentLesson.parts).toHaveLength(1);
    expect(studentLesson.assets[0]).toMatchObject({ lessonPartId: part.id, kind: "handout", state: "ready" });
  });

  it("removes the old teacher's access immediately after ownership transfer", async () => {
    const store = new DemoStore();
    const created = await store.createTeacher(admin, { displayName: "أ. منى" });
    const newTeacher: Identity = { userId: created.user.id, displayName: created.user.displayName, role: "teacher", status: "active" };

    await store.transferGroup(admin, seededGroupId, newTeacher.userId);
    await expect(store.getGroup(teacher, seededGroupId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const transferred = await store.getGroup(newTeacher, seededGroupId);
    expect(transferred.group.ownerTeacherId).toBe(newTeacher.userId);
  });

  it("voiding a submission removes answer records and submission assets", async () => {
    const store = new DemoStore();
    const quiz = await store.getQuiz(teacher, seededQuizId);
    const mcq = quiz.questions.find((question) => question.type === "mcq")!;
    const tf = quiz.questions.find((question) => question.type === "true_false")!;
    const essay = quiz.questions.find((question) => question.type === "essay_text")!;
    const file = quiz.questions.find((question) => question.type === "essay_file")!;
    const correctOption = mcq.options!.find((option) => option.isCorrect)!;
    const submissionId = await store.submitQuiz(student, seededQuizId, [
      { questionId: mcq.id, selectedOptionId: correctOption.id },
      { questionId: tf.id, booleanValue: false },
      { questionId: essay.id, textValue: "إجابة" },
      { questionId: file.id },
    ]);
    const asset = await store.attachSubmissionFile(student, submissionId, file.id, { storagePath: `${seededGroupId}/${submissionId}/answer.pdf`, originalFilename: "answer.pdf", mimeType: "application/pdf", sizeBytes: 50 });

    await store.voidSubmission(student, submissionId);
    const database = await readDemoDatabase();
    expect(database.submissions.find((item) => item.id === submissionId)?.status).toBe("void");
    expect(database.answers.some((item) => item.submissionId === submissionId)).toBe(false);
    expect(database.assets.find((item) => item.id === asset.id)?.state).toBe("removed");
  });

});
