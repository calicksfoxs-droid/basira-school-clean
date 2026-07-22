import "server-only";
import { randomUUID } from "node:crypto";
import type { DemoDatabase, Identity } from "@/domain/models";
import type {
  LearningJourneyNode,
  LearningSubject,
  LearningSubjectDetails,
  PlatformSettings,
  RevealedStudentEnrollmentReference,
  StudentEnrollmentReference,
  SubjectGroup,
  SubjectUnit,
  UnitLesson,
  UserPreferences,
} from "@/domain/core-models";
import { AppError, assertAllowed, assertFound } from "@/lib/data/errors";
import { mutateDemoDatabase } from "@/lib/demo/demo-db";
import {
  fingerprintEnrollmentReference,
  generateEnrollmentReference,
  maskEnrollmentReference,
  verifyEnrollmentReference,
} from "./enrollment-reference";
import type { LearningCoreStore } from "./contracts";

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
  async listLearningSubjects(identity: Identity): Promise<LearningSubject[]> {
    return mutateDemoDatabase((database) => database.learningSubjects
      .filter((subject) => canReadSubject(database, identity, subject))
      .sort((left, right) => left.displayOrder - right.displayOrder));
  }

  async getLearningSubject(identity: Identity, subjectId: string): Promise<LearningSubjectDetails> {
    return mutateDemoDatabase((database) => {
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
      };
    });
  }

  async createLearningSubject(identity: Identity, input: { title: string; description?: string }): Promise<LearningSubject> {
    assertAllowed(identity.role === "teacher");
    return mutateDemoDatabase((database) => {
      const timestamp = now();
      const subject: LearningSubject = {
        id: randomUUID(), teacherId: identity.userId, title: input.title.trim(),
        description: input.description?.trim() || undefined, status: "draft",
        displayOrder: database.learningSubjects.filter((item) => item.teacherId === identity.userId).length + 1,
        createdAt: timestamp, updatedAt: timestamp,
      };
      database.learningSubjects.push(subject);
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

  async createSubjectUnit(identity: Identity, input: { subjectId: string; title: string; description?: string }): Promise<SubjectUnit> {
    return mutateDemoDatabase((database) => {
      ownSubject(database, identity, input.subjectId);
      const unit: SubjectUnit = {
        id: randomUUID(), subjectId: input.subjectId, title: input.title.trim(),
        description: input.description?.trim() || undefined,
        displayOrder: database.learningUnits.filter((item) => item.subjectId === input.subjectId).length + 1,
        status: "draft", createdAt: now(),
      };
      database.learningUnits.push(unit);
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
      return lesson;
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
    return mutateDemoDatabase((database) => {
      const reference = assertFound(database.learningEnrollmentReferences.find((candidate) =>
        candidate.studentId === identity.userId && !candidate.revokedAt));
      return { studentId: reference.studentId, maskedReference: reference.maskedReference, rotatedAt: reference.rotatedAt };
    });
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
    return mutateDemoDatabase((database) => ({ ...database.platformSettings }));
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
    return mutateDemoDatabase((database) => ({ ...preferenceFor(database, identity.userId) }));
  }

  async updateUserPreferences(identity: Identity, input: { theme: "light" | "dark" | "system"; reducedMotion: boolean; locale: "ar" }): Promise<UserPreferences> {
    return mutateDemoDatabase((database) => {
      const preference = preferenceFor(database, identity.userId);
      Object.assign(preference, input, { updatedAt: now() });
      return { ...preference };
    });
  }

  async getLearningJourney(identity: Identity, subjectId: string): Promise<LearningJourneyNode[]> {
    return mutateDemoDatabase((database) => {
      const subject = assertFound(database.learningSubjects.find((candidate) => candidate.id === subjectId));
      assertAllowed(canReadSubject(database, identity, subject));
      const unitOrder = new Map(database.learningUnits
        .filter((unit) => unit.subjectId === subjectId)
        .map((unit) => [unit.id, unit.displayOrder]));
      return database.learningLessons
        .filter((lesson) => lesson.subjectId === subjectId &&
          (identity.role !== "student" || lesson.status === "published"))
        .sort((left, right) => (unitOrder.get(left.unitId) ?? 0) - (unitOrder.get(right.unitId) ?? 0) ||
          left.displayOrder - right.displayOrder)
        .map((lesson, index) => ({
          lessonId: lesson.id, unitId: lesson.unitId, order: index + 1,
          state: lesson.status === "published" ? "available" : "locked",
        }));
    });
  }
}
