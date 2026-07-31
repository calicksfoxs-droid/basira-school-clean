import "server-only";
import type { Identity } from "@/domain/models";
import type {
  LearningJourneyNode,
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

export interface LearningCoreStore {
  listLearningSubjects(identity: Identity): Promise<LearningSubject[]>;
  getLearningSubject(identity: Identity, subjectId: string): Promise<LearningSubjectDetails>;
  createLearningSubject(identity: Identity, input: { title: string; description?: string }): Promise<LearningSubject>;
  updateSubjectBanner(identity: Identity, input: { subjectId: string; title?: string; body?: string; ctaLabel?: string; ctaPath?: string }): Promise<void>;
  updateSubjectCover(identity: Identity, input: { subjectId: string; coverKey: SubjectCoverKey }): Promise<void>;
  createSubjectGroup(identity: Identity, input: { subjectId: string; name: string; description?: string }): Promise<SubjectGroup>;
  createSubjectUnit(identity: Identity, input: { subjectId: string; title: string; description?: string }): Promise<SubjectUnit>;
  createUnitLesson(identity: Identity, input: { unitId: string; title: string; description?: string; structureMode: "direct" | "parts" }): Promise<UnitLesson>;
  publishLearningSubject(identity: Identity, subjectId: string): Promise<void>;
  publishSubjectUnit(identity: Identity, unitId: string): Promise<void>;
  publishUnitLesson(identity: Identity, lessonId: string): Promise<void>;
  completeLearningLesson(identity: Identity, lessonId: string): Promise<void>;
  enrollStudentByReference(identity: Identity, input: { groupId: string; enrollmentReference: string }): Promise<{ studentId: string; displayName: string }>;
  getOwnEnrollmentReference(identity: Identity): Promise<StudentEnrollmentReference>;
  rotateEnrollmentReference(identity: Identity, studentId: string): Promise<RevealedStudentEnrollmentReference>;
  getPlatformSettings(identity: Identity): Promise<PlatformSettings>;
  updatePlatformSettings(identity: Identity, input: { platformName: string; timezone: string; maintenanceMessage?: string }): Promise<PlatformSettings>;
  getUserPreferences(identity: Identity): Promise<UserPreferences>;
  updateUserPreferences(identity: Identity, input: { theme: "light" | "dark" | "system"; reducedMotion: boolean; locale: "ar" }): Promise<UserPreferences>;
  getLearningJourney(identity: Identity, subjectId: string): Promise<LearningJourneyNode[]>;
}
