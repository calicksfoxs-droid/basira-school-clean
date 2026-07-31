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

  const imageFinalized = page.waitForResponse((response) => response.url().endsWith("/api/uploads/finalize") && response.request().method() === "POST");
  await handoutInput.setInputFiles({
    name: "e2e-lesson-image.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  expect((await imageFinalized).ok()).toBe(true);
  await expect(page.getByText("e2e-lesson-image.png", { exact: true })).toBeVisible();

  const aidFinalized = page.waitForResponse((response) => response.url().endsWith("/api/uploads/finalize") && response.request().method() === "POST");
  await page.locator('input[accept*="application/pdf"]').nth(1).setInputFiles({ name: "e2e-aid.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nE2E aid\n") });
  expect((await aidFinalized).ok()).toBe(true);
  await expect(page.getByText("e2e-aid.pdf", { exact: true })).toBeVisible();

  const publishLessonForm = page.locator("form").filter({ has: page.locator('input[name="lessonId"]') });
  await publishLessonForm.getByRole("button").click();
  await expect(publishLessonForm.getByRole("button")).toBeDisabled();
  await page.goto(subjectUrl);
  await expect(page.getByText(lessonTitle, { exact: true })).toBeVisible();
});

test("teacher finance notes stay in the browser and are absent from admin", async ({ page }) => {
  await loginAsTeacher(page);
  await page.goto("/app/teacher/students");

  const amountInput = page.getByLabel("المبلغ / الحالة");
  const noteInput = page.getByLabel("ملاحظة مالية خاصة");
  await expect(amountInput).toBeVisible();
  await expect(amountInput).not.toHaveAttribute("name");
  await expect(noteInput).not.toHaveAttribute("name");

  await page.getByLabel("اسم الطالب").fill("طالب مالية محلية");
  await page.getByLabel("المجموعة").selectOption({ index: 1 });
  await amountInput.fill("مدفوع بالكامل");
  await noteInput.fill("لا تُرسل إلى الخادم");
  await page.getByRole("button", { name: "إنشاء الطالب وإصدار الرمز" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const localDatabase = await page.evaluate(() => window.localStorage.getItem("basira:teacher-finance:v1:00000000-0000-4000-8000-000000000002"));
  expect(localDatabase).toContain("مدفوع بالكامل");
  expect(localDatabase).toContain("لا تُرسل إلى الخادم");
});

test("admin never sees teacher-only finance fields", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="code"]').fill("BSR-ADMN-DEMO2026");
  await page.locator("form").getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/admin$/);
  await page.goto("/app/admin/students");
  await expect(page.getByLabel("المبلغ / الحالة")).toHaveCount(0);
  await expect(page.getByLabel("ملاحظة مالية خاصة")).toHaveCount(0);
});
