export type CoreStatus = "draft" | "published" | "archived";
export type MembershipStatus = "active" | "removed";
export const SUBJECT_COVER_KEYS = [
  "general",
  "arabic",
  "english",
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "history",
  "geography",
  "computer",
] as const;
export type SubjectCoverKey = (typeof SUBJECT_COVER_KEYS)[number];

export interface LearningSubject {
  id: string;
  teacherId: string;
  title: string;
  description?: string;
  coverKey?: SubjectCoverKey;
  bannerTitle?: string;
  bannerBody?: string;
  bannerCtaLabel?: string;
  bannerCtaPath?: string;
  status: CoreStatus;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectGroup {
  id: string;
  subjectId: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  createdAt: string;
}

export interface SubjectGroupMembership {
  id: string;
  groupId: string;
  studentId: string;
  status: MembershipStatus;
  enrolledBy: string;
  joinedAt: string;
}

export interface SubjectUnit {
  id: string;
  subjectId: string;
  title: string;
  description?: string;
  displayOrder: number;
  status: CoreStatus;
  createdAt: string;
}

export interface UnitLesson {
  id: string;
  unitId: string;
  subjectId: string;
  title: string;
  description?: string;
  displayOrder: number;
  structureMode: "direct" | "parts";
  status: "draft" | "published" | "archived";
  publishedAt?: string;
  createdAt: string;
}

export interface StudentEnrollmentReference {
  studentId: string;
  maskedReference: string;
  rotatedAt: string;
}

export interface RevealedStudentEnrollmentReference extends StudentEnrollmentReference {
  reference: string;
}

/** Persistence-only representation. The full enrollment reference is never stored. */
export interface StoredStudentEnrollmentReference extends StudentEnrollmentReference {
  id: string;
  fingerprint: string;
  revokedAt?: string;
  createdAt: string;
}

export interface PlatformSettings {
  platformName: string;
  timezone: string;
  maintenanceMessage?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface UserPreferences {
  userId: string;
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
  locale: "ar";
  updatedAt: string;
}

export interface LearningJourneyNode {
  lessonId: string;
  unitId: string;
  order: number;
  state: "locked" | "available" | "completed";
}

export interface LearningProgress {
  studentId: string;
  subjectId: string;
  lessonId: string;
  completedAt: string;
}

export interface LearningSubjectDetails {
  subject: LearningSubject;
  groups: SubjectGroup[];
  units: SubjectUnit[];
  lessons: UnitLesson[];
}
