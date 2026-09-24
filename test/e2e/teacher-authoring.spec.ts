import { expect, test, type Page } from "@playwright/test";

const teacherCode = "BSR-TCHR-DEMO2026";
const seededGradeId = "10000000-0000-4000-8000-000000000001";

async function loginAsTeacher(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="code"]').fill(teacherCode);
  await page.locator("form").getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/teacher$/);
}

test("teacher can create a subject and reach its authoring workspace", async ({ page }) => {
  await loginAsTeacher(page);
  await page.goto(`/app/teacher/grades/${seededGradeId}`);

  const title = "E2E Subject Creation";
  await page.locator('input[name="title"]').fill(title);
  await page.locator('form').filter({ has: page.locator('input[name="title"]') }).getByRole("button").click();

  await expect(page).toHaveURL(/\/app\/teacher\/subjects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("teacher gets a relevant cover automatically and can replace it persistently", async ({ page }) => {
  await loginAsTeacher(page);
  await page.goto(`/app/teacher/grades/${seededGradeId}`);

  await page.locator('input[name="title"]').fill("الكيمياء المتقدمة");
  await page.locator("form").filter({ has: page.locator('input[name="title"]') }).getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/teacher\/subjects\/[0-9a-f-]{36}$/);

  const hero = page.getByTestId("subject-hero-cover");
  await expect(hero).toHaveAttribute("src", /subject-chemistry-v1\.webp/);
  await page.getByRole("button", { name: "تخصيص المظهر" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText("الأحياء", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /الأحياء/ })).toBeChecked();
  await page.getByRole("button", { name: "حفظ الغلاف", exact: true }).click();
  await expect(page.getByText("تم حفظ غلاف المادة وظهر للطلاب")).toBeVisible();
  await expect(hero).toHaveAttribute("src", /subject-biology-v1\.webp/);

  await page.reload();
  await expect(page.getByTestId("subject-hero-cover")).toHaveAttribute("src", /subject-biology-v1\.webp/);
  await page.getByRole("button", { name: "تخصيص المظهر" }).click();
  await expect(page.getByRole("radio", { name: /الأحياء/ })).toBeChecked();
});

test("teacher can build a unit, group, lesson, and attach a PDF", async ({ page }) => {
  test.setTimeout(60_000);
  await loginAsTeacher(page);
  await page.goto(`/app/teacher/grades/${seededGradeId}`);

  const subjectTitle = "E2E Complete Authoring";
  await page.locator('input[name="title"]').fill(subjectTitle);
  await page.locator("form").filter({ has: page.locator('input[name="title"]') }).getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/teacher\/subjects\/[0-9a-f-]{36}$/);
  const subjectUrl = page.url();

  const unitTitle = "E2E Unit";
  await page.getByText("إضافة وحدة", { exact: true }).first().click();
  const unitForm = page.locator("form").filter({ has: page.locator('input[name="termSegment"]') }).first();
  await unitForm.locator('input[name="title"]').fill(unitTitle);
  await unitForm.getByRole("button").click();
  await expect(page.getByText(unitTitle, { exact: true })).toBeVisible();
  const unitCard = page.getByRole("article").filter({ hasText: unitTitle });
  const coverUploaded = page.waitForResponse((response) => response.url().includes("/api/unit-covers/") && response.request().method() === "POST");
  await unitCard.locator('input[type="file"]').setInputFiles({ name: "unit-cover.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  expect((await coverUploaded).ok()).toBe(true);
  await expect(unitCard.locator('img[src*="/api/unit-covers/"]')).toBeVisible();

  const groupTitle = "E2E Group";
  await page.getByRole("button", { name: "مجموعة جديدة", exact: true }).click();
  const panel = page.getByRole("dialog");
  const groupForm = panel.locator("form").filter({ has: page.locator('input[name="name"]') });
  await groupForm.locator('input[name="name"]').fill(groupTitle);
  await groupForm.getByRole("button").click();
  await expect(panel.getByText("تم إنشاء المجموعة")).toBeVisible();
  await panel.getByRole("button", { name: "إغلاق اللوحة" }).click();
  await expect(page.getByRole("heading", { name: groupTitle })).toBeVisible();

  const lessonTitle = "E2E Lesson";
  const lessonForm = page.getByRole("article").filter({ hasText: unitTitle }).locator("form").filter({ has: page.locator('input[name="title"]') });
  await lessonForm.locator('input[name="title"]').fill(lessonTitle);
  await lessonForm.getByRole("button", { name: "إضافة درس" }).click();
  await expect(page.getByText(lessonTitle, { exact: true })).toBeVisible();

  await page.locator('a[href^="/app/teacher/lessons/"]').click();
  await expect(page).toHaveURL(/\/app\/teacher\/lessons\/[0-9a-f-]+\/edit$/);
  await page.getByText("أدوات رفع محتوى الدرس", { exact: true }).click();

  const finalized = page.waitForResponse((response) => response.url().endsWith("/api/uploads/finalize") && response.request().method() === "POST");
  const handoutInput = page.locator('input[accept*="application/pdf"]').first();
  await handoutInput.setInputFiles({
    name: "e2e-handout.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nE2E learning handout\n"),
  });
  expect((await finalized).ok()).toBe(true);
  await expect(page.getByText("e2e-handout.pdf", { exact: true })).toBeVisible();

  await expect(page.locator('input[accept*="application/pdf"]')).toHaveCount(1);
  const rejectedImage = page.waitForResponse((response) =>
    response.url().endsWith("/api/uploads/authorize") &&
    response.request().method() === "POST" &&
    response.status() === 400,
  );
  await handoutInput.setInputFiles({
    name: "e2e-lesson-image.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  expect((await rejectedImage).ok()).toBe(false);
  await expect(page.getByText("الملزمة يجب أن تكون PDF", { exact: true })).toBeVisible();
  await expect(page.getByText("e2e-lesson-image.png", { exact: true })).toHaveCount(0);

  const publishLessonForm = page.locator("form").filter({ has: page.locator('input[name="lessonId"]') });
  await publishLessonForm.getByRole("button").click();
  await expect(publishLessonForm.getByRole("button")).toBeDisabled();
  await page.goto(subjectUrl);
  await expect(page.getByText(lessonTitle, { exact: true })).toBeVisible();
});

test("Core 1.0 student creation hides deferred contact and finance fields", async ({ page }) => {
  await loginAsTeacher(page);
  await page.goto("/app/teacher/students");

  const createStudentForm = page.locator("form").filter({ has: page.getByLabel("اسم الطالب") });
  await expect(createStudentForm.getByLabel("اسم الطالب")).toBeVisible();
  await expect(createStudentForm.getByLabel("المجموعة")).toBeVisible();
  await expect(page.getByLabel("رقم التواصل")).toHaveCount(0);
  await expect(page.getByLabel("المبلغ / الحالة")).toHaveCount(0);
  await expect(page.getByLabel("ملاحظة مالية خاصة")).toHaveCount(0);
});
