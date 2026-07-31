import "server-only";
import { randomUUID } from "node:crypto";
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
  Question,
  Quiz,
  QuizDetails,
  Role,
  Subject,
  SubjectDetails,
  Submission,
  SubmissionDetails,
  UserRecord,
  Answer,
} from "@/domain/models";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateAccessCode } from "@/lib/demo/demo-db";
import { assertAllowed, assertFound, AppError } from "./errors";
import type { BasiraStore, CreateQuestionInput, CreatedAccessCode, CreateUserInput, SubmitAnswerInput } from "./contracts";

function iso() { return new Date().toISOString(); }
function mapRole(value: string): Role { return value === "school_admin" ? "admin" : value as Role; }
function userFrom(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    role: mapRole(String(row.role)),
    status: String(row.status) as "active" | "disabled",
    syntheticEmail: row.synthetic_email ? String(row.synthetic_email) : undefined,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: String(row.created_at),
  };
}
function groupFrom(row: Record<string, unknown>): Group {
  return { id: String(row.id), name: String(row.name), ownerTeacherId: String(row.owner_teacher_id), status: String(row.status) as Group["status"], description: row.description ? String(row.description) : undefined, createdBy: String(row.created_by), createdAt: String(row.created_at) };
}
function subjectFrom(row: Record<string, unknown>): Subject {
  return { id: String(row.id), groupId: row.group_id ? String(row.group_id) : undefined, ownerTeacherId: row.owner_teacher_id ? String(row.owner_teacher_id) : undefined, title: String(row.title), description: row.description ? String(row.description) : undefined, displayOrder: Number(row.display_order), status: String(row.status) as Subject["status"], createdAt: String(row.created_at) };
}
function lessonFrom(row: Record<string, unknown>): Lesson {
  return { id: String(row.id), subjectId: String(row.subject_id), unitId: row.unit_id ? String(row.unit_id) : undefined, title: String(row.title), description: row.description ? String(row.description) : undefined, displayOrder: Number(row.display_order), structureMode: String(row.structure_mode) as Lesson["structureMode"], status: String(row.status) as Lesson["status"], publishedAt: row.published_at ? String(row.published_at) : undefined, createdAt: String(row.created_at) };
}
function assetFrom(row: Record<string, unknown>): Asset {
  return { id: String(row.id), kind: String(row.kind) as Asset["kind"], lessonId: row.lesson_id ? String(row.lesson_id) : undefined, lessonPartId: row.lesson_part_id ? String(row.lesson_part_id) : undefined, submissionId: row.submission_id ? String(row.submission_id) : undefined, ownerStudentId: row.owner_student_id ? String(row.owner_student_id) : undefined, title: String(row.title), storagePath: String(row.storage_path), originalFilename: String(row.original_filename), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), state: String(row.state) as Asset["state"], createdAt: String(row.created_at) };
}
function quizFrom(row: Record<string, unknown>): Quiz {
  return { id: String(row.id), lessonId: row.lesson_id ? String(row.lesson_id) : undefined, lessonPartId: row.lesson_part_id ? String(row.lesson_part_id) : undefined, title: String(row.title), instructions: row.instructions ? String(row.instructions) : undefined, status: String(row.status) as Quiz["status"], totalPoints: Number(row.total_points), hasManualQuestions: Boolean(row.has_manual_questions), firstSubmissionAt: row.first_submission_at ? String(row.first_submission_at) : undefined, createdAt: String(row.created_at) };
}
function submissionFrom(row: Record<string, unknown>): Submission {
  return { id: String(row.id), quizId: String(row.quiz_id), studentId: String(row.student_id), status: String(row.status) as Submission["status"], objectiveScore: Number(row.objective_score), manualScore: Number(row.manual_score), totalScore: Number(row.total_score), submittedAt: String(row.submitted_at), gradedAt: row.graded_at ? String(row.graded_at) : undefined, releasedAt: row.released_at ? String(row.released_at) : undefined, resetCount: Number(row.reset_count ?? 0) };
}

export class SupabaseStore implements BasiraStore {
  private async client() { return createServerSupabaseClient(); }
  private admin() { return createAdminSupabaseClient(); }

  private async groupForWrite(identity: Identity, groupId: string) {
    assertAllowed(identity.role === "admin" || identity.role === "teacher");
    const client = this.admin();
    const { data, error } = await client.from("groups").select("*").eq("id", groupId).single();
    if (error) throw error;
    const group = groupFrom(data as Record<string, unknown>);
    if (identity.role === "teacher") assertAllowed(group.ownerTeacherId === identity.userId);
    return { client, group };
  }

  private async subjectForAccess(identity: Identity, subjectId: string) {
    const client = this.admin();
    const { data, error } = await client.from("subjects").select("*").eq("id", subjectId).single();
    if (error) throw error;
    const subject = subjectFrom(data as Record<string, unknown>);
    if (identity.role === "teacher") {
      assertAllowed(subject.ownerTeacherId === identity.userId);
    } else if (identity.role === "student") {
      assertAllowed(subject.status === "active" || subject.status === "published");
      let groupQuery = client.from("groups").select("id").eq("status", "active");
      groupQuery = subject.groupId ? groupQuery.eq("id", subject.groupId) : groupQuery.eq("subject_id", subject.id);
      const { data: groups, error: groupError } = await groupQuery;
      if (groupError) throw groupError;
      const groupIds = ((groups ?? []) as Array<Record<string, unknown>>).map((row) => String(row.id));
      assertAllowed(groupIds.length > 0);
      const { count, error: membershipError } = await client.from("group_memberships")
        .select("id", { count: "exact", head: true }).eq("student_id", identity.userId)
        .eq("status", "active").in("group_id", groupIds);
      if (membershipError) throw membershipError;
      assertAllowed((count ?? 0) > 0);
    }
    return { client, subject };
  }

