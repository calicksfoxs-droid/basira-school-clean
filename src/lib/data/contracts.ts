import type {
  Announcement,
  Asset,
  DashboardSummary,
  Group,
  GroupDetails,
  Identity,
  Lesson,
  LessonDetails,
  PrivateStudentRecord,
  QuestionType,
  QuizDetails,
  Role,
  Subject,
  SubjectDetails,
  Submission,
  SubmissionDetails,
  UserRecord,
} from "@/domain/models";

export interface CreatedAccessCode {
  user: UserRecord;
  code: string;
}

export interface CreateUserInput {
  displayName: string;
  groupId?: string;
  contactNumber?: string;
  amountNote?: string;
  paymentNote?: string;
}

export interface CreateQuestionInput {
  type: QuestionType;
  prompt: string;
  points: number;
  options?: Array<{ text: string; isCorrect: boolean }>;
  correctBoolean?: boolean;
}

export interface SubmitAnswerInput {
  questionId: string;
  selectedOptionId?: string;
  booleanValue?: boolean;
  textValue?: string;
  fileAssetId?: string;
}

export interface BasiraStore {
  getDashboard(identity: Identity): Promise<DashboardSummary>;
  listUsers(identity: Identity, role?: Role): Promise<UserRecord[]>;
  createTeacher(identity: Identity, input: CreateUserInput): Promise<CreatedAccessCode>;
  createStudent(identity: Identity, input: CreateUserInput): Promise<CreatedAccessCode>;
  resetAccessCode(identity: Identity, userId: string): Promise<CreatedAccessCode>;
  disableUser(identity: Identity, userId: string): Promise<void>;

  listGroups(identity: Identity): Promise<Group[]>;
  getGroup(identity: Identity, groupId: string): Promise<GroupDetails>;
  createGroup(identity: Identity, input: { name: string; description?: string; ownerTeacherId?: string }): Promise<Group>;
  transferGroup(identity: Identity, groupId: string, ownerTeacherId: string): Promise<void>;
  addStudentToGroup(identity: Identity, groupId: string, studentId: string): Promise<void>;
  upsertPrivateRecord(identity: Identity, input: Omit<PrivateStudentRecord, "id" | "teacherId" | "updatedAt">): Promise<void>;

  createSubject(identity: Identity, input: { groupId: string; title: string; description?: string }): Promise<Subject>;
  getSubject(identity: Identity, subjectId: string): Promise<SubjectDetails>;
  createLesson(identity: Identity, input: { subjectId: string; title: string; description?: string; structureMode: "direct" | "parts" }): Promise<Lesson>;
  createLessonPart(identity: Identity, input: { lessonId: string; title: string; description?: string }): Promise<import("@/domain/models").LessonPart>;
  getLesson(identity: Identity, lessonId: string): Promise<LessonDetails>;
  publishLesson(identity: Identity, lessonId: string): Promise<void>;

  attachAsset(identity: Identity, input: Omit<Asset, "id" | "createdAt" | "state"> & { state?: Asset["state"] }): Promise<Asset>;
  getAsset(identity: Identity, assetId: string): Promise<Asset>;

  createQuiz(identity: Identity, input: { lessonId?: string; lessonPartId?: string; title: string; instructions?: string; questions: CreateQuestionInput[] }): Promise<string>;
  getQuiz(identity: Identity, quizId: string): Promise<QuizDetails>;
  submitQuiz(identity: Identity, quizId: string, answers: SubmitAnswerInput[]): Promise<string>;
  attachSubmissionFile(identity: Identity, submissionId: string, questionId: string, input: { storagePath: string; originalFilename: string; mimeType: string; sizeBytes: number; bytes?: Uint8Array }): Promise<Asset>;
  voidSubmission(identity: Identity, submissionId: string): Promise<void>;
  listSubmissions(identity: Identity): Promise<Submission[]>;
  getSubmission(identity: Identity, submissionId: string): Promise<SubmissionDetails>;
  gradeSubmission(identity: Identity, submissionId: string, scores: Record<string, number>, feedback: Record<string, string>, release: boolean): Promise<void>;

  listAnnouncements(identity: Identity): Promise<Announcement[]>;
  createAnnouncement(identity: Identity, input: Omit<Announcement, "id" | "createdBy" | "creatorRole" | "isActive" | "displayOrder" | "createdAt">): Promise<Announcement>;
}
