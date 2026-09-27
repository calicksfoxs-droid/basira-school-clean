import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function repairedStore() {
  return readFile(path.join(process.cwd(), "src/lib/core/repaired-supabase-learning-core-store.ts"), "utf8");
}

async function subjectView() {
  return readFile(path.join(process.cwd(), "src/components/learning/learning-subject-view.tsx"), "utf8");
}

describe("student isolation repair contract", () => {
  it("enumerates student subjects through the authenticated RLS projection", async () => {
    const source = await repairedStore();
    expect(source).toContain('client.rpc("list_my_learning_subjects_v1")');
    expect(source).toContain("createServerSupabaseClient");
    expect(source).toContain('if (identity.role !== "student") return super.listLearningSubjects(identity)');
  });

  it("never returns a student group roster surface from subject details", async () => {
    const source = await repairedStore();
    expect(source).toContain("groups: []");
    expect(source).not.toContain('client.from("group_memberships")');
    expect(source).not.toContain('client.from("profiles")');
  });

  it("does not display group metadata in the student subject summary", async () => {
    const source = await subjectView();
    expect(source).toContain("{!isStudent &&");
    expect(source).not.toContain('identity.role === "student" ? "مجموعات مرتبطة"');
    expect(source).toContain("الدروس المتاحة الآن");
  });
});
