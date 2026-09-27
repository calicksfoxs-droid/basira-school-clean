import "server-only";
import type { Identity } from "@/domain/models";
import type {
  CurriculumGrade,
  LearningSubject,
  LearningSubjectDetails,
  SubjectUnit,
  UnitLesson,
} from "@/domain/core-models";
import { assertAllowed, assertFound } from "@/lib/data/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inferSubjectCoverKey, isSubjectCoverKey } from "@/lib/subject-covers";
import { SupabaseLearningCoreStore } from "./supabase-learning-core-store";

type Row = Record<string, unknown>;
const optionalString = (value: unknown) => value == null ? undefined : String(value);

function gradeFrom(row: Row): CurriculumGrade {
  return {
    id: String(row.id),
    teacherId: String(row.owner_teacher_id),
    title: String(row.title),
    description: optionalString(row.description),
    displayOrder: Number(row.display_order),
    status: String(row.status) as CurriculumGrade["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function subjectFrom(row: Row): LearningSubject {
  return {
    id: String(row.id),
    teacherId: String(row.owner_teacher_id),
    gradeId: String(row.grade_id),
    title: String(row.title),
    description: optionalString(row.description),
    coverKey: isSubjectCoverKey(row.cover_key) ? row.cover_key : undefined,
    bannerTitle: optionalString(row.banner_title),
    bannerBody: optionalString(row.banner_body),
    bannerCtaLabel: optionalString(row.banner_cta_label),
    bannerCtaPath: optionalString(row.banner_cta_path),
    status: String(row.status) as LearningSubject["status"],
    displayOrder: Number(row.display_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function unitFrom(row: Row): SubjectUnit {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    title: String(row.title),
    description: optionalString(row.description),
    termSegment: Number(row.term_segment) as SubjectUnit["termSegment"],
    coverPath: optionalString(row.cover_path),
    displayOrder: Number(row.display_order),
    status: String(row.status) as SubjectUnit["status"],
    createdAt: String(row.created_at),
  };
}

function lessonFrom(row: Row): UnitLesson {
  return {
    id: String(row.id),
    unitId: String(row.unit_id),
    subjectId: String(row.subject_id),
    title: String(row.title),
    description: optionalString(row.description),
    displayOrder: Number(row.display_order),
    structureMode: String(row.structure_mode) as UnitLesson["structureMode"],
    status: String(row.status) as UnitLesson["status"],
    publishedAt: optionalString(row.published_at),
    createdAt: String(row.created_at),
  };
}

/**
 * Repair-line adapter.
 *
 * The legacy Supabase store remains available for the stable non-student paths,
 * while repaired Core paths move to authenticated RPC/RLS boundaries. This lets
 * us converge the product without a destructive rewrite of the existing store.
 */
export class RepairedSupabaseLearningCoreStore extends SupabaseLearningCoreStore {
  async listLearningSubjects(identity: Identity): Promise<LearningSubject[]> {
    assertAllowed(identity.status === "active");
    if (identity.role !== "student") return super.listLearningSubjects(identity);

    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("list_my_learning_subjects_v1");
    if (error) throw error;
    return ((data ?? []) as Row[]).map(subjectFrom);
  }

  async getLearningSubject(identity: Identity, subjectId: string): Promise<LearningSubjectDetails> {
    if (identity.role !== "student") return super.getLearningSubject(identity, subjectId);
    assertAllowed(identity.status === "active");

    // All three reads run as the authenticated student. RLS, not service-role
    // post-filtering, is the privacy boundary. Group/roster data is intentionally
    // absent from the student projection.
    const client = await createServerSupabaseClient();
    const [subjectResult, unitResult, lessonResult] = await Promise.all([
      client.from("subjects").select("*").eq("id", subjectId).maybeSingle(),
      client.from("subject_units").select("*").eq("subject_id", subjectId).eq("status", "published")
        .order("term_segment").order("display_order"),
      client.from("lessons").select("*").eq("subject_id", subjectId).eq("status", "published")
        .order("display_order"),
    ]);

    if (subjectResult.error) throw subjectResult.error;
    if (unitResult.error) throw unitResult.error;
    if (lessonResult.error) throw lessonResult.error;

    const subjectRow = assertFound(subjectResult.data as Row | null);
    const unitRows = (unitResult.data ?? []) as Row[];
    const visibleUnitIds = new Set(unitRows.map((row) => String(row.id)));
    const lessonRows = ((lessonResult.data ?? []) as Row[])
      .filter((row) => visibleUnitIds.has(String(row.unit_id)));

    return {
      subject: subjectFrom(subjectRow),
      groups: [],
      units: unitRows.map(unitFrom),
      lessons: lessonRows.map(lessonFrom),
    };
  }

  async createCurriculumGrade(
    identity: Identity,
    input: { title: string; description?: string },
  ): Promise<CurriculumGrade> {
    assertAllowed(identity.role === "teacher" && identity.status === "active");
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("create_curriculum_grade_v2", {
      p_title: input.title.trim(),
      p_description: input.description?.trim() || null,
    });
    if (error) throw error;
    return gradeFrom(data as Row);
  }

  async createLearningSubject(
    identity: Identity,
    input: { gradeId: string; title: string; description?: string },
  ): Promise<LearningSubject> {
    assertAllowed(identity.role === "teacher" && identity.status === "active");
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("create_learning_subject_v2", {
      p_grade_id: input.gradeId,
      p_title: input.title.trim(),
      p_description: input.description?.trim() || null,
      p_cover_key: inferSubjectCoverKey(input.title),
    });
    if (error) throw error;
    return subjectFrom(data as Row);
  }

  async createSubjectUnit(
    identity: Identity,
    input: {
      subjectId: string;
      termSegment: 1 | 2 | 3 | 4;
      lessonCount: number;
      title: string;
      description?: string;
    },
  ): Promise<SubjectUnit> {
    assertAllowed(identity.role === "teacher" && identity.status === "active");
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("create_subject_unit_with_lessons_v2", {
      p_subject_id: input.subjectId,
      p_term_segment: input.termSegment,
      p_lesson_count: input.lessonCount,
      p_title: input.title.trim(),
      p_description: input.description?.trim() || null,
    });
    if (error) throw error;
    return unitFrom(data as Row);
  }

  async createUnitLesson(
    identity: Identity,
    input: { unitId: string; title: string; description?: string; structureMode: "direct" | "parts" },
  ): Promise<UnitLesson> {
    assertAllowed(identity.role === "teacher" && identity.status === "active");
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("create_unit_lesson_v2", {
      p_unit_id: input.unitId,
      p_title: input.title.trim(),
      p_description: input.description?.trim() || null,
      p_structure_mode: input.structureMode,
    });
    if (error) throw error;
    return lessonFrom(data as Row);
  }
}
