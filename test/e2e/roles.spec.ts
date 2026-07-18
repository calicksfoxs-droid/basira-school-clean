import { expect, test } from "@playwright/test";
import { rm } from "node:fs/promises";
import path from "node:path";

const codes = {
  admin: "BSR-ADMN-DEMO2026",
  teacher: "BSR-TCHR-DEMO2026",
  student: "BSR-STDN-DEMO2026",
};

test.beforeAll(async () => {
  await rm(path.resolve(process.cwd(), ".data/e2e-db.json"), { force: true });
  await rm(path.resolve(process.cwd(), ".data/e2e-uploads"), { recursive: true, force: true });
});

async function login(page: import("@playwright/test").Page, code: string) {
  await page.goto("/login");
  await page.getByLabel("رمز الدخول").fill(code);
  await page.getByRole("button", { name: "دخول" }).click();
}

test("admin code lands on the admin home", async ({ page }) => {
  await login(page, codes.admin);
  await expect(page).toHaveURL(/\/app\/admin$/);
  await expect(page.getByRole("heading", { name: "إدارة المدرسة" })).toBeVisible();
  await expect(page.getByRole("link", { name: "المعلمون", exact: true })).toBeVisible();
});

test("teacher code lands on the teacher home", async ({ page }) => {
  await login(page, codes.teacher);
  await expect(page).toHaveURL(/\/app\/teacher$/);
  await expect(page.getByRole("heading", { name: "مساحة المعلم" })).toBeVisible();
  await expect(page.getByRole("link", { name: "مجموعاتي", exact: true })).toBeVisible();
});

test("student code lands on the student home and cannot use teacher routes", async ({ page }) => {
  await login(page, codes.student);
  await expect(page).toHaveURL(/\/app\/student$/);
  await expect(page.getByRole("heading", { name: "مساحة الطالب" })).toBeVisible();
  await page.goto("/app/teacher/groups");
  await expect(page).toHaveURL(/\/app\/student$/);
});

test("invalid code stays on login with a generic error", async ({ page }) => {
  await login(page, "BSR-XXXX-XXXXXXXX");
  await expect(page).toHaveURL(/\/login\?error=/);
  await expect(page.getByText("رمز الدخول غير صالح")).toBeVisible();
});
