import { test, expect } from "@playwright/test";
import path from "node:path";

const subject = "20000000-0000-4000-8000-000000000001";
const lesson = "30000000-0000-4000-8000-000000000001";
const profiles = {
  admin: { code: "BSR-ADMN-DEMO2026", routes: ["/app/admin", "/app/admin/subjects", "/app/admin/teachers", "/app/admin/students", "/app/admin/announcements", "/app/settings", `/app/admin/subjects/${subject}`] },
  teacher: { code: "BSR-TCHR-DEMO2026", routes: ["/app/teacher", "/app/teacher/grades", "/app/teacher/students", "/app/teacher/announcements", "/app/settings", `/app/teacher/subjects/${subject}`, `/app/teacher/lessons/${lesson}/edit`] },
  student: { code: "BSR-STDN-DEMO2026", routes: ["/app/student", "/app/student/grades", "/app/student/journey", "/app/student/results", "/app/settings/enrollment-reference", `/app/student/subjects/${subject}`, `/app/student/subjects/${subject}/journey`, `/app/student/lessons/${lesson}`] },
};

// Opt-in full route matrix, kept separate from the short release smoke suite.
for (const [role, profile] of Object.entries(profiles)) {
  test(`visual route audit: ${role}`, async ({ page }, testInfo) => {
    test.skip(process.env.BASIRA_VISUAL_QA !== "1", "Opt-in visual route matrix");
    test.setTimeout(240_000);
    page.setDefaultTimeout(20_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/login");
    await page.getByLabel("رمز الدخول").fill(profile.code);
    await page.getByRole("button", { name: "دخول", exact: true }).click();
    await expect(page).toHaveURL(`/app/${role}`);
    for (const theme of ["light", "dark"]) {
      await page.goto("/app/settings");
      await page.getByRole("combobox", { name: "السمة", exact: true }).selectOption(theme);
      await page.getByRole("button", { name: "حفظ تفضيلاتي" }).click();
      await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", theme);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 960 });
        for (const [index, route] of profile.routes.entries()) {
          await page.goto(route);
          await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
          await expect(page.getByLabel("جارٍ تحميل الصفحة", { exact: true })).toHaveCount(0);
          await expect(page.getByRole("heading", { name: "تعذر تحميل الصفحة", exact: true })).toHaveCount(0);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          expect.soft(overflow, `${route} ${theme} ${width}: page overflow`).toBe(false);
          const filename = `${role}-${index}-${theme}-${width}.png`;
          await page.screenshot({ path: process.env.BASIRA_QA_OUTPUT ? path.join(process.env.BASIRA_QA_OUTPUT, filename) : testInfo.outputPath(filename), fullPage: true, animations: "disabled" });
        }
      }
    }
    for (const width of [1280, 820]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(profile.routes[0]);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: process.env.BASIRA_QA_OUTPUT ? path.join(process.env.BASIRA_QA_OUTPUT, `${role}-home-${width}.png`) : testInfo.outputPath(`${role}-${width}.png`), fullPage: true, animations: "disabled" });
    }
    expect(errors).toEqual([]);
  });
}

test("mobile menu reaches omitted destinations and marks only one destination current", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("رمز الدخول").fill(profiles.student.code);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL("/app/student");
  await page.getByRole("button", { name: "فتح قائمة التنقل" }).click();
  const menu = page.getByRole("dialog", { name: "كل وجهات التنقل" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "نتائجي", exact: true }).click();
  await expect(page).toHaveURL("/app/student/results");
  await expect(menu).not.toBeVisible();
  await page.getByRole("button", { name: "فتح قائمة التنقل" }).click();
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(menu.getByRole("link", { name: "نتائجي", exact: true })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
});

test("lesson removal requires confirmation and cancellation preserves the lesson", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("رمز الدخول").fill(profiles.teacher.code);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL("/app/teacher");
  await page.goto(`/app/teacher/subjects/${subject}`);
  const remove = page.getByRole("button", { name: "إزالة الحركة في خط مستقيم", exact: true });
  await remove.click();
  const confirmation = page.getByRole("dialog", { name: "إزالة «الحركة في خط مستقيم»؟" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "إلغاء", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).not.toBeVisible();
  await expect(remove).toBeFocused();
  await page.reload();
  await expect(page.getByRole("link", { name: /الحركة في خط مستقيم/ })).toBeVisible();
});
