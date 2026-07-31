import { expect, test, type Page } from "@playwright/test";
import { rm } from "node:fs/promises";
import path from "node:path";

const codes = {
  admin: "BSR-ADMN-DEMO2026",
  teacher: "BSR-TCHR-DEMO2026",
  student: "BSR-STDN-DEMO2026",
} as const;

const seededSubjectId = "20000000-0000-4000-8000-000000000001";
const seededGradeId = "10000000-0000-4000-8000-000000000001";

test.beforeAll(async () => {
  await rm(path.resolve(process.cwd(), ".data/e2e-db.json"), { force: true });
  await rm(path.resolve(process.cwd(), ".data/e2e-uploads"), { recursive: true, force: true });
});

async function login(page: Page, role: keyof typeof codes) {
  await page.goto("/login");
  await page.getByLabel("رمز الدخول").fill(codes[role]);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${role}$`));
}

test.describe("الدخول وتوجيه الأدوار", () => {
  test("يدخل المدير إلى لوحته وتظهر روابطه الأساسية", async ({ page }) => {
    await login(page, "admin");
    await expect(page.getByRole("heading", { name: /صباح الخير، مدير بصيرة/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "المعلمون", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "المواد", exact: true }).first()).toBeVisible();
  });

  test("يدخل المعلم إلى لوحته وتظهر روابطه الأساسية", async ({ page }) => {
    await login(page, "teacher");
    await expect(page.getByRole("heading", { name: /مرحبًا، أ\. أحمد/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "طلابي", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "صفوفي", exact: true }).first()).toBeVisible();
  });

  test("يدخل الطالب إلى لوحته وتظهر روابطه الأساسية", async ({ page }) => {
    await login(page, "student");
    await expect(page.getByRole("heading", { name: /أهلًا يا سارة/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "صفوفي", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "رحلتي", exact: true }).first()).toBeVisible();
  });

  test("يرفض رمزًا غير صالح برسالة عامة", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("رمز الدخول").fill("BSR-XXXX-XXXXXXXX");
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page).toHaveURL(/\/login\?error=/);
    await expect(page.getByText("رمز الدخول غير صالح")).toBeVisible();
  });

  test("يعيد الزائر غير المسجل إلى صفحة الدخول", async ({ page }) => {
    await page.goto("/app/student/subjects");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "مرحبًا بعودتك" })).toBeVisible();
  });
});

test.describe("عزل صلاحيات الأدوار", () => {
  test("لا يستطيع الطالب فتح مسارات المعلم أو المدير", async ({ page }) => {
    await login(page, "student");
    await page.goto("/app/teacher/subjects");
    await expect(page).toHaveURL(/\/app\/student$/);
    await page.goto("/app/admin/subjects");
    await expect(page).toHaveURL(/\/app\/student$/);
  });

  test("لا يستطيع المعلم فتح مسارات المدير أو الطالب", async ({ page }) => {
    await login(page, "teacher");
    await page.goto("/app/admin/subjects");
    await expect(page).toHaveURL(/\/app\/teacher$/);
    await page.goto("/app/student/subjects");
    await expect(page).toHaveURL(/\/app\/teacher$/);
  });

  test("لا يستطيع المدير فتح مسار الطالب", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/app/student/journey");
    await expect(page).toHaveURL(/\/app\/admin$/);
  });
});

test.describe("المواد ورحلة التعلم", () => {
  test("يعرض للمعلم قائمة مواده ويفتح المادة التجريبية", async ({ page }) => {
    await login(page, "teacher");
    await page.goto("/app/teacher/grades");
    await expect(page.getByRole("heading", { name: "صفوفي", exact: true })).toBeVisible();
    await page.locator(`a[href="/app/teacher/grades/${seededGradeId}"]`).click();
    await expect(page.getByRole("heading", { name: "الفيزياء", exact: true })).toBeVisible();
    await page.locator(`a[href="/app/teacher/subjects/${seededSubjectId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/app/teacher/subjects/${seededSubjectId}$`));
    await expect(page.getByRole("heading", { name: "ابدأ رحلتك في الفيزياء" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "خطة المادة" })).toBeVisible();
  });

  test("يعرض للطالب مواده المسجل فيها فقط ويفتح تفاصيل المادة", async ({ page }) => {
    await login(page, "student");
    await page.goto("/app/student/grades");
    await expect(page.getByRole("heading", { name: "صفوفي", exact: true })).toBeVisible();
    await page.locator(`a[href="/app/student/grades/${seededGradeId}"]`).click();
    await expect(page.getByRole("heading", { name: "الفيزياء", exact: true })).toBeVisible();
    await page.locator(`a[href="/app/student/subjects/${seededSubjectId}"]`).click();
    await expect(page.getByRole("heading", { name: "ابدأ رحلتك في الفيزياء" })).toBeVisible();
    await expect(page.getByRole("link", { name: /ابدأ رحلة التعلّم/ })).toBeVisible();
  });

  test("يفتح الطالب رحلة المادة وتفاصيل المحطة المتاحة", async ({ page }) => {
    await login(page, "student");
    await page.goto(`/app/student/subjects/${seededSubjectId}/journey`);
    await expect(page.getByRole("heading", { name: "خطوات صغيرة تبني فهمًا كبيرًا" })).toBeVisible();
    await expect(page.getByText("المحطة 1", { exact: true })).toBeVisible();
    await page.locator('a[href*="/journey?lesson="]').click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "الحركة في خط مستقيم" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /فتح محتوى الدرس/ })).toBeVisible();
    await dialog.getByRole("link", { name: "إغلاق" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("الإعدادات", () => {
  test("يحفظ السمة الداكنة ويستعيدها بعد إعادة التحميل", async ({ page }) => {
    await login(page, "student");
    await page.goto("/app/settings");
    await expect(page.getByRole("heading", { name: "الإعدادات" })).toBeVisible();
    await expect(page.getByRole("main").getByText("سارة محمد", { exact: true })).toBeVisible();

    await page.getByLabel("السمة").selectOption("dark");
    const saved = page.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === "/app/settings",
    );
    await page.getByRole("button", { name: "حفظ تفضيلاتي" }).click();
    await saved;
    await page.reload();

    await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByLabel("السمة")).toHaveValue("dark");
  });
});

test("يعرض شريط التنقل السفلي بأربع وجهات على الهاتف", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "هذا السيناريو مخصص لحجم الهاتف");
  await login(page, "student");

  const nav = page.getByRole("navigation", { name: "التنقل الرئيسي للهاتف" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link", { name: "الرئيسية", exact: true })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "صفوفي", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/student\/grades$/);
  await expect(nav.getByRole("link", { name: "صفوفي", exact: true })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "رحلتي", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/student\/journey$/);
  await expect(page.getByRole("heading", { name: "رحلتي" })).toBeVisible();

  // The Next.js development toolbar occupies a bottom corner on narrow
  // viewports. Keyboard activation verifies the real accessible link without
  // letting that development-only overlay intercept the pointer.
  await nav.getByRole("link", { name: "حسابي", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole("heading", { name: "الإعدادات" })).toBeVisible();
});