  async getDashboard(identity: Identity): Promise<DashboardSummary> {
    const groups = await this.listGroups(identity);
    const announcements = (await this.listAnnouncements(identity)).slice(0, 5);
    const groupIds = groups.map((g) => g.id);
    const client = await this.client();
    const { data: subjectsData } = groupIds.length ? await client.from("subjects").select("id").in("group_id", groupIds) : { data: [] };
    const subjectIds = ((subjectsData ?? []) as Array<Record<string, unknown>>).map((r) => String(r.id));
    const { data: lessonsData } = subjectIds.length ? await client.from("lessons").select("*").in("subject_id", subjectIds).order("created_at", { ascending: false }).limit(5) : { data: [] };
    const latestLessons = ((lessonsData ?? []) as Array<Record<string, unknown>>).map(lessonFrom).filter((l) => identity.role !== "student" || l.status === "published");
    const submissions = await this.listSubmissions(identity);
    const pendingSubmissions = identity.role === "teacher" ? submissions.filter((s) => s.status === "pending_review") : [];
    const releasedSubmissions = identity.role === "student" ? submissions.filter((s) => s.status === "released") : [];
    let counts: DashboardSummary["counts"];
    if (identity.role === "admin") {
      const [teachers, students, allGroups, published] = await Promise.all([
        client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
        client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        client.from("groups").select("id", { count: "exact", head: true }),
        client.from("lessons").select("id", { count: "exact", head: true }).eq("status", "published"),
      ]);
      counts = [
        { label: "المعلمون", value: teachers.count ?? 0, href: "/app/admin/teachers" },
        { label: "الطلاب", value: students.count ?? 0, href: "/app/admin/students" },
        { label: "المجموعات", value: allGroups.count ?? 0, href: "/app/admin/groups" },
        { label: "الدروس المنشورة", value: published.count ?? 0 },
      ];
    } else if (identity.role === "teacher") {
      const details = await Promise.all(groups.map((g) => this.getGroup(identity, g.id)));
      counts = [
        { label: "مجموعاتي", value: groups.length, href: "/app/teacher/groups" },
        { label: "طلابي", value: new Set(details.flatMap((d) => d.students.map((s) => s.id))).size, href: "/app/teacher/students" },
        { label: "الدروس", value: latestLessons.length },
        { label: "قيد التصحيح", value: pendingSubmissions.length, href: "/app/teacher/submissions" },
      ];
    } else {
      counts = [
        { label: "مجموعاتي", value: groups.length, href: "/app/student/groups" },
        { label: "الدروس الجديدة", value: latestLessons.length },
        { label: "نتائجي", value: releasedSubmissions.length, href: "/app/student/results" },
      ];
    }
    return { announcements, counts, groups, latestLessons, pendingSubmissions, releasedSubmissions };
  }

  async listUsers(identity: Identity, role?: Role): Promise<UserRecord[]> {
    const client = await this.client();
    if (identity.role === "admin") {
      let query = client.from("profiles").select("*").order("created_at", { ascending: false });
      if (role) query = query.eq("role", role === "admin" ? "admin" : role);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map(userFrom);
    }
    if (identity.role === "student") {
      const { data, error } = await client.from("profiles").select("*").eq("id", identity.userId).single();
      if (error) throw error;
      return [userFrom(data as Record<string, unknown>)];
    }
    const { data: memberships, error: membershipError } = await client.from("group_memberships").select("student_id, groups!inner(owner_teacher_id)").eq("groups.owner_teacher_id", identity.userId).eq("status", "active");
    if (membershipError) throw membershipError;
    const ids = Array.from(new Set(((memberships ?? []) as Array<Record<string, unknown>>).map((r) => String(r.student_id))));
    if (!ids.length) return [];
    const { data, error } = await client.from("profiles").select("*").in("id", ids).eq("role", "student");
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(userFrom);
  }

  async createTeacher(identity: Identity, input: CreateUserInput): Promise<CreatedAccessCode> {
    assertAllowed(identity.role === "admin");
    return this.createAccount(identity, "teacher", input);
  }

  async createStudent(identity: Identity, input: CreateUserInput): Promise<CreatedAccessCode> {
    assertAllowed(identity.role === "admin" || identity.role === "teacher");
    if (identity.role === "teacher") {
      assertAllowed(Boolean(input.groupId), "اختر مجموعة");
      await this.getGroup(identity, assertFound(input.groupId));
    }
    const created = await this.createAccount(identity, "student", input);
    if (input.groupId) {
      await this.addStudentToGroup(identity, input.groupId, created.user.id);
      if (identity.role === "teacher") await this.upsertPrivateRecord(identity, { studentId: created.user.id, groupId: input.groupId, contactNumber: input.contactNumber });
    }
    return created;
  }

