import { expect, test, type Page } from "@playwright/test";

const teacherCode = "BSR-TCHR-DEMO2026";

async function loginAsTeacher(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="code"]').fill(teacherCode);
  await page.locator("form").getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/teacher$/);
}

test("teacher can create a subject and reach its authoring workspace", async ({ page }) => {
  await loginAsTeacher(page);
  await page.goto("/app/teacher/subjects");

  const title = "E2E Subject Creation";
  await page.locator('input[name="title"]').fill(title);
  await page.locator('form').filter({ has: page.locator('input[name="title"]') }).getByRole("button").click();

  await expect(page).toHaveURL(/\/app\/teacher\/subjects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("teacher can build a unit, group, lesson, and attach a PDF", async ({ page }) => {
  await loginAsTeacher(page);
  await page.goto("/app/teacher/subjects");

  const subjectTitle = "E2E Complete Authoring";
  await page.locator('input[name="title"]').fill(subjectTitle);
  await page.locator("form").filter({ has: page.locator('input[name="title"]') }).getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/teacher\/subjects\/[0-9a-f-]{36}$/);
  const subjectUrl = page.url();

  const unitTitle = "E2E Unit";
  const unitForm = page.locator("form").filter({ has: page.locator('input[name="title"][required]') });
  await unitForm.locator('input[name="title"]').fill(unitTitle);
  await unitForm.getByRole("button").click();
  await expect(page.getByText(unitTitle, { exact: true })).toBeVisible();

  const groupTitle = "E2E Group";
  const groupForm = page.locator("form").filter({ has: page.locator('input[name="name"]') });
  await groupForm.locator('input[name="name"]').fill(groupTitle);
  await groupForm.getByRole("button").click();
  await expect(page.getByRole("heading", { name: groupTitle })).toBeVisible();

  const lessonTitle = "E2E Lesson";
  const lessonForm = page.locator("form").filter({ has: page.locator('input[name="unitId"]') }).filter({ has: page.locator('input[name="title"]') });
  await lessonForm.locator('input[name="title"]').fill(lessonTitle);
  await lessonForm.getByRole("button").click();
  await expect(page.getByText(lessonTitle, { exact: true })).toBeVisible();

  await page.locator('a[href^="/app/teacher/lessons/"]').click();
  await expect(page).toHaveURL(/\/app\/teacher\/lessons\/[0-9a-f-]+\/edit$/);

  const finalized = page.waitForResponse((response) => response.url().endsWith("/api/uploads/finalize") && response.request().method() === "POST");
  await page.locator('input[accept="application/pdf"]').setInputFiles({
    name: "e2e-handout.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nE2E learning handout\n"),
  });
  expect((await finalized).ok()).toBe(true);
  await expect(page.getByText("e2e-handout.pdf", { exact: true })).toBeVisible();

  const publishLessonForm = page.locator("form").filter({ has: page.locator('input[name="lessonId"]') });
  await publishLessonForm.getByRole("button").click();
  await expect(publishLessonForm.getByRole("button")).toBeDisabled();
  await page.goto(subjectUrl);
  await expect(page.getByText(lessonTitle, { exact: true })).toBeVisible();
});
