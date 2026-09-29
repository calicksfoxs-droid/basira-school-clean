import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

const rolePages = [
  "src/app/app/student/page.tsx",
  "src/app/app/teacher/page.tsx",
  "src/app/app/admin/page.tsx",
];

describe("canonical dashboard projection", () => {
  it("routes all role home pages through the Learning Core dashboard builder", async () => {
    for (const file of rolePages) {
      const source = await read(file);
      expect(source).toContain("getCanonicalDashboardData");
      expect(source).not.toContain("getDashboard(");
      expect(source).not.toContain("getStore");
      expect(source).not.toContain("getLearningCoreStore");
    }
  });

  it("does not reconstruct dashboard subjects through the legacy group-first graph", async () => {
    const source = await read("src/lib/dashboard/canonical-dashboard.ts");
    expect(source).toContain("core.listLearningSubjects(identity)");
    expect(source).toContain("core.getLearningSubject(identity, subject.id)");
    expect(source).toContain("groups: []");
    expect(source).not.toContain("listGroups(");
    expect(source).not.toContain("subjects.group_id");
    expect(source).not.toContain('.from("subjects").select("id").in("group_id"');
  });

  it("keeps the student dashboard peer/group-free and follows journey availability", async () => {
    const [page, dashboard] = await Promise.all([
      read("src/app/app/student/page.tsx"),
      read("src/lib/dashboard/canonical-dashboard.ts"),
    ]);
    expect(page).not.toContain("مجموعة");
    expect(page).not.toContain("group");
    expect(dashboard).toContain('node.state === "available"');
    expect(dashboard).toContain("availableLessonId");
  });
});
