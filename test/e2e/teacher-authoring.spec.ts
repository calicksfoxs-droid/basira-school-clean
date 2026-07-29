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
