import "server-only";

import type { CurriculumGrade, LearningJourneyNode, LearningSubject, UnitLesson } from "@/domain/core-models";
import type { DashboardSummary, Identity, Lesson } from "@/domain/models";
import { getLearningCoreStore } from "@/lib/core";
import { getStore } from "@/lib/data";

export interface CanonicalDashboardData {
  summary: DashboardSummary;
  subjects: LearningSubject[];
  grades: CurriculumGrade[];
  journey: LearningJourneyNode[];
}

function dashboardLesson(lesson: UnitLesson): Lesson {
  return {
    id: lesson.id,
    subjectId: lesson.subjectId,
    unitId: lesson.unitId,
    title: lesson.title,
    description: lesson.description,
    displayOrder: lesson.displayOrder,
    structureMode: lesson.structureMode,
    status: lesson.status,
    publishedAt: lesson.publishedAt,
    createdAt: lesson.createdAt,
  };
}

function lessonTimestamp(lesson: Lesson) {
  return lesson.publishedAt ?? lesson.createdAt;
}

/**
 * Builds every role dashboard from the canonical Learning Core graph.
 *
 * Legacy group-first dashboard reads are intentionally not used here. A student
 * dashboard is derived only from subjects already proven readable by Learning
 * Core RLS/access rules, so peer/group metadata never becomes part of the
 * student projection.
 */
export async function getCanonicalDashboardData(identity: Identity): Promise<CanonicalDashboardData> {
  const core = getLearningCoreStore();
  const store = await getStore();

  const [subjects, grades, announcements, submissions] = await Promise.all([
    core.listLearningSubjects(identity),
    core.listCurriculumGrades(identity),
    store.listAnnouncements(identity),
    store.listSubmissions(identity),
  ]);

  const subjectDetails = await Promise.all(
    subjects.map((subject) => core.getLearningSubject(identity, subject.id)),
  );
  const allLessons = subjectDetails
    .flatMap((details) => details.lessons)
    .map(dashboardLesson)
    .sort((left, right) => lessonTimestamp(right).localeCompare(lessonTimestamp(left)));

  const publishedLessonCount = allLessons.filter((lesson) => lesson.status === "published").length;
  const releasedSubmissions = identity.role === "student"
    ? submissions.filter((submission) => submission.status === "released")
    : [];
  const pendingSubmissions = identity.role === "teacher"
    ? submissions.filter((submission) => submission.status === "pending_review")
    : [];

  let counts: DashboardSummary["counts"];
  if (identity.role === "admin") {
    const [teachers, students] = await Promise.all([
      store.listUsers(identity, "teacher"),
      store.listUsers(identity, "student"),
    ]);
    counts = [
      { label: "المعلمون", value: teachers.length, href: "/app/admin/teachers" },
      { label: "الطلاب", value: students.length, href: "/app/admin/students" },
      { label: "المواد", value: subjects.length, href: "/app/admin/subjects" },
      { label: "الدروس المنشورة", value: publishedLessonCount },
    ];
  } else if (identity.role === "teacher") {
    const students = (await store.listUsers(identity, "student")).filter((student) => student.status === "active");
    counts = [
      { label: "طلابي", value: students.length, href: "/app/teacher/students" },
      { label: "المواد", value: subjects.length, href: "/app/teacher/subjects" },
      { label: "الدروس المنشورة", value: publishedLessonCount },
      { label: "الصفوف", value: grades.length, href: "/app/teacher/grades" },
    ];
  } else {
    counts = [
      { label: "موادي", value: subjects.length, href: "/app/student/subjects" },
      { label: "الدروس المتاحة", value: publishedLessonCount, href: "/app/student/subjects" },
      { label: "نتائجي", value: releasedSubmissions.length, href: "/app/student/results" },
    ];
  }

  const journey = identity.role === "student" && subjects[0]
    ? await core.getLearningJourney(identity, subjects[0].id)
    : [];
  const availableLessonId = identity.role === "student"
    ? journey.find((node) => node.state === "available")?.lessonId
    : undefined;
  const dashboardLessons = availableLessonId
    ? [...allLessons].sort((left, right) => {
        if (left.id === availableLessonId) return -1;
        if (right.id === availableLessonId) return 1;
        return lessonTimestamp(right).localeCompare(lessonTimestamp(left));
      })
    : allLessons;

  return {
    subjects,
    grades,
    journey,
    summary: {
      announcements: announcements.slice(0, 5),
      counts,
      // Dashboard consumers no longer receive the legacy Group projection.
      groups: [],
      latestLessons: dashboardLessons,
      pendingSubmissions,
      releasedSubmissions,
    },
  };
}
