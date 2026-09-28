import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function accountsAction() {
  return readFile(path.join(process.cwd(), "src/actions/accounts.ts"), "utf8");
}

describe("legacy student action compatibility boundary", () => {
  it("keeps student identity creation admin-only and enrollment-free", async () => {
    const source = await accountsAction();
    const start = source.indexOf("export async function createStudentAction");
    const end = source.indexOf("export type CreateStudentRevealState");
    const legacyAction = source.slice(start, end);
    expect(legacyAction).toContain('requireRole("admin")');
    expect(legacyAction).not.toContain('requireRole("admin", "teacher")');
    expect(legacyAction).not.toContain('formText(formData, "groupId")');
    expect(legacyAction).not.toContain('formText(formData, "contactNumber")');
  });

  it("applies the same identity-only rule to the reveal action", async () => {
    const source = await accountsAction();
    const start = source.indexOf("export async function createStudentWithRevealAction");
    const end = source.indexOf("export async function resetAccessCodeAction");
    const revealAction = source.slice(start, end);
    expect(revealAction).toContain('requireRole("admin")');
    expect(revealAction).not.toContain('requireRole("admin", "teacher")');
    expect(revealAction).not.toContain('formText(formData, "groupId")');
    expect(revealAction).not.toContain('formText(formData, "contactNumber")');
  });
});
