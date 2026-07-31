import "server-only";
import { randomUUID } from "node:crypto";
import type { DemoDatabase, Identity } from "@/domain/models";
import type {
  LearningJourneyNode,
  CurriculumGrade,
  CurriculumGradeDetails,
  LearningSubject,
  LearningSubjectDetails,
  SubjectCoverKey,
  PlatformSettings,
  RevealedStudentEnrollmentReference,
  StudentEnrollmentReference,
  SubjectGroup,
  SubjectUnit,
  UnitLesson,
  UserPreferences,
} from "@/domain/core-models";
import { AppError, assertAllowed, assertFound } from "@/lib/data/errors";
import { mutateDemoDatabase, readDemoDatabase } from "@/lib/demo/demo-db";
import {
  fingerprintEnrollmentReference,
  generateEnrollmentReference,
  maskEnrollmentReference,
  verifyEnrollmentReference,
} from "./enrollment-reference";
import type { LearningCoreStore } from "./contracts";
import { inferSubjectCoverKey } from "@/lib/subject-covers";

const now = () => new Date().toISOString();

function canManageSubject(identity: Identity, subject: LearningSubject) {
  return identity.role === "admin" ||
    (identity.role === "teacher" && subject.teacherId === identity.userId);
}

function canReadSubject(database: DemoDatabase, identity: Identity, subject: LearningSubject) {
  if (canManageSubject(identity, subject)) return true;
  if (identity.role !== "student" || subject.status !== "published") return false;
  const activeGroupIds = new Set(database.learningGroups
    .filter((group) => group.subjectId === subject.id && group.status === "active")
    .map((group) => group.id));
  return database.learningMemberships.some((membership) =>
    membership.studentId === identity.userId && membership.status === "active" &&
    activeGroupIds.has(membership.groupId));
}

function ownSubject(database: DemoDatabase, identity: Identity, subjectId: string) {
  const subject = assertFound(database.learningSubjects.find((candidate) => candidate.id === subjectId));
  assertAllowed(canManageSubject(identity, subject));
  return subject;
}

function preferenceFor(database: DemoDatabase, userId: string): UserPreferences {
  let preference = database.userPreferences.find((candidate) => candidate.userId === userId);
  if (!preference) {
    preference = { userId, theme: "system", reducedMotion: false, locale: "ar", updatedAt: now() };
    database.userPreferences.push(preference);
  }
  return preference;
}