  private async createAccount(identity: Identity, role: Role, input: CreateUserInput): Promise<CreatedAccessCode> {
    const generated = generateAccessCode();
    const syntheticEmail = `basira.${generated.publicRef.toLowerCase()}@access.invalid`;
    const admin = this.admin();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email: syntheticEmail, password: generated.secret, email_confirm: true, user_metadata: { display_name: input.displayName, role } });
    if (authError || !authData.user) throw authError ?? new Error("تعذر إنشاء مستخدم Auth");
    const userId = authData.user.id;
    const profile = { id: userId, display_name: input.displayName, role, status: "active", created_by: identity.userId, session_invalid_before: iso() };
    const { error: profileError } = await admin.from("profiles").insert(profile);
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      throw profileError;
    }
    const { error: credentialError } = await admin.from("access_credentials").insert({ auth_user_id: userId, public_account_ref: generated.publicRef, synthetic_email: syntheticEmail, role, state: "unused", code_hint: `BSR-${generated.publicRef}-••••••••`, issued_by: identity.userId });
    if (credentialError) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      throw credentialError;
    }
    return { user: { id: userId, displayName: input.displayName, role, status: "active", syntheticEmail, createdBy: identity.userId, createdAt: iso() }, code: generated.code };
  }

  async resetAccessCode(identity: Identity, userId: string): Promise<CreatedAccessCode> {
    const users = await this.listUsers(identity);
    const user = assertFound(users.find((item) => item.id === userId));
    if (identity.role === "teacher") assertAllowed(user.role === "student");
    else assertAllowed(identity.role === "admin");

    const generated = generateAccessCode();
    const syntheticEmail = `basira.${generated.publicRef.toLowerCase()}@access.invalid`;
    const admin = this.admin();
    const timestamp = iso();
    const { data: previousCredentials, error: previousError } = await admin
      .from("access_credentials")
      .select("id,state,disabled_at")
      .eq("auth_user_id", userId)
      .neq("state", "disabled");
    if (previousError) throw previousError;

    const { error: profileError } = await admin.from("profiles").update({ session_invalid_before: timestamp }).eq("id", userId);
    if (profileError) throw profileError;

    const { error: disableError } = await admin.from("access_credentials")
      .update({ state: "disabled", disabled_at: timestamp })
      .eq("auth_user_id", userId).neq("state", "disabled");
    if (disableError) throw disableError;
    const { data: newCredential, error: credentialError } = await admin.from("access_credentials").insert({
      auth_user_id: userId,
      public_account_ref: generated.publicRef,
      synthetic_email: syntheticEmail,
      role: user.role,
      state: "unused",
      code_hint: `BSR-${generated.publicRef}-••••••••`,
      issued_by: identity.userId,
      last_reset_at: timestamp,
    }).select("id").single();
    if (credentialError) {
      for (const previous of previousCredentials ?? []) {
        await admin.from("access_credentials").update({ state: previous.state, disabled_at: previous.disabled_at }).eq("id", previous.id);
      }
      throw credentialError;
    }

    const { error: authError } = await admin.auth.admin.updateUserById(userId, { email: syntheticEmail, password: generated.secret, email_confirm: true });
    if (authError) {
      await admin.from("access_credentials").delete().eq("id", newCredential.id);
      for (const previous of previousCredentials ?? []) {
        await admin.from("access_credentials").update({ state: previous.state, disabled_at: previous.disabled_at }).eq("id", previous.id);
      }
      throw authError;
    }
    return { user: { ...user, syntheticEmail, sessionInvalidBefore: timestamp }, code: generated.code };
  }

  async disableUser(identity: Identity, userId: string) {
    const users = await this.listUsers(identity);
    const user = assertFound(users.find((u) => u.id === userId));
    if (identity.role === "teacher") assertAllowed(user.role === "student");
    else assertAllowed(identity.role === "admin");
    const admin = this.admin();
    const timestamp = iso();
    const { error } = await admin.from("profiles").update({ status: "disabled", session_invalid_before: timestamp }).eq("id", userId);
    if (error) throw error;
    await admin.from("access_credentials").update({ state: "disabled", disabled_at: timestamp }).eq("auth_user_id", userId);
  }

  async listGroups(identity: Identity): Promise<Group[]> {
    void identity;
    const client = await this.client();
    const { data, error } = await client.from("groups").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(groupFrom);
  }

  async getGroup(identity: Identity, groupId: string): Promise<GroupDetails> {
    const client = await this.client();
    const { data: groupData, error: groupError } = await client.from("groups").select("*").eq("id", groupId).single();
    if (groupError) throw groupError;
    const group = groupFrom(groupData as Record<string, unknown>);
    const [ownerRes, membershipRes, subjectRes, privateRes] = await Promise.all([
      identity.role === "student" ? Promise.resolve({ data: null, error: null }) : client.from("profiles").select("id,display_name,role,status,created_by,created_at").eq("id", group.ownerTeacherId).maybeSingle(),
      client.from("group_memberships").select("student_id").eq("group_id", groupId).eq("status", "active"),
      client.from("subjects").select("*").eq("group_id", groupId).order("display_order"),
      identity.role === "teacher"
        ? client.from("teacher_student_private_records").select("id,teacher_id,student_id,group_id,contact_number,updated_at").eq("group_id", groupId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (ownerRes.error || membershipRes.error || subjectRes.error || privateRes.error) throw ownerRes.error ?? membershipRes.error ?? subjectRes.error ?? privateRes.error;
    const studentIds = ((membershipRes.data ?? []) as Array<Record<string, unknown>>).map((r) => String(r.student_id));
    const { data: studentData, error: studentError } = studentIds.length ? await client.from("profiles").select("*").in("id", studentIds) : { data: [], error: null };
    if (studentError) throw studentError;
    return {
      group,
      owner: ownerRes.data ? userFrom(ownerRes.data as Record<string, unknown>) : undefined,
      students: ((studentData ?? []) as Array<Record<string, unknown>>).map(userFrom),
      subjects: ((subjectRes.data ?? []) as Array<Record<string, unknown>>).map(subjectFrom),
      privateRecords: ((privateRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), teacherId: String(row.teacher_id), studentId: String(row.student_id), groupId: String(row.group_id), contactNumber: row.contact_number ? String(row.contact_number) : undefined, updatedAt: String(row.updated_at) })),
    };
  }

  async createGroup(identity: Identity, input: { name: string; description?: string; ownerTeacherId?: string }): Promise<Group> {
    assertAllowed(identity.role === "admin" || identity.role === "teacher");
    const ownerTeacherId = identity.role === "teacher" ? identity.userId : input.ownerTeacherId;
    assertAllowed(Boolean(ownerTeacherId), "اختر المعلم المسؤول");
    const client = this.admin();
    const { data: owner, error: ownerError } = await client.from("profiles")
      .select("id").eq("id", ownerTeacherId).eq("role", "teacher").eq("status", "active").maybeSingle();
    if (ownerError) throw ownerError;
    assertFound(owner, "المعلم المسؤول غير متاح");
    const { data, error } = await client.from("groups").insert({ name: input.name, description: input.description || null, owner_teacher_id: ownerTeacherId, status: "active", created_by: identity.userId }).select("*").single();
    if (error) throw error;
    return groupFrom(data as Record<string, unknown>);
  }

  async transferGroup(identity: Identity, groupId: string, ownerTeacherId: string) {
    assertAllowed(identity.role === "admin");
    const client = await this.client();
    const { error } = await client.from("groups").update({ owner_teacher_id: ownerTeacherId }).eq("id", groupId);
    if (error) throw error;
  }

  async addStudentToGroup(identity: Identity, groupId: string, studentId: string) {
    const { client } = await this.groupForWrite(identity, groupId);
    const { error } = await client.from("group_memberships").upsert({ group_id: groupId, student_id: studentId, status: "active" }, { onConflict: "group_id,student_id" });
    if (error) throw error;
  }

  async upsertPrivateRecord(identity: Identity, input: Omit<PrivateStudentRecord, "id" | "teacherId" | "updatedAt">) {
    const { client, group } = await this.groupForWrite(identity, input.groupId);
    const teacherId = identity.role === "teacher" ? identity.userId : group.ownerTeacherId;
    const { error } = await client.from("teacher_student_private_records").upsert({ teacher_id: teacherId, student_id: input.studentId, group_id: input.groupId, contact_number: input.contactNumber || null }, { onConflict: "teacher_id,student_id,group_id" });
    if (error) throw error;
  }

  async createSubject(identity: Identity, input: { groupId: string; title: string; description?: string }): Promise<Subject> {
    assertAllowed(identity.role === "teacher");
    const { client, group } = await this.groupForWrite(identity, input.groupId);
    const { count } = await client.from("subjects").select("id", { count: "exact", head: true }).eq("group_id", input.groupId);
    const { data, error } = await client.from("subjects").insert({ group_id: input.groupId, owner_teacher_id: group.ownerTeacherId, title: input.title, description: input.description || null, display_order: (count ?? 0) + 1, status: "active" }).select("*").single();
    if (error) throw error;
    return subjectFrom(data as Record<string, unknown>);
  }

  async getSubject(identity: Identity, subjectId: string): Promise<SubjectDetails> {
    const { client, subject } = await this.subjectForAccess(identity, subjectId);
    const groupResult = subject.groupId
      ? await client.from("groups").select("*").eq("id", subject.groupId).single()
      : { data: null, error: null };
    const { data: lessonsData, error: lessonError } = await client.from("lessons").select("*").eq("subject_id", subjectId).order("display_order");
    if (groupResult.error || lessonError) throw groupResult.error ?? lessonError;
    return { subject, group: groupResult.data ? groupFrom(groupResult.data as Record<string, unknown>) : undefined, lessons: ((lessonsData ?? []) as Array<Record<string, unknown>>).map(lessonFrom) };
  }

  async createLesson(identity: Identity, input: { subjectId: string; title: string; description?: string; structureMode: "direct" | "parts" }): Promise<Lesson> {
    assertAllowed(identity.role === "teacher");
    const { client } = await this.subjectForAccess(identity, input.subjectId);
    const { count } = await client.from("lessons").select("id", { count: "exact", head: true }).eq("subject_id", input.subjectId);
    const { data, error } = await client.from("lessons").insert({ subject_id: input.subjectId, title: input.title, description: input.description || null, structure_mode: input.structureMode, display_order: (count ?? 0) + 1, status: "draft" }).select("*").single();
    if (error) throw error;
    return lessonFrom(data as Record<string, unknown>);
  }

  async createLessonPart(identity: Identity, input: { lessonId: string; title: string; description?: string }) {
    assertAllowed(identity.role === "teacher");
    const details = await this.getLesson(identity, input.lessonId);
    assertAllowed(details.lesson.structureMode === "parts", "هذا الدرس لا يستخدم الأجزاء");
    assertAllowed(details.lesson.status === "draft", "لا يمكن إضافة جزء بعد نشر الدرس");
    const client = this.admin();
    const { count } = await client.from("lesson_parts").select("id", { count: "exact", head: true }).eq("lesson_id", input.lessonId);
    const { data, error } = await client.from("lesson_parts").insert({ lesson_id: input.lessonId, title: input.title, description: input.description || null, display_order: (count ?? 0) + 1 }).select("*").single();
    if (error) throw error;
    const row = data as Record<string, unknown>;
    return { id: String(row.id), lessonId: String(row.lesson_id), title: String(row.title), description: row.description ? String(row.description) : undefined, displayOrder: Number(row.display_order), createdAt: String(row.created_at) };
  }

  async getLesson(identity: Identity, lessonId: string): Promise<LessonDetails> {
    const client = this.admin();
    const { data: lessonData, error } = await client.from("lessons").select("*").eq("id", lessonId).single();
    if (error) throw error;
    const lesson = lessonFrom(lessonData as Record<string, unknown>);
    const subjectDetails = await this.getSubject(identity, lesson.subjectId);
    const partsResult = await client.from("lesson_parts").select("*").eq("lesson_id", lessonId).order("display_order");
    if (partsResult.error) throw partsResult.error;
    const parts = ((partsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), lessonId: String(row.lesson_id), title: String(row.title), description: row.description ? String(row.description) : undefined,
      displayOrder: Number(row.display_order), createdAt: String(row.created_at),
    }));
    const partIds = parts.map((part) => part.id);
    const directAssets = await client.from("lesson_assets").select("*").eq("lesson_id", lessonId).neq("state", "removed");
    const partAssets = partIds.length
      ? await client.from("lesson_assets").select("*").in("lesson_part_id", partIds).neq("state", "removed")
      : { data: [], error: null };
    const directQuiz = await client.from("quizzes").select("*").eq("lesson_id", lessonId).maybeSingle();
    const partQuizResult = partIds.length
      ? await client.from("quizzes").select("*").in("lesson_part_id", partIds)
      : { data: [], error: null };
    if (directAssets.error || partAssets.error || directQuiz.error || partQuizResult.error) {
      throw directAssets.error ?? partAssets.error ?? directQuiz.error ?? partQuizResult.error;
    }
    return {
      lesson,
      subject: subjectDetails.subject,
      group: subjectDetails.group,
      parts,
      assets: [...((directAssets.data ?? []) as Array<Record<string, unknown>>), ...((partAssets.data ?? []) as Array<Record<string, unknown>>)].map(assetFrom),
      quiz: directQuiz.data ? quizFrom(directQuiz.data as Record<string, unknown>) : undefined,
      partQuizzes: ((partQuizResult.data ?? []) as Array<Record<string, unknown>>).map(quizFrom),
    };
  }

  async publishLesson(identity: Identity, lessonId: string) {
    assertAllowed(identity.role === "teacher");
    const details = await this.getLesson(identity, lessonId);
    const directHasContent = details.assets.some((asset) => asset.lessonId === lessonId && asset.state === "ready") || details.quiz?.status === "published";
    if (details.lesson.structureMode === "direct") {
      assertAllowed(details.parts.length === 0, "لا يمكن خلط المحتوى المباشر مع الأجزاء");
      assertAllowed(Boolean(directHasContent), "أضف فيديو أو ملزمة أو اختبارًا منشورًا أولًا");
    } else {
      assertAllowed(!directHasContent, "لا يمكن خلط المحتوى المباشر مع الأجزاء");
      assertAllowed(details.parts.length > 0, "أضف جزءًا واحدًا على الأقل");
      for (const part of details.parts) {
        const hasContent = details.assets.some((asset) => asset.lessonPartId === part.id && asset.state === "ready") || details.partQuizzes.some((quiz) => quiz.lessonPartId === part.id && quiz.status === "published");
        assertAllowed(hasContent, `أضف محتوى جاهزًا إلى الجزء: ${part.title}`);
      }
    }
    const client = this.admin();
    const { error } = await client.from("lessons").update({ status: "published", published_at: iso() }).eq("id", lessonId);
    if (error) throw error;
  }

  async attachAsset(identity: Identity, input: Omit<Asset, "id" | "createdAt" | "state"> & { state?: Asset["state"] }): Promise<Asset> {
    assertAllowed(identity.role === "teacher");
    assertAllowed(input.kind === "video" || input.kind === "handout" || input.kind === "aid");
    const client = await this.client();
    const { data, error } = await client.rpc("finalize_lesson_asset_phase13a", {
      p_kind: input.kind,
      p_lesson_id: input.lessonId ?? null,
      p_lesson_part_id: input.lessonPartId ?? null,
      p_title: input.title,
      p_storage_path: input.storagePath,
      p_original_filename: input.originalFilename,
      p_mime_type: input.mimeType,
      p_size_bytes: input.sizeBytes,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new AppError("تعذر اعتماد الملف", "ASSET_FINALIZE_FAILED");
    return assetFrom(row as Record<string, unknown>);
  }

  async getAsset(identity: Identity, assetId: string): Promise<Asset> {
    const client = await this.client();
    const { data, error } = await client.from("lesson_assets").select("*").eq("id", assetId).eq("state", "ready").single();
    if (error) throw error;
    return assetFrom(data as Record<string, unknown>);
  }

  async createQuiz(identity: Identity, input: { lessonId?: string; lessonPartId?: string; title: string; instructions?: string; questions: CreateQuestionInput[] }): Promise<string> {
    assertAllowed(identity.role === "teacher");
    const client = await this.client();
    let parentLessonId = input.lessonId;
    if (input.lessonPartId) {
      const { data: partData, error: partError } = await client.from("lesson_parts").select("lesson_id").eq("id", input.lessonPartId).single();
      if (partError) throw partError;
      parentLessonId = String((partData as Record<string, unknown>).lesson_id);
    }
    const details = await this.getLesson(identity, assertFound(parentLessonId));
    assertAllowed((details.lesson.structureMode === "direct" && Boolean(input.lessonId) && !input.lessonPartId) || (details.lesson.structureMode === "parts" && Boolean(input.lessonPartId) && !input.lessonId), "بنية الدرس لا تطابق مكان الاختبار");

    const admin = this.admin();
    const quizId = randomUUID();
    const questionRows = input.questions.map((question, index) => ({ id: randomUUID(), quiz_id: quizId, type: question.type, prompt: question.prompt, points: question.points, display_order: index + 1, required: true }));
    try {
      const { error: quizError } = await admin.from("quizzes").insert({ id: quizId, lesson_id: input.lessonId ?? null, lesson_part_id: input.lessonPartId ?? null, title: input.title, instructions: input.instructions || null, status: "published", total_points: input.questions.reduce((sum, question) => sum + question.points, 0), has_manual_questions: input.questions.some((question) => question.type.startsWith("essay_")) });
      if (quizError) throw quizError;
      const { error: questionError } = await admin.from("quiz_questions").insert(questionRows);
      if (questionError) throw questionError;
      const optionRows: Array<Record<string, unknown>> = [];
      const questionAnswerRows: Array<Record<string, unknown>> = [];
      const optionAnswerRows: Array<Record<string, unknown>> = [];
      input.questions.forEach((question, questionIndex) => {
        const questionId = questionRows[questionIndex].id;
        if (question.type === "true_false") questionAnswerRows.push({ question_id: questionId, correct_boolean: question.correctBoolean });
        question.options?.forEach((option, optionIndex) => {
          const optionId = randomUUID();
          optionRows.push({ id: optionId, question_id: questionId, text: option.text, display_order: optionIndex + 1 });
          if (option.isCorrect) optionAnswerRows.push({ question_id: questionId, option_id: optionId });
        });
      });
      if (optionRows.length) { const { error } = await admin.from("quiz_options").insert(optionRows); if (error) throw error; }
      if (questionAnswerRows.length) { const { error } = await admin.from("quiz_question_answers").insert(questionAnswerRows); if (error) throw error; }
      if (optionAnswerRows.length) { const { error } = await admin.from("quiz_option_answers").insert(optionAnswerRows); if (error) throw error; }
      return quizId;
    } catch (error) {
      await admin.from("quizzes").delete().eq("id", quizId);
      throw error;
    }
  }

  async getQuiz(identity: Identity, quizId: string): Promise<QuizDetails> {
    const client = await this.client();
    const { data: quizData, error } = await client.from("quizzes").select("*").eq("id", quizId).single();
    if (error) throw error;
    const quiz = quizFrom(quizData as Record<string, unknown>);
    let quizLessonId = quiz.lessonId;
    if (!quizLessonId && quiz.lessonPartId) {
      const { data: partData, error: partError } = await client.from("lesson_parts").select("lesson_id").eq("id", quiz.lessonPartId).single();
      if (partError) throw partError;
      quizLessonId = String((partData as Record<string, unknown>).lesson_id);
    }
    const lessonDetails = await this.getLesson(identity, assertFound(quizLessonId));

    const questionsResult = await client.from("quiz_questions").select("*").eq("quiz_id", quizId).order("display_order");
    if (questionsResult.error) throw questionsResult.error;
    const questionRows = (questionsResult.data ?? []) as Array<Record<string, unknown>>;
    const questionIds = questionRows.map((row) => String(row.id));

    const optionsResult = questionIds.length
      ? await client.from("quiz_options").select("*").in("question_id", questionIds).order("display_order")
      : { data: [], error: null };
    if (optionsResult.error) throw optionsResult.error;

    const studentAdmin = identity.role === "student" ? this.admin() : null;
    const submissionResult = studentAdmin
      ? await studentAdmin.from("quiz_submissions").select("*").eq("quiz_id", quizId).eq("student_id", identity.userId).neq("status", "void").maybeSingle()
      : { data: null, error: null };
    if (submissionResult.error) throw submissionResult.error;
    const existingSubmission = submissionResult.data ? submissionFrom(submissionResult.data as Record<string, unknown>) : undefined;
    const revealAnswers = identity.role !== "student" || existingSubmission?.status === "released";
    const privileged = revealAnswers ? this.admin() : null;

    const [questionAnswerResult, optionAnswerResult] = privileged && questionIds.length
      ? await Promise.all([
          privileged.from("quiz_question_answers").select("question_id,correct_boolean").in("question_id", questionIds),
          privileged.from("quiz_option_answers").select("question_id,option_id").in("question_id", questionIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (questionAnswerResult.error || optionAnswerResult.error) throw questionAnswerResult.error ?? optionAnswerResult.error;

    const optionRows = (optionsResult.data ?? []) as Array<Record<string, unknown>>;
    const correctOptionIds = new Set(((optionAnswerResult.data ?? []) as Array<Record<string, unknown>>).map((row) => String(row.option_id)));
    const booleanMap = new Map(((questionAnswerResult.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.question_id), Boolean(row.correct_boolean)]));
    const questions: Question[] = questionRows.map((row) => ({
      id: String(row.id),
      quizId,
      type: String(row.type) as Question["type"],
      prompt: String(row.prompt),
      points: Number(row.points),
      displayOrder: Number(row.display_order),
      required: Boolean(row.required),
      correctBoolean: booleanMap.get(String(row.id)),
      options: optionRows
        .filter((option) => String(option.question_id) === String(row.id))
        .map((option) => ({
          id: String(option.id),
          text: String(option.text),
          displayOrder: Number(option.display_order),
          isCorrect: revealAnswers ? correctOptionIds.has(String(option.id)) : undefined,
        })),
    }));

    const answerClient = identity.role === "student" ? this.admin() : client;
    const answerResult = existingSubmission
      ? await answerClient.from("quiz_answers").select("*").eq("submission_id", existingSubmission.id)
      : { data: [], error: null };
    if (answerResult.error) throw answerResult.error;
    const answers = ((answerResult.data ?? []) as Array<Record<string, unknown>>).map((row): Answer => ({
      id: String(row.id),
      submissionId: String(row.submission_id),
      questionId: String(row.question_id),
      selectedOptionId: row.selected_option_id ? String(row.selected_option_id) : undefined,
      booleanValue: typeof row.boolean_value === "boolean" ? row.boolean_value : undefined,
      textValue: row.text_value ? String(row.text_value) : undefined,
      fileAssetId: row.file_asset_id ? String(row.file_asset_id) : undefined,
      autoScore: revealAnswers ? Number(row.auto_score ?? 0) : undefined,
      manualScore: revealAnswers && row.manual_score != null ? Number(row.manual_score) : undefined,
      feedback: revealAnswers && row.feedback ? String(row.feedback) : undefined,
    }));

    const safeSubmission = identity.role === "student" && existingSubmission && existingSubmission.status !== "released"
      ? { ...existingSubmission, objectiveScore: 0, manualScore: 0, totalScore: 0 }
      : existingSubmission;
    return { quiz, questions, lesson: lessonDetails.lesson, group: lessonDetails.group, existingSubmission: safeSubmission, answers };
  }

  async submitQuiz(identity: Identity, quizId: string, answers: SubmitAnswerInput[]): Promise<string> {
    assertAllowed(identity.role === "student");
    const client = await this.client();
    const { data, error } = await client.rpc("submit_quiz_phase13a", { p_quiz_id: quizId, p_answers: answers });
    if (error) throw error;
    if (!data) throw new AppError("تعذر حفظ التسليم", "SUBMISSION_FAILED");
    return String(data);
  }


  async attachSubmissionFile(identity: Identity, submissionId: string, questionId: string, input: { storagePath: string; originalFilename: string; mimeType: string; sizeBytes: number; bytes?: Uint8Array }): Promise<Asset> {
    assertAllowed(identity.role === "student");
    if (!input.bytes) throw new AppError("بيانات الملف غير متاحة", "FILE_MISSING");
    const admin = this.admin();
    const { data: submissionData, error: submissionError } = await admin.from("quiz_submissions").select("quiz_id, student_id, status").eq("id", submissionId).single();
    if (submissionError) throw submissionError;
    const submissionRow = submissionData as Record<string, unknown>;
    assertAllowed(String(submissionRow.student_id) === identity.userId && String(submissionRow.status) !== "void");
    const { data: questionData, error: questionError } = await admin.from("quiz_questions").select("id, quiz_id, type").eq("id", questionId).single();
    if (questionError) throw questionError;
    const questionRow = questionData as Record<string, unknown>;
    assertAllowed(String(questionRow.quiz_id) === String(submissionRow.quiz_id) && String(questionRow.type) === "essay_file");
    const { error: uploadError } = await admin.storage.from("submission-files").upload(input.storagePath, input.bytes, { contentType: input.mimeType, upsert: false });
    if (uploadError) throw uploadError;
    const { data: assetData, error: assetError } = await admin.from("lesson_assets").insert({ kind: "submission", submission_id: submissionId, owner_student_id: identity.userId, title: input.originalFilename, storage_path: input.storagePath, original_filename: input.originalFilename, mime_type: input.mimeType, size_bytes: input.sizeBytes, state: "ready" }).select("*").single();
    if (assetError) { await admin.storage.from("submission-files").remove([input.storagePath]); throw assetError; }
    const asset = assetFrom(assetData as Record<string, unknown>);
    const { error: answerError } = await admin.from("quiz_answers").update({ file_asset_id: asset.id }).eq("submission_id", submissionId).eq("question_id", questionId);
    if (answerError) {
      await admin.from("lesson_assets").delete().eq("id", asset.id);
      await admin.storage.from("submission-files").remove([input.storagePath]);
      throw answerError;
    }
    return asset;
  }

  async voidSubmission(identity: Identity, submissionId: string) {
    assertAllowed(identity.role === "student");
    const admin = this.admin();
    const { data, error: readError } = await admin.from("quiz_submissions").select("student_id,status").eq("id", submissionId).single();
    if (readError) throw readError;
    const row = data as Record<string, unknown>;
    assertAllowed(String(row.student_id) === identity.userId);
    assertAllowed(String(row.status) !== "released", "لا يمكن إلغاء نتيجة صادرة");
    const { data: assetRows, error: assetReadError } = await admin.from("lesson_assets").select("id,storage_path").eq("submission_id", submissionId);
    if (assetReadError) throw assetReadError;
    const { error } = await admin.from("quiz_submissions").update({ status: "void" }).eq("id", submissionId);
    if (error) throw error;
    await admin.from("quiz_answers").delete().eq("submission_id", submissionId);
    const assets = (assetRows ?? []) as Array<Record<string, unknown>>;
    if (assets.length) {
      await admin.from("lesson_assets").delete().in("id", assets.map((asset) => String(asset.id)));
      await admin.storage.from("submission-files").remove(assets.map((asset) => String(asset.storage_path))).catch(() => undefined);
    }
  }

  async listSubmissions(identity: Identity): Promise<Submission[]> {
    const client = identity.role === "student" ? this.admin() : await this.client();
    let query = client.from("quiz_submissions").select("*").order("submitted_at", { ascending: false });
    if (identity.role === "student") query = query.eq("student_id", identity.userId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const submission = submissionFrom(row);
      return identity.role === "student" && submission.status !== "released"
        ? { ...submission, objectiveScore: 0, manualScore: 0, totalScore: 0 }
        : submission;
    });
  }

  async getSubmission(identity: Identity, submissionId: string): Promise<SubmissionDetails> {
    const client = await this.client();
    const submissionClient = identity.role === "student" ? this.admin() : client;
    let submissionQuery = submissionClient.from("quiz_submissions").select("*").eq("id", submissionId);
    if (identity.role === "student") submissionQuery = submissionQuery.eq("student_id", identity.userId);
    const { data: submissionData, error } = await submissionQuery.single();
    if (error) throw error;
    const rawSubmission = submissionFrom(submissionData as Record<string, unknown>);
    const reveal = identity.role !== "student" || rawSubmission.status === "released";
    const submission = identity.role === "student" && !reveal
      ? { ...rawSubmission, objectiveScore: 0, manualScore: 0, totalScore: 0 }
      : rawSubmission;

    const quizDetails = await this.getQuiz(identity, rawSubmission.quizId);
    const studentClient = identity.role === "student" ? this.admin() : client;
    const { data: studentData, error: studentError } = await studentClient.from("profiles").select("*").eq("id", rawSubmission.studentId).single();
    const answerClient = identity.role === "student" ? this.admin() : client;
    const { data: answerData, error: answerError } = await answerClient.from("quiz_answers").select("*").eq("submission_id", submissionId);
    if (studentError || answerError) throw studentError ?? answerError;
    const answers = ((answerData ?? []) as Array<Record<string, unknown>>).map((row): Answer => ({
      id: String(row.id),
      submissionId: String(row.submission_id),
      questionId: String(row.question_id),
      selectedOptionId: row.selected_option_id ? String(row.selected_option_id) : undefined,
      booleanValue: typeof row.boolean_value === "boolean" ? row.boolean_value : undefined,
      textValue: row.text_value ? String(row.text_value) : undefined,
      fileAssetId: row.file_asset_id ? String(row.file_asset_id) : undefined,
      autoScore: reveal ? Number(row.auto_score ?? 0) : undefined,
      manualScore: reveal && row.manual_score != null ? Number(row.manual_score) : undefined,
      feedback: reveal && row.feedback ? String(row.feedback) : undefined,
    }));
    return {
      submission,
      quiz: quizDetails.quiz,
      student: userFrom(studentData as Record<string, unknown>),
      questions: quizDetails.questions,
      answers,
    };
  }

  async gradeSubmission(identity: Identity, submissionId: string, scores: Record<string, number>, feedback: Record<string, string>, release: boolean) {
    assertAllowed(identity.role === "teacher");
    const client = await this.client();
    const { error } = await client.rpc("grade_submission_phase13a", { p_submission_id: submissionId, p_scores: scores, p_feedback: feedback, p_release: release });
    if (error) throw error;
  }

  async listAnnouncements(identity: Identity): Promise<Announcement[]> {
    void identity;
    const client = await this.client();
    const { data, error } = await client.from("announcements").select("*").eq("is_active", true).order("display_order").limit(5);
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({ id: String(r.id), createdBy: String(r.created_by), creatorRole: String(r.creator_role) as Announcement["creatorRole"], targetType: String(r.target_type) as Announcement["targetType"], groupId: r.group_id ? String(r.group_id) : undefined, title: String(r.title), body: String(r.body), ctaLabel: r.cta_label ? String(r.cta_label) : undefined, ctaPath: r.cta_path ? String(r.cta_path) : undefined, isActive: Boolean(r.is_active), displayOrder: Number(r.display_order), createdAt: String(r.created_at) }));
  }

  async createAnnouncement(identity: Identity, input: Omit<Announcement, "id" | "createdBy" | "creatorRole" | "isActive" | "displayOrder" | "createdAt">): Promise<Announcement> {
    assertAllowed(identity.role === "admin" || identity.role === "teacher");
    const client = await this.client();
    const { count } = await client.from("announcements").select("id", { count: "exact", head: true });
    const { data, error } = await client.from("announcements").insert({ created_by: identity.userId, creator_role: identity.role, target_type: input.targetType, group_id: input.groupId || null, title: input.title, body: input.body, cta_label: input.ctaLabel || null, cta_path: input.ctaPath || null, is_active: true, display_order: (count ?? 0) + 1 }).select("*").single();
    if (error) throw error;
    const r = data as Record<string, unknown>;
    return { id: String(r.id), createdBy: String(r.created_by), creatorRole: String(r.creator_role) as Announcement["creatorRole"], targetType: String(r.target_type) as Announcement["targetType"], groupId: r.group_id ? String(r.group_id) : undefined, title: String(r.title), body: String(r.body), ctaLabel: r.cta_label ? String(r.cta_label) : undefined, ctaPath: r.cta_path ? String(r.cta_path) : undefined, isActive: Boolean(r.is_active), displayOrder: Number(r.display_order), createdAt: String(r.created_at) };
  }
}
