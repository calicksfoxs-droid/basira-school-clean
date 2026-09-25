import { expect, test, type Page } from "@playwright/test";

const teacherCode = "BSR-TCHR-DEMO2026";
const seededGradeId = "10000000-0000-4000-8000-000000000001";

async function loginAsTeacher(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="code"]').fill(teacherCode);
  await page.locator("form").getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/teacher$/);
}

async function loginAsStudent(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="code"]').fill("BSR-STDN-DEMO2026");
  await page.locator("form").getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/student$/);
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
  const validPdf = (() => {
    const stream = "BT /F1 12 Tf 20 180 Td (E2E handout) Tj ET\n";
    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
      `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (const object of objects) {
      offsets.push(pdf.length);
      pdf += object;
    }
    const xrefOffset = pdf.length;
    pdf += "xref\n0 6\n0000000000 65535 f \n";
    for (const offset of offsets) {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "latin1");
  })();
  await handoutInput.setInputFiles({
    name: "e2e-handout.pdf",
    mimeType: "application/pdf",
    buffer: validPdf,
  });
  expect((await finalized).ok()).toBe(true);
  await expect(page.getByText("e2e-handout.pdf", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "قراءة الملزمة", exact: true }).click();
  const readerFrame = page.locator('iframe[title="قراءة e2e-handout.pdf"]');
  await expect(readerFrame).toBeVisible();
  await expect(readerFrame).toHaveAttribute("src", /^blob:/);
  if (process.env.BASIRA_QA_OUTPUT) await page.screenshot({ path: `${process.env.BASIRA_QA_OUTPUT}/teacher-pdf-reader.png`, fullPage: true });
  await page.getByRole("button", { name: "إغلاق القراءة", exact: true }).click();
  await expect(readerFrame).toHaveCount(0);

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
  await expect(page.getByRole("main").getByText("الملزمة يجب أن تكون PDF", { exact: true })).toBeVisible();
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


test("Core 1.0 objective quiz auto-releases and remains single-attempt", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsTeacher(page);
  await page.goto(`/app/teacher/grades/${seededGradeId}`);

  const subjectTitle = "E2E Objective Assessment";
  await page.locator('input[name="title"]').fill(subjectTitle);
  await page.locator("form").filter({ has: page.locator('input[name="title"]') }).getByRole("button").click();
  await expect(page).toHaveURL(/\/app\/teacher\/subjects\/[0-9a-f-]{36}$/);
  const subjectUrl = page.url();

  const groupTitle = "E2E Objective Group";
  await page.getByRole("button", { name: "مجموعة جديدة", exact: true }).click();
  let panel = page.getByRole("dialog");
  await panel.getByLabel("اسم المجموعة").fill(groupTitle);
  await panel.getByRole("button", { name: "إنشاء المجموعة" }).click();
  await expect(panel.getByText("تم إنشاء المجموعة", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "إغلاق اللوحة" }).click();

  await page.getByRole("button", { name: "تسجيل طالب", exact: true }).click();
  panel = page.getByRole("dialog");
  await panel.getByLabel("المجموعة").selectOption({ label: groupTitle });
  await panel.getByLabel("معرّف الانضمام").fill("BSR-S-ABCDEFGHJKLM");
  await panel.getByRole("button", { name: "إضافة الطالب للمجموعة" }).click();
  await expect(panel.getByText("تمت إضافة الطالب", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "إغلاق اللوحة" }).click();

  const unitCard = page.getByRole("article").first();
  const lessonTitle = "E2E Objective Lesson";
  const lessonForm = unitCard.locator("form").filter({ has: page.locator('input[name="title"]') });
  await lessonForm.locator('input[name="title"]').fill(lessonTitle);
  await lessonForm.getByRole("button", { name: "إضافة درس" }).click();
  await expect(unitCard.getByText(lessonTitle, { exact: true })).toBeVisible();

  await unitCard.locator('a[href^="/app/teacher/lessons/"]').filter({ hasText: lessonTitle }).click();
  await expect(page).toHaveURL(/\/app\/teacher\/lessons\/[0-9a-f-]+\/edit$/);
  const lessonEditUrl = page.url();
  await page.getByText("أدوات رفع محتوى الدرس", { exact: true }).click();
  await page.getByRole("link", { name: "إنشاء اختبار" }).click();

  const quizTitle = "E2E Objective Quiz";
  await page.getByLabel("عنوان الاختبار").fill(quizTitle);
  await page.getByLabel("تعليمات قصيرة").fill("اختبار موضوعي تلقائي");
  await page.getByLabel("نص السؤال").first().fill("2 + 2 = ?");
  const optionInputs = page.getByRole("textbox", { name: /الخيار/ });
  await optionInputs.nth(0).fill("4");
  await optionInputs.nth(1).fill("5");

  await page.getByRole("button", { name: "سؤال جديد" }).click();
  await page.getByLabel("النوع").nth(1).selectOption("true_false");
  await page.getByLabel("نص السؤال").nth(1).fill("الماء يتجمد عند صفر درجة مئوية");
  await page.getByRole("button", { name: "حفظ ونشر الاختبار" }).click();
  await expect(page).toHaveURL(/\/app\/teacher\/quizzes\/[0-9a-f-]+\/edit$/);
  const quizId = page.url().match(/\/quizzes\/([0-9a-f-]+)\/edit$/)?.[1];
  expect(quizId).toBeTruthy();

  await page.goto(lessonEditUrl);
  await page.getByRole("button", { name: "نشر الدرس" }).click();
  await expect(page.getByRole("button", { name: "الدرس منشور" })).toBeDisabled();

  await page.goto(subjectUrl);
  const publishedUnitCard = page.getByRole("article").filter({ hasText: lessonTitle });
  await publishedUnitCard.getByRole("button", { name: "نشر الوحدة" }).click();
  await expect(publishedUnitCard.getByText("وحدة منشورة", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "نشر المادة للطلاب" }).click();
  await expect(page.getByText("مادة منشورة", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginAsStudent(page);

  await page.goto(`/app/student/quizzes/${quizId}`);
  await expect(page.getByRole("heading", { name: quizTitle })).toBeVisible();
  await page.locator("label").filter({ hasText: /^4$/ }).click();
  await page.locator("label").filter({ hasText: /^صح$/ }).click();
  await page.getByRole("button", { name: "تسليم الاختبار نهائيًا" }).click();

  await expect(page).toHaveURL(/\/app\/student\/results\/[0-9a-f-]+$/);
  const resultUrl = page.url();
  await expect(page.getByRole("heading", { name: quizTitle })).toBeVisible();
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  await expect(page.getByText("النتيجة متاحة", { exact: true })).toBeVisible();
  await expect(page.getByText("الإجابة الصحيحة", { exact: true }).first()).toBeVisible();

  await page.goto(`/app/student/quizzes/${quizId}`);
  await expect(page).toHaveURL(resultUrl);
});
