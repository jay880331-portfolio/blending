import { expect, test } from "@playwright/test";

test.skip(
  !process.env.ADMIN_SMOKE_BASE_URL ||
    !process.env.ADMIN_SMOKE_LOGIN_ID ||
    !process.env.ADMIN_SMOKE_PASSWORD,
  "Admin smoke environment is required",
);

test("admin can soft-delete, restore, and audit a fixture", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("전화번호").fill(process.env.ADMIN_SMOKE_LOGIN_ID!);
  await page.getByLabel("비밀번호").fill(process.env.ADMIN_SMOKE_PASSWORD!);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("link", { name: "사용자", exact: true }).click();
  await page.getByLabel("검색어").fill("admin-smoke-fixture");
  await page.getByRole("button", { name: "검색" }).click();
  await page.getByRole("link", { name: "admin-smoke-fixture" }).click();
  await page.getByRole("button", { name: "삭제" }).click();
  await page.getByLabel("사유").fill("staging smoke");
  await page.getByRole("button", { name: "확인" }).click();
  await page.getByRole("button", { name: "복구" }).click();
  await page.getByLabel("사유").fill("staging smoke restore");
  await page.getByRole("button", { name: "확인" }).click();
  await page.getByRole("link", { name: "감사 로그", exact: true }).click();
  await page.getByLabel("리소스 ID").fill("admin-smoke-fixture");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.getByText("staging smoke restore")).toBeVisible();
});
