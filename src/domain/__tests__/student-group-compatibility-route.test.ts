import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function read(relative: string) {
  return readFile(path.join(process.cwd(), relative), "utf8");
}

describe("student group compatibility routes", () => {
  it.each([
    "src/app/app/student/groups/page.tsx",
    "src/app/app/student/groups/[id]/page.tsx",
  ])("redirects %s to the Learning Core subject surface", async (file) => {
    const source = await read(file);
    expect(source).toContain('requireRole("student")');
    expect(source).toContain('redirect("/app/student/subjects")');
    expect(source).not.toContain("GroupDetailsView");
    expect(source).not.toContain("GroupGrid");
    expect(source).not.toContain("getGroup(");
    expect(source).not.toContain("listGroups(");
  });
});