export class DemoLearningCoreStore implements LearningCoreStore {
  async listCurriculumGrades(identity: Identity): Promise<CurriculumGrade[]> {
    const database = await readDemoDatabase();
    const visibleSubjectGradeIds = identity.role === "student"
      ? new Set(database.learningSubjects.filter((subject) => canReadSubject(database, identity, subject)).map((subject) => subject.gradeId))
      : undefined;
    return database.curriculumGrades
      .filter((grade) => identity.role === "admin" || (identity.role === "teacher" ? grade.teacherId === identity.userId : visibleSubjectGradeIds?.has(grade.id)))
      .filter((grade) => grade.status === "active")
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  async getCurriculumGrade(identity: Identity, gradeId: string): Promise<CurriculumGradeDetails> {
    const database = await readDemoDatabase();
    const grade = assertFound(database.curriculumGrades.find((candidate) => candidate.id === gradeId));
    const subjects = database.learningSubjects
      .filter((subject) => subject.gradeId === gradeId && canReadSubject(database, identity, subject))
      .sort((left, right) => left.displayOrder - right.displayOrder);
    assertAllowed(identity.role === "admin" || (identity.role === "teacher" && grade.teacherId === identity.userId) || (identity.role === "student" && subjects.length > 0));
    return { grade, subjects };
  }

  async createCurriculumGrade(identity: Identity, input: { title: string; description?: string }): Promise<CurriculumGrade> {
    assertAllowed(identity.role === "teacher");
    return mutateDemoDatabase((database) => {
      const timestamp = now();
      const grade: CurriculumGrade = {
        id: randomUUID(), teacherId: identity.userId, title: input.title.trim(),
        description: input.description?.trim() || undefined,
        displayOrder: database.curriculumGrades.filter((item) => item.teacherId === identity.userId).length + 1,
        status: "active", createdAt: timestamp, updatedAt: timestamp,
      };
      database.curriculumGrades.push(grade);
      return grade;
    });
  }

  async listLearningSubjects(identity: Identity): Promise<LearningSubject[]> {
    const database = await readDemoDatabase();
    return database.learningSubjects
      .filter((subject) => canReadSubject(database, identity, subject))
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  async getLearningSubject(identity: Identity, subjectId: string): Promise<LearningSubjectDetails> {
    const database = await readDemoDatabase();
    const subject = assertFound(database.learningSubjects.find((candidate) => candidate.id === subjectId));
    assertAllowed(canReadSubject(database, identity, subject));
    const studentGroupIds = identity.role === "student"
      ? new Set(database.learningMemberships
        .filter((membership) => membership.studentId === identity.userId && membership.status === "active")
        .map((membership) => membership.groupId))
      : undefined;
    return {
      subject,
      groups: database.learningGroups.filter((group) => group.subjectId === subjectId &&
        (!studentGroupIds || (group.status === "active" && studentGroupIds.has(group.id)))),
      units: database.learningUnits.filter((unit) => unit.subjectId === subjectId &&
        (identity.role !== "student" || unit.status === "published"))
        .sort((left, right) => left.displayOrder - right.displayOrder),
      lessons: database.learningLessons.filter((lesson) => lesson.subjectId === subjectId &&
        (identity.role !== "student" || lesson.status === "published"))
        .sort((left, right) => left.displayOrder - right.displayOrder),
    };
  }

  async createLearningSubject(identity: Identity, input: { gradeId: string; title: string; description?: string }): Promise<LearningSubject> {
    assertAllowed(identity.role === "teacher");
    return mutateDemoDatabase((database) => {
      const timestamp = now();
      const grade = assertFound(database.curriculumGrades.find((item) => item.id === input.gradeId));
      assertAllowed(grade.teacherId === identity.userId && grade.status === "active");
      const subject: LearningSubject = {
        id: randomUUID(), teacherId: identity.userId, gradeId: input.gradeId, title: input.title.trim(),
        description: input.description?.trim() || undefined, coverKey: inferSubjectCoverKey(input.title), status: "draft",
        displayOrder: database.learningSubjects.filter((item) => item.teacherId === identity.userId).length + 1,
        createdAt: timestamp, updatedAt: timestamp,
      };
      database.learningSubjects.push(subject);
      // Demo persistence mirrors Supabase, where Learning Core and lesson
      // content share the same subjects table.
      database.subjects.push({
        id: subject.id,
        ownerTeacherId: subject.teacherId,
        title: subject.title,
        description: subject.description,
        displayOrder: subject.displayOrder,
        status: subject.status,
        createdAt: subject.createdAt,
      });
      for (const termSegment of [1, 2, 3, 4] as const) {
        for (let unitNumber = 1; unitNumber <= 2; unitNumber += 1) {
          database.learningUnits.push({
            id: randomUUID(), subjectId: subject.id, title: `الوحدة ${unitNumber === 1 ? "الأولى" : "الثانية"}`,
            termSegment, displayOrder: unitNumber, status: "draft", createdAt: timestamp,
          });
        }
      }
      return subject;
    });
  }

  async updateSubjectBanner(identity: Identity, input: { subjectId: string; title?: string; body?: string; ctaLabel?: string; ctaPath?: string }): Promise<void> {
    await mutateDemoDatabase((database) => {
      const subject = ownSubject(database, identity, input.subjectId);
      assertAllowed(Boolean(input.ctaLabel) === Boolean(input.ctaPath));
      subject.bannerTitle = input.title?.trim() || undefined;
      subject.bannerBody = input.body?.trim() || undefined;
      subject.bannerCtaLabel = input.ctaLabel?.trim() || undefined;
      subject.bannerCtaPath = input.ctaPath?.trim() || undefined;
      subject.updatedAt = now();
    });
  }

  async updateSubjectCover(identity: Identity, input: { subjectId: string; coverKey: SubjectCoverKey }): Promise<void> {
    await mutateDemoDatabase((database) => {
      const subject = ownSubject(database, identity, input.subjectId);
      subject.coverKey = input.coverKey;
      subject.updatedAt = now();
    });
  }

  async createSubjectGroup(identity: Identity, input: { subjectId: string; name: string; description?: string }): Promise<SubjectGroup> {
    return mutateDemoDatabase((database) => {
      ownSubject(database, identity, input.subjectId);
      const group: SubjectGroup = {
        id: randomUUID(), subjectId: input.subjectId, name: input.name.trim(),
        description: input.description?.trim() || undefined, status: "active", createdAt: now(),
      };
      database.learningGroups.push(group);
      return group;
    });
  }

  async createSubjectUnit(identity: Identity, input: { subjectId: string; termSegment: 1 | 2 | 3 | 4; lessonCount: number; title: string; description?: string }): Promise<SubjectUnit> {
    return mutateDemoDatabase((database) => {
      ownSubject(database, identity, input.subjectId);
      const unit: SubjectUnit = {
        id: randomUUID(), subjectId: input.subjectId, title: input.title.trim(),
        description: input.description?.trim() || undefined,
        termSegment: input.termSegment,
        displayOrder: database.learningUnits.filter((item) => item.subjectId === input.subjectId && item.termSegment === input.termSegment).length + 1,
        status: "draft", createdAt: now(),
      };
      database.learningUnits.push(unit);
      for (let index = 1; index <= input.lessonCount; index += 1) {
        const lesson: UnitLesson = {
          id: randomUUID(), unitId: unit.id, subjectId: unit.subjectId, title: `الدرس ${index}`,
          displayOrder: index, structureMode: "direct", status: "draft", createdAt: now(),
        };
        database.learningLessons.push(lesson);
        database.lessons.push({ id: lesson.id, subjectId: lesson.subjectId, unitId: lesson.unitId, title: lesson.title, displayOrder: lesson.displayOrder, structureMode: lesson.structureMode, status: lesson.status, createdAt: lesson.createdAt });
      }
      return unit;
    });
  }

  async createUnitLesson(identity: Identity, input: { unitId: string; title: string; description?: string; structureMode: "direct" | "parts" }): Promise<UnitLesson> {
    return mutateDemoDatabase((database) => {
      const unit = assertFound(database.learningUnits.find((candidate) => candidate.id === input.unitId));
      ownSubject(database, identity, unit.subjectId);
      const lesson: UnitLesson = {
        id: randomUUID(), unitId: unit.id, subjectId: unit.subjectId, title: input.title.trim(),
        description: input.description?.trim() || undefined,
        displayOrder: database.learningLessons.filter((item) => item.unitId === unit.id).length + 1,
        structureMode: input.structureMode, status: "draft", createdAt: now(),
      };
      database.learningLessons.push(lesson);
      database.lessons.push({
        id: lesson.id,
        subjectId: lesson.subjectId,
        unitId: lesson.unitId,
        title: lesson.title,
        description: lesson.description,
        displayOrder: lesson.displayOrder,
        structureMode: lesson.structureMode,
        status: lesson.status,
        createdAt: lesson.createdAt,
      });
      return lesson;
    });
  }

  async removeUnitLesson(identity: Identity, lessonId: string): Promise<void> {
    await mutateDemoDatabase((database) => {
      const lesson = assertFound(database.learningLessons.find((item) => item.id === lessonId));
      ownSubject(database, identity, lesson.subjectId);
      lesson.status = "archived";
      const contentLesson = database.lessons.find((item) => item.id === lessonId);
      if (contentLesson) contentLesson.status = "archived";
    });
  }

  async publishLearningSubject(identity: Identity, subjectId: string): Promise<void> {
    await mutateDemoDatabase((database) => {
      const subject = ownSubject(database, identity, subjectId);
      assertAllowed(database.learningGroups.some((group) => group.subjectId === subjectId && group.status === "active"), "أضف مجموعة نشطة قبل نشر المادة");
      assertAllowed(database.learningUnits.some((unit) => unit.subjectId === subjectId && unit.status === "published"), "انشر وحدة واحدة على الأقل قبل نشر المادة");
      subject.status = "published";
      subject.updatedAt = now();
      const contentSubject = database.subjects.find((item) => item.id === subjectId);
      if (contentSubject) contentSubject.status = "published";
    });
  }

  async publishSubjectUnit(identity: Identity, unitId: string): Promise<void> {
    await mutateDemoDatabase((database) => {
      const unit = assertFound(database.learningUnits.find((item) => item.id === unitId));
      ownSubject(database, identity, unit.subjectId);
      assertAllowed(database.learningLessons.some((lesson) => lesson.unitId === unitId && lesson.status === "published"), "انشر درسًا واحدًا على الأقل قبل نشر الوحدة");
      unit.status = "published";
    });
  }

  async publishUnitLesson(identity: Identity, lessonId: string): Promise<void> {
    await mutateDemoDatabase((database) => {
      const lesson = assertFound(database.learningLessons.find((item) => item.id === lessonId));
      ownSubject(database, identity, lesson.subjectId);
      lesson.status = "published";
      lesson.publishedAt = now();
      const contentLesson = database.lessons.find((item) => item.id === lessonId);
      if (contentLesson) {
        contentLesson.status = "published";
        contentLesson.publishedAt = lesson.publishedAt;
      }
    });
  }

  async completeLearningLesson(identity: Identity, lessonId: string): Promise<void> {
    assertAllowed(identity.role === "student");
    await mutateDemoDatabase((database) => {
      const lesson = assertFound(database.learningLessons.find((item) => item.id === lessonId && item.status === "published"));
      const subject = assertFound(database.learningSubjects.find((item) => item.id === lesson.subjectId));
      assertAllowed(canReadSubject(database, identity, subject));
      const existing = database.learningProgress.find((item) => item.studentId === identity.userId && item.lessonId === lessonId);
      if (existing) existing.completedAt = now();
      else database.learningProgress.push({ studentId: identity.userId, subjectId: lesson.subjectId, lessonId, completedAt: now() });
    });
  }

  async enrollStudentByReference(identity: Identity, input: { groupId: string; enrollmentReference: string }): Promise<{ studentId: string; displayName: string }> {
    assertAllowed(identity.role === "teacher" || identity.role === "admin");
    return mutateDemoDatabase((database) => {
      const group = assertFound(database.learningGroups.find((candidate) => candidate.id === input.groupId));
      ownSubject(database, identity, group.subjectId);
      const reference = database.learningEnrollmentReferences.find((candidate) =>
        !candidate.revokedAt && verifyEnrollmentReference(input.enrollmentReference, candidate.fingerprint));
      if (!reference) throw new AppError("تعذر إضافة الطالب", "ENROLLMENT_FAILED", 404);
      const student = database.users.find((candidate) =>
        candidate.id === reference.studentId && candidate.role === "student" && candidate.status === "active");
      if (!student) throw new AppError("تعذر إضافة الطالب", "ENROLLMENT_FAILED", 404);
      const membership = database.learningMemberships.find((candidate) =>
        candidate.groupId === group.id && candidate.studentId === student.id);
      if (membership) {
        membership.status = "active";
        membership.enrolledBy = identity.userId;
        membership.joinedAt = now();
      } else {
        database.learningMemberships.push({
          id: randomUUID(), groupId: group.id, studentId: student.id,
          status: "active", enrolledBy: identity.userId, joinedAt: now(),
        });
      }
      return { studentId: student.id, displayName: student.displayName };
    });
  }

  async getOwnEnrollmentReference(identity: Identity): Promise<StudentEnrollmentReference> {
    assertAllowed(identity.role === "student");
    const database = await readDemoDatabase();
    const reference = assertFound(database.learningEnrollmentReferences.find((candidate) =>
      candidate.studentId === identity.userId && !candidate.revokedAt));
    return { studentId: reference.studentId, maskedReference: reference.maskedReference, rotatedAt: reference.rotatedAt };
  }

  async rotateEnrollmentReference(identity: Identity, studentId: string): Promise<RevealedStudentEnrollmentReference> {
    assertAllowed(identity.role === "admin" || (identity.role === "student" && identity.userId === studentId));
    return mutateDemoDatabase((database) => {
      assertFound(database.users.find((user) => user.id === studentId && user.role === "student" && user.status === "active"));
      const timestamp = now();
      for (const reference of database.learningEnrollmentReferences) {
        if (reference.studentId === studentId && !reference.revokedAt) reference.revokedAt = timestamp;
      }
      const reference = generateEnrollmentReference();
      const metadata = { studentId, maskedReference: maskEnrollmentReference(reference), rotatedAt: timestamp };
      database.learningEnrollmentReferences.push({
        id: randomUUID(), ...metadata, fingerprint: fingerprintEnrollmentReference(reference), createdAt: timestamp,
      });
      return { ...metadata, reference };
    });
  }

  async getPlatformSettings(identity: Identity): Promise<PlatformSettings> {
    assertAllowed(identity.status === "active");
    const database = await readDemoDatabase();
    return { ...database.platformSettings };
  }

  async updatePlatformSettings(identity: Identity, input: { platformName: string; timezone: string; maintenanceMessage?: string }): Promise<PlatformSettings> {
    assertAllowed(identity.role === "admin");
    return mutateDemoDatabase((database) => {
      database.platformSettings = {
        platformName: input.platformName.trim(), timezone: input.timezone.trim(),
        maintenanceMessage: input.maintenanceMessage?.trim() || undefined,
        updatedAt: now(), updatedBy: identity.userId,
      };
      return { ...database.platformSettings };
    });
  }

  async getUserPreferences(identity: Identity): Promise<UserPreferences> {
    const database = await readDemoDatabase();
    const preference = database.userPreferences.find((candidate) => candidate.userId === identity.userId);
    return preference ? { ...preference } : {
      userId: identity.userId, theme: "system", reducedMotion: false, locale: "ar", updatedAt: now(),
    };
  }

  async updateUserPreferences(identity: Identity, input: { theme: "light" | "dark" | "system"; reducedMotion: boolean; locale: "ar" }): Promise<UserPreferences> {
    return mutateDemoDatabase((database) => {
      const preference = preferenceFor(database, identity.userId);
      Object.assign(preference, input, { updatedAt: now() });
      return { ...preference };
    });
  }

  async getLearningJourney(identity: Identity, subjectId: string): Promise<LearningJourneyNode[]> {
    const database = await readDemoDatabase();
    const subject = assertFound(database.learningSubjects.find((candidate) => candidate.id === subjectId));
    assertAllowed(canReadSubject(database, identity, subject));
    const unitOrder = new Map(database.learningUnits
      .filter((unit) => unit.subjectId === subjectId && (identity.role !== "student" || unit.status === "published"))
      .map((unit) => [unit.id, unit.displayOrder]));
    const completed = new Set(database.learningProgress.filter((item) => item.studentId === identity.userId && item.subjectId === subjectId).map((item) => item.lessonId));
    let locked = false;
    return database.learningLessons
      .filter((lesson) => lesson.subjectId === subjectId && unitOrder.has(lesson.unitId) &&
        (identity.role !== "student" || lesson.status === "published"))
      .sort((left, right) => (unitOrder.get(left.unitId) ?? 0) - (unitOrder.get(right.unitId) ?? 0) ||
        left.displayOrder - right.displayOrder)
      .map((lesson, index) => {
        const isCompleted = completed.has(lesson.id);
        const state: LearningJourneyNode["state"] = isCompleted ? "completed" : locked ? "locked" : "available";
        if (!isCompleted) locked = true;
        return { lessonId: lesson.id, unitId: lesson.unitId, order: index + 1, state };
      });
  }
}
