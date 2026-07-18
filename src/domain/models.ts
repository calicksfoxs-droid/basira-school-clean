export type Role = "admin" | "teacher" | "student";
export type AccountState = "unused" | "active" | "disabled";
export type GroupState = "active" | "disabled" | "archived";
export type ContentState = "draft" | "published";
export type StructureMode = "direct" | "parts";
export type AssetState = "uploading" | "verifying" | "ready" | "failed" | "removed";
export type QuestionType = "mcq" | "true_false" | "essay_text" | "essay_file";
export type SubmissionState = "submitted" | "pending_review" | "graded" | "released" | "void";

export interface Identity {
  userId: string;
  displayName: string;
  role: Role;
  status: "active" | "disabled";
}

export interface UserRecord {
  id: string;
  displayName: string;
  role: Role;
  status: "active" | "disabled";
  syntheticEmail?: string;
  createdBy?: string;
  sessionInvalidBefore?: string;
  createdAt: string;
}

export interface AccessCredential {
  id: string;
  userId: string;
  publicRef: string;
  secretHash: string;
  codeHint: string;
  state: AccountState;
  issuedBy: string;
  firstUsedAt?: string;
  lastResetAt?: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  ownerTeacherId: string;
  status: GroupState;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface GroupMembership {
  id: string;
  groupId: string;
  studentId: string;
  status: "active" | "removed";
  joinedAt: string;
}

export interface PrivateStudentRecord {
  id: string;
  teacherId: string;
  studentId: string;
  groupId: string;
  contactNumber?: string;
  amountNote?: string;
  paymentNote?: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  displayOrder: number;
  status: "active" | "archived";
  createdAt: string;
}

export interface Lesson {
  id: string;
  subjectId: string;
  title: string;
  description?: string;
  displayOrder: number;
  structureMode: StructureMode;
  status: ContentState;
  publishedAt?: string;
  createdAt: string;
}

export interface LessonPart {
  id: string;
  lessonId: string;
  title: string;
  description?: string;
  displayOrder: number;
  createdAt: string;
}

export interface Asset {
  id: string;
  kind: "video" | "handout" | "submission";
  lessonId?: string;
  lessonPartId?: string;
  submissionId?: string;
  ownerStudentId?: string;
  title: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  state: AssetState;
  createdAt: string;
}

export interface QuizOption {
  id: string;
  text: string;
  displayOrder: number;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  prompt: string;
  points: number;
  displayOrder: number;
  required: boolean;
  options?: QuizOption[];
  correctBoolean?: boolean;
}

export interface Quiz {
  id: string;
  lessonId?: string;
  lessonPartId?: string;
  title: string;
  instructions?: string;
  status: ContentState;
  totalPoints: number;
  hasManualQuestions: boolean;
  firstSubmissionAt?: string;
  createdAt: string;
}

export interface Answer {
  id: string;
  submissionId: string;
  questionId: string;
  selectedOptionId?: string;
  booleanValue?: boolean;
  textValue?: string;
  fileAssetId?: string;
  autoScore?: number;
  manualScore?: number;
  feedback?: string;
}

export interface Submission {
  id: string;
  quizId: string;
  studentId: string;
  status: SubmissionState;
  objectiveScore: number;
  manualScore: number;
  totalScore: number;
  submittedAt: string;
  gradedAt?: string;
  releasedAt?: string;
  resetCount: number;
}

export interface Announcement {
  id: string;
  createdBy: string;
  creatorRole: "admin" | "teacher";
  targetType: "global" | "group";
  groupId?: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaPath?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface DemoDatabase {
  users: UserRecord[];
  credentials: AccessCredential[];
  groups: Group[];
  memberships: GroupMembership[];
  privateRecords: PrivateStudentRecord[];
  subjects: Subject[];
  lessons: Lesson[];
  lessonParts: LessonPart[];
  assets: Asset[];
  quizzes: Quiz[];
  questions: Question[];
  submissions: Submission[];
  answers: Answer[];
  announcements: Announcement[];
}

export interface DashboardSummary {
  announcements: Announcement[];
  counts: Array<{ label: string; value: number; href?: string }>;
  groups: Group[];
  latestLessons: Lesson[];
  pendingSubmissions: Submission[];
  releasedSubmissions: Submission[];
}

export interface GroupDetails {
  group: Group;
  owner?: UserRecord;
  students: UserRecord[];
  subjects: Subject[];
  privateRecords: PrivateStudentRecord[];
}

export interface SubjectDetails {
  subject: Subject;
  group: Group;
  lessons: Lesson[];
}

export interface LessonDetails {
  lesson: Lesson;
  subject: Subject;
  group: Group;
  parts: LessonPart[];
  assets: Asset[];
  quiz?: Quiz;
  partQuizzes: Quiz[];
}

export interface QuizDetails {
  quiz: Quiz;
  questions: Question[];
  lesson: Lesson;
  group: Group;
  existingSubmission?: Submission;
  answers?: Answer[];
}

export interface SubmissionDetails {
  submission: Submission;
  quiz: Quiz;
  student: UserRecord;
  questions: Question[];
  answers: Answer[];
}
