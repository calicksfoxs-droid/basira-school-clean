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
import { AppError, assertAllowed, assertFound } from "@/lib/data/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  fingerprintEnrollmentReference,
  generateEnrollmentReference,
  maskEnrollmentReference,
  normalizeEnrollmentReference,
} from "./enrollment-reference";
import type { LearningCoreStore } from "./contracts";
import { inferSubjectCoverKey, isSubjectCoverKey } from "@/lib/subject-covers";

type Row = Record<string, unknown>;
const optionalString = (value: unknown) => value == null ? undefined : String(value);

function subjectFrom(row: Row): LearningSubject {
  return {
    id: String(row.id), teacherId: String(row.owner_teacher_id), title: String(row.title),
    description: optionalString(row.description), coverKey: isSubjectCoverKey(row.cover_key) ? row.cover_key : undefined,
    bannerTitle: optionalString(row.banner_title),
    bannerBody: optionalString(row.banner_body), bannerCtaLabel: optionalString(row.banner_cta_label),
    bannerCtaPath: optionalString(row.banner_cta_path), status: String(row.status) as LearningSubject["status"],
    displayOrder: Number(row.display_order), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function groupFrom(row: Row): SubjectGroup {
  return {
    id: String(row.id), subjectId: String(row.subject_id), name: String(row.name),
    description: optionalString(row.description), status: String(row.status) as SubjectGroup["status"],
    createdAt: String(row.created_at),
  };
}

function unitFrom(row: Row): SubjectUnit {
  return {
    id: String(row.id), subjectId: String(row.subject_id), title: String(row.title),
    description: optionalString(row.description), displayOrder: Number(row.display_order),
    status: String(row.status) as SubjectUnit["status"], createdAt: String(row.created_at),
  };
}

function lessonFrom(row: Row): UnitLesson {
  return {
    id: String(row.id), unitId: String(row.unit_id), subjectId: String(row.subject_id), title: String(row.title),
    description: optionalString(row.description), displayOrder: Number(row.display_order),
    structureMode: String(row.structure_mode) as UnitLesson["structureMode"],
    status: String(row.status) as UnitLesson["status"], publishedAt: optionalString(row.published_at),
    createdAt: String(row.created_at),
  };
}

function referenceFrom(row: Row): StudentEnrollmentReference {
  return {
    studentId: String(row.student_id), maskedReference: String(row.masked_reference),
    rotatedAt: String(row.rotated_at),
  };
}

function settingsFrom(row: Row): PlatformSettings {
  return {
    platformName: String(row.platform_name), timezone: String(row.timezone),
    maintenanceMessage: optionalString(row.maintenance_message), updatedAt: String(row.updated_at),
    updatedBy: optionalString(row.updated_by),
  };
}

function preferencesFrom(row: Row): UserPreferences {
  return {
    userId: String(row.user_id), theme: String(row.theme) as UserPreferences["theme"],
    reducedMotion: Boolean(row.reduced_motion), locale: "ar", updatedAt: String(row.updated_at),
  };
}

export class SupabaseLearningCoreStore implements LearningCoreStore {
  private async client() { return createServerSupabaseClient(); }
  private admin() { return createAdminSupabaseClient(); }

  private async subjectForWrite(identity: Identity, subjectId: string) {
    assertAllowed(identity.role === "admin" || identity.role === "teacher");
    const client = this.admin();
    const { data, error } = await client.from("subjects")
      .select("id,owner_teacher_id,group_id,status").eq("id", subjectId).single();
    if (error) throw error;
    const subject = data as Row;
    if (identity.role === "teacher") {
      assertAllowed(String(subject.owner_teacher_id) === identity.userId);
    }
    return { client, subject };
  }

  private async unitForWrite(identity: Identity, unitId: string) {
    const client = this.admin();
    const { data, error } = await client.from("subject_units")
      .select("id,subject_id,status").eq("id", unitId).single();
    if (error) throw error;
    const unit = data as Row;
    await this.subjectForWrite(identity, String(unit.subject_id));
    return { client, unit };
  }

  private async lessonForWrite(identity: Identity, lessonId: string) {
    const client = this.admin();
    const { data, error } = await client.from("lessons")
      .select("id,subject_id,unit_id,status").eq("id", lessonId).single();
    if (error) throw error;
    const lesson = data as Row;
    await this.subjectForWrite(identity, String(lesson.subject_id));
    return { client, lesson };
  }

  private async assertSubjectReadable(identity: Identity, subject: Row) {
    assertAllowed(identity.status === "active");
    if (identity.role === "admin") return;
    if (identity.role === "teacher") {
      assertAllowed(String(subject.owner_teacher_id) === identity.userId);
      return;
    }

    const subjectId = String(subject.id);
    const groupId = subject.group_id ? String(subject.group_id) : undefined;
    const status = String(subject.status);
    assertAllowed(groupId ? status === "active" : status === "published");
    const client = this.admin();
    let groupQuery = client.from("groups").select("id").eq("status", "active");
    groupQuery = groupId ? groupQuery.eq("id", groupId) : groupQuery.eq("subject_id", subjectId);
    const { data: groups, error: groupError } = await groupQuery;
    if (groupError) throw groupError;
    const groupIds = ((groups ?? []) as Row[]).map((row) => String(row.id));
    assertAllowed(groupIds.length > 0);
    const { count, error } = await client.from("group_memberships")
      .select("id", { count: "exact", head: true })
      .eq("student_id", identity.userId).eq("status", "active").in("group_id", groupIds);
    if (error) throw error;
    assertAllowed((count ?? 0) > 0);
  }

  async listLearningSubjects(identity: Identity): Promise<LearningSubject[]> {
    assertAllowed(identity.status === "active");
    const client = this.admin();
    const { data, error } = await client.from("subjects").select("*").order("display_order");
    if (error) throw error;
    const visible: LearningSubject[] = [];
    for (const row of (data ?? []) as Row[]) {
      try {
        await this.assertSubjectReadable(identity, row);
        visible.push(subjectFrom(row));
      } catch (error) {
        if (error instanceof AppError && error.code === "FORBIDDEN") continue;
        throw error;
      }
    }
    return visible;
  }

  async getLearningSubject(identity: Identity, subjectId: string): Promise<LearningSubjectDetails> {
    const client = this.admin();
    const [subjectResult, groupResult, unitResult, lessonResult] = await Promise.all([
      client.from("subjects").select("*").eq("id", subjectId).single(),
      client.from("groups").select("*").eq("subject_id", subjectId).order("created_at"),
      client.from("subject_units").select("*").eq("subject_id", subjectId).order("display_order"),
      client.from("lessons").select("*").eq("subject_id", subjectId).order("display_order"),
    ]);
    if (subjectResult.error) throw subjectResult.error;
    await this.assertSubjectReadable(identity, subjectResult.data as Row);
    if (groupResult.error) throw groupResult.error;
    if (unitResult.error) throw unitResult.error;
    if (lessonResult.error) throw lessonResult.error;
    return {
      subject: subjectFrom(subjectResult.data as Row),
      groups: ((groupResult.data ?? []) as Row[]).map(groupFrom),
      units: ((unitResult.data ?? []) as Row[]).map(unitFrom),
      lessons: ((lessonResult.data ?? []) as Row[]).map(lessonFrom),
    };
  }

  async createLearningSubject(identity: Identity, input: { title: string; description?: string }): Promise<LearningSubject> {
    assertAllowed(identity.role === "teacher");
    const client = this.admin();
    const { count, error: countError } = await client.from("subjects")
      .select("id", { count: "exact", head: true }).eq("owner_teacher_id", identity.userId);
    if (countError) throw countError;
    const { data, error } = await client.from("subjects").insert({
      group_id: null, owner_teacher_id: identity.userId, title: input.title.trim(),
      description: input.description?.trim() || null, cover_key: inferSubjectCoverKey(input.title),
      display_order: (count ?? 0) + 1, status: "draft",
    }).select("*").single();
    if (error) throw error;
    return subjectFrom(data as Row);
  }

  async updateSubjectBanner(identity: Identity, input: { subjectId: string; title?: string; body?: string; ctaLabel?: string; ctaPath?: string }): Promise<void> {
    const { client } = await this.subjectForWrite(identity, input.subjectId);
    const { error } = await client.from("subjects").update({
      banner_title: input.title?.trim() || null, banner_body: input.body?.trim() || null,
      banner_cta_label: input.ctaLabel?.trim() || null, banner_cta_path: input.ctaPath?.trim() || null,
    }).eq("id", input.subjectId);
    if (error) throw error;
  }

  async updateSubjectCover(identity: Identity, input: { subjectId: string; coverKey: SubjectCoverKey }): Promise<void> {
    const { client } = await this.subjectForWrite(identity, input.subjectId);
    const { error } = await client.from("subjects").update({ cover_key: input.coverKey }).eq("id", input.subjectId);
    if (error) throw error;
  }

  async createSubjectGroup(identity: Identity, input: { subjectId: string; name: string; description?: string }): Promise<SubjectGroup> {
    const { client, subject } = await this.subjectForWrite(identity, input.subjectId);
    const ownerTeacherId = String((subject as Row).owner_teacher_id);
    const { data, error } = await client.from("groups").insert({
      subject_id: input.subjectId, owner_teacher_id: ownerTeacherId, created_by: identity.userId,
      name: input.name.trim(), description: input.description?.trim() || null, status: "active",
    }).select("*").single();
    if (error) throw error;
    return groupFrom(data as Row);
  }

  async createSubjectUnit(identity: Identity, input: { subjectId: string; title: string; description?: string }): Promise<SubjectUnit> {
    const { client } = await this.subjectForWrite(identity, input.subjectId);
    const { data: last, error: orderError } = await client.from("subject_units")
      .select("display_order").eq("subject_id", input.subjectId)
      .order("display_order", { ascending: false }).limit(1);
    if (orderError) throw orderError;
    const displayOrder = Number(((last ?? []) as Row[])[0]?.display_order ?? 0) + 1;
    const { data, error } = await client.from("subject_units").insert({
      subject_id: input.subjectId, title: input.title.trim(),
      description: input.description?.trim() || null, display_order: displayOrder, status: "draft",
    }).select("*").single();
    if (error) throw error;
    return unitFrom(data as Row);
  }

  async createUnitLesson(identity: Identity, input: { unitId: string; title: string; description?: string; structureMode: "direct" | "parts" }): Promise<UnitLesson> {
    const { client, unit } = await this.unitForWrite(identity, input.unitId);
    const { data: last, error: orderError } = await client.from("lessons")
      .select("display_order").eq("unit_id", input.unitId)
      .order("display_order", { ascending: false }).limit(1);
    if (orderError) throw orderError;
    const displayOrder = Number(((last ?? []) as Row[])[0]?.display_order ?? 0) + 1;
    const { data, error } = await client.from("lessons").insert({
      unit_id: input.unitId, subject_id: String((unit as Row).subject_id), title: input.title.trim(),
      description: input.description?.trim() || null, display_order: displayOrder,
      structure_mode: input.structureMode, status: "draft",
    }).select("*").single();
    if (error) throw error;
    return lessonFrom(data as Row);
  }

  async publishLearningSubject(identity: Identity, subjectId: string): Promise<void> {
    const { client } = await this.subjectForWrite(identity, subjectId);
    const [groups, units] = await Promise.all([
      client.from("groups").select("id", { count: "exact", head: true }).eq("subject_id", subjectId).eq("status", "active"),
      client.from("subject_units").select("id", { count: "exact", head: true }).eq("subject_id", subjectId).eq("status", "published"),
    ]);
    if (groups.error || units.error) throw groups.error ?? units.error;
    assertAllowed((groups.count ?? 0) > 0, "أضف مجموعة نشطة قبل نشر المادة");
    assertAllowed((units.count ?? 0) > 0, "انشر وحدة واحدة على الأقل قبل نشر المادة");
    const { error } = await client.from("subjects").update({ status: "published" }).eq("id", subjectId);
    if (error) throw error;
  }
  async publishSubjectUnit(identity: Identity, unitId: string): Promise<void> {
    const { client } = await this.unitForWrite(identity, unitId);
    const { count, error: countError } = await client.from("lessons").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "published");
    if (countError) throw countError;
    assertAllowed((count ?? 0) > 0, "انشر درسًا واحدًا على الأقل قبل نشر الوحدة");
    const { error } = await client.from("subject_units").update({ status: "published" }).eq("id", unitId);
    if (error) throw error;
  }
  async publishUnitLesson(identity: Identity, lessonId: string): Promise<void> { const { client } = await this.lessonForWrite(identity, lessonId); const { error } = await client.from("lessons").update({ status: "published", published_at: new Date().toISOString() }).eq("id", lessonId); if (error) throw error; }
  async completeLearningLesson(identity: Identity, lessonId: string): Promise<void> { assertAllowed(identity.role === "student"); const client = this.admin(); const { data: lesson, error: lessonError } = await client.from("lessons").select("subject_id,status").eq("id", lessonId).single(); if (lessonError) throw lessonError; assertAllowed(String((lesson as Row).status) === "published"); const { data: subject, error: subjectError } = await client.from("subjects").select("*").eq("id", String((lesson as Row).subject_id)).single(); if (subjectError) throw subjectError; await this.assertSubjectReadable(identity, subject as Row); const { error } = await client.from("learning_progress").upsert({ student_id: identity.userId, subject_id: String((lesson as Row).subject_id), lesson_id: lessonId, completed_at: new Date().toISOString() }, { onConflict: "student_id,lesson_id" }); if (error) throw error; }

  async enrollStudentByReference(_identity: Identity, input: { groupId: string; enrollmentReference: string }): Promise<{ studentId: string; displayName: string }> {
    const client = await this.client();
    const { data, error } = await client.rpc("enroll_student_by_reference_v1", {
      p_group_id: input.groupId, p_reference: normalizeEnrollmentReference(input.enrollmentReference),
    });
    if (error) throw error;
    const row = assertFound(((data ?? []) as Row[])[0]);
    return { studentId: String(row.student_id), displayName: String(row.display_name) };
  }

  async getOwnEnrollmentReference(identity: Identity): Promise<StudentEnrollmentReference> {
    assertAllowed(identity.role === "student");
    const client = await this.client();
    const { data, error } = await client.rpc("get_own_enrollment_reference_v1");
    if (error) throw error;
    return referenceFrom(assertFound(((data ?? []) as Row[])[0]));
  }

  async rotateEnrollmentReference(identity: Identity, studentId: string): Promise<RevealedStudentEnrollmentReference> {
    assertAllowed(identity.role === "admin" || (identity.role === "student" && identity.userId === studentId));
    const reference = generateEnrollmentReference();
    const client = await this.client();
    const { data, error } = await client.rpc("rotate_student_enrollment_reference_v1", {
      p_student_id: studentId, p_fingerprint: fingerprintEnrollmentReference(reference),
      p_masked_reference: maskEnrollmentReference(reference),
    });
    if (error) throw error;
    return { ...referenceFrom(assertFound(((data ?? []) as Row[])[0])), reference };
  }

  async getPlatformSettings(identity: Identity): Promise<PlatformSettings> {
    assertAllowed(identity.status === "active");
    const client = await this.client();
    const { data, error } = await client.from("platform_settings").select("*").single();
    if (error) throw error;
    return settingsFrom(data as Row);
  }

  async updatePlatformSettings(identity: Identity, input: { platformName: string; timezone: string; maintenanceMessage?: string }): Promise<PlatformSettings> {
    assertAllowed(identity.role === "admin");
    const client = await this.client();
    const { data, error } = await client.from("platform_settings").update({
      platform_name: input.platformName.trim(), timezone: input.timezone.trim(),
      maintenance_message: input.maintenanceMessage?.trim() || null, updated_by: identity.userId,
    }).eq("id", "11111111-1111-1111-1111-111111111111").select("*").single();
    if (error) throw error;
    return settingsFrom(data as Row);
  }

  async getUserPreferences(identity: Identity): Promise<UserPreferences> {
    const client = await this.client();
    const { data, error } = await client.from("user_preferences").select("*").eq("user_id", identity.userId).maybeSingle();
    if (error) throw error;
    if (data) return preferencesFrom(data as Row);
    return this.updateUserPreferences(identity, { theme: "system", reducedMotion: false, locale: "ar" });
  }

  async updateUserPreferences(identity: Identity, input: { theme: "light" | "dark" | "system"; reducedMotion: boolean; locale: "ar" }): Promise<UserPreferences> {
    const client = await this.client();
    const { data, error } = await client.from("user_preferences").upsert({
      user_id: identity.userId, theme: input.theme, reduced_motion: input.reducedMotion, locale: input.locale,
    }, { onConflict: "user_id" }).select("*").single();
    if (error) throw error;
    return preferencesFrom(data as Row);
  }

  async getLearningJourney(identity: Identity, subjectId: string): Promise<LearningJourneyNode[]> {
    const client = this.admin();
    const { data: subject, error: subjectError } = await client.from("subjects").select("*").eq("id", subjectId).single();
    if (subjectError) throw subjectError;
    assertFound(subject);
    await this.assertSubjectReadable(identity, subject as Row);
    const [unitsResult, lessonsResult, progressResult] = await Promise.all([
      client.from("subject_units").select("id,display_order").eq("subject_id", subjectId).order("display_order"),
      client.from("lessons").select("id,unit_id,status,display_order").eq("subject_id", subjectId),
      client.from("learning_progress").select("lesson_id").eq("student_id", identity.userId).eq("subject_id", subjectId),
    ]);
    if (unitsResult.error) throw unitsResult.error;
    if (lessonsResult.error) throw lessonsResult.error;
    if (progressResult.error) throw progressResult.error;
    const unitOrder = new Map(((unitsResult.data ?? []) as Row[]).map((row) => [String(row.id), Number(row.display_order)]));
    const completed = new Set(((progressResult.data ?? []) as Row[]).map((row) => String(row.lesson_id)));
    return ((lessonsResult.data ?? []) as Row[])
      .sort((left, right) => (unitOrder.get(String(left.unit_id)) ?? 0) - (unitOrder.get(String(right.unit_id)) ?? 0) ||
        Number(left.display_order) - Number(right.display_order))
      .map((row, index) => ({
        lessonId: String(row.id), unitId: String(row.unit_id), order: index + 1,
        state: completed.has(String(row.id)) ? "completed" : String(row.status) === "published" ? "available" : "locked",
      }));
  }
}
